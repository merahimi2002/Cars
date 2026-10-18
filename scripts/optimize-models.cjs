// Lossless packing only: no simplification, resizing, quantization or lossy filters.
// npm install --prefix .build-tools @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 meshoptimizer@1.3.0 sharp@0.34.5
// node scripts/optimize-models.cjs [--apply]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { NodeIO } = require('../.build-tools/node_modules/@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } = require('../.build-tools/node_modules/@gltf-transform/extensions');
const { MeshoptEncoder, MeshoptDecoder } = require('../.build-tools/node_modules/meshoptimizer');
const sharp = require('../.build-tools/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const originals = path.join(root, '.build-tools/model-originals');
const candidates = path.join(root, '.build-tools/optimized-models');
const files = ['huracan.glb', 'ferrari-458.glb', 'bmw-m4.glb', 'porsche-911.glb', 'nissan-r34.glb'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function assert(ok, message) { if (!ok) throw new Error(message); }

// Share byte-identical payloads, keeping all accessor/image/view indices intact.
function packPayloads(glb) {
    const jsonLength = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength));
    const bin = glb.subarray(28 + jsonLength);
    const pieces = [], cache = new Map();
    let offset = 0;
    for (const view of json.bufferViews) {
        const data = view.extensions?.EXT_meshopt_compression || view;
        if (data.buffer !== 0) continue; // Meshopt's virtual fallback buffer.
        const bytes = bin.subarray(data.byteOffset || 0, (data.byteOffset || 0) + data.byteLength);
        const key = hash(bytes);
        if (!cache.has(key)) {
            cache.set(key, offset);
            pieces.push(bytes);
            offset += bytes.length;
            const padding = (4 - offset % 4) % 4;
            if (padding) { pieces.push(Buffer.alloc(padding)); offset += padding; }
        }
        data.byteOffset = cache.get(key);
    }
    json.buffers[0].byteLength = offset;
    const raw = Buffer.from(JSON.stringify(json));
    const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(padded);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + padded.length + offset, 8);
    header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(offset); binHeader.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, padded, binHeader, ...pieces]);
}
function verifyGeometry(before, after) {
    const a = before.getRoot(), b = after.getRoot();
    const meshes = a.listMeshes(), nextMeshes = b.listMeshes();
    assert(meshes.length === nextMeshes.length, 'Mesh count changed');
    let vertices = 0, triangles = 0;
    meshes.forEach((mesh, mi) => {
        assert(mesh.getName() === nextMeshes[mi].getName(), 'Mesh name changed');
        const next = nextMeshes[mi].listPrimitives();
        assert(mesh.listPrimitives().length === next.length, 'Primitive count changed');
        mesh.listPrimitives().forEach((p, pi) => {
            const q = next[pi];
            assert(p.getMode() === q.getMode(), 'Primitive mode changed');
            assert(JSON.stringify(p.listSemantics()) === JSON.stringify(q.listSemantics()), 'Attributes changed');
            for (const semantic of p.listSemantics()) {
                const x = p.getAttribute(semantic), y = q.getAttribute(semantic);
                assert(x.getNormalized() === y.getNormalized() && x.getComponentType() === y.getComponentType(), 'Attribute type changed');
                const xa = x.getArray(), ya = y.getArray();
                assert(xa.length === ya.length && xa.every((v, i) => Object.is(v, ya[i])), 'Attribute values changed: ' + semantic);
            }
            vertices += p.getAttribute('POSITION').getCount();
            const x = p.getIndices()?.getArray(), y = q.getIndices()?.getArray();
            assert(!!x === !!y, 'Index presence changed');
            if (x) {
                assert(x.length === y.length, 'Triangle count changed');
                for (let i = 0; i < x.length; i += 3) {
                    // Meshopt may rotate the first corner of a triangle, never its winding.
                    assert([0, 1, 2].some(shift => [0, 1, 2].every(k => x[i + k] === y[i + (k + shift) % 3])), 'Triangle changed');
                }
                triangles += x.length / 3;
            }
        });
    });
    const nodes = a.listNodes(), nextNodes = b.listNodes();
    assert(nodes.length === nextNodes.length, 'Node count changed');
    nodes.forEach((n, i) => {
        assert(n.getName() === nextNodes[i].getName(), 'Node name changed');
        assert(n.getWorldMatrix().every((v, j) => Math.abs(v - nextNodes[i].getWorldMatrix()[j]) < 1e-10), 'Node transform changed');
    });
    assert(a.listMaterials().length === b.listMaterials().length, 'Material count changed');
    return { meshes: meshes.length, vertices, triangles, attributesIdentical: true, transformsIdentical: true };
}
async function pixels(bytes) { return sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
(async () => {
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
    fs.mkdirSync(originals, { recursive: true }); fs.mkdirSync(candidates, { recursive: true });
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    const report = { date: '2026-10-18', method: 'Lossless Meshopt packing and lossless full-resolution WebP, decoded attributes/pixels verified', models: [] };
    for (const file of files) {
        const source = path.join(root, 'assets/models', file), backup = path.join(originals, file);
        if (!fs.existsSync(backup)) fs.copyFileSync(source, backup);
        const original = fs.readFileSync(backup);
        if (file === 'ferrari-458.glb') {
            // Already Draco-compressed, with no textures. Preserve the original codec/data.
            fs.writeFileSync(path.join(candidates, file), original);
            report.models.push({ file, beforeBytes: original.length, afterBytes: original.length, sha256Before: hash(original), sha256After: hash(original), unchanged: true, reason: 'Already Draco compressed; no textures' });
            continue;
        }
        const doc = await io.read(backup);
        const textures = [];
        for (const [i, texture] of doc.getRoot().listTextures().entries()) {
            const image = Buffer.from(texture.getImage());
            const base = await pixels(image);
            const webp = await sharp(image).keepMetadata().webp({ lossless: true, effort: 6 }).toBuffer();
            const decoded = await pixels(webp);
            const identical = base.info.width === decoded.info.width && base.info.height === decoded.info.height && base.data.equals(decoded.data);
            const useWebp = identical && webp.length < image.length;
            textures.push({ index: i, name: texture.getName(), width: base.info.width, height: base.info.height, beforeBytes: image.length, afterBytes: useWebp ? webp.length : image.length, converted: useWebp, decodedPixelsIdentical: useWebp ? identical : true });
            if (useWebp) { texture.setImage(webp).setMimeType('image/webp'); doc.createExtension(EXTTextureWebP).setRequired(true); }
        }
        doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
        // QUANTIZE is the codec's lossless packing mode here. We deliberately do
        // NOT invoke a quantization transform or any lossy Meshopt filter.
        const candidate = packPayloads(Buffer.from(await io.writeBinary(doc)));
        const originalDoc = await io.read(backup), decodedDoc = await io.readBinary(candidate);
        const verified = verifyGeometry(originalDoc, decodedDoc);
        const materialBefore = (await io.writeJSON(originalDoc)).json;
        const materialAfter = (await io.writeJSON(decodedDoc)).json;
        assert(isDeepStrictEqual(materialBefore.materials, materialAfter.materials), 'Material settings or texture bindings changed');
        assert(isDeepStrictEqual(materialBefore.samplers, materialAfter.samplers), 'Texture samplers changed');
        const decodedTextures = decodedDoc.getRoot().listTextures();
        assert(decodedTextures.length === doc.getRoot().listTextures().length, 'Texture count changed');
        for (const [i, t] of decodedTextures.entries()) {
            const originalTexture = originalDoc.getRoot().listTextures()[i];
            const a = await pixels(Buffer.from(originalTexture.getImage())), b = await pixels(Buffer.from(t.getImage()));
            assert(a.info.width === b.info.width && a.info.height === b.info.height && a.data.equals(b.data), 'Decoded texture changed');
        }
        const output = candidate.length < original.length ? candidate : original;
        fs.writeFileSync(path.join(candidates, file), output);
        if (process.argv.includes('--apply')) {
            const liveHash = hash(fs.readFileSync(source));
            assert(liveHash === hash(original) || liveHash === hash(output), 'Model changed since backup: ' + file);
            fs.writeFileSync(source, output);
        }
        report.models.push({ file, beforeBytes: original.length, afterBytes: output.length, sha256Before: hash(original), sha256After: hash(output), ...verified, textures });
        console.log(file + ': ' + original.length + ' -> ' + output.length + ' bytes; geometry and texture pixels verified');
    }
    report.beforeBytes = report.models.reduce((n, m) => n + m.beforeBytes, 0);
    report.afterBytes = report.models.reduce((n, m) => n + m.afterBytes, 0);
    report.savedPercent = +(100 * (1 - report.afterBytes / report.beforeBytes)).toFixed(2);
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/model-optimization.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('Total: ' + report.beforeBytes + ' -> ' + report.afterBytes + ' bytes (' + report.savedPercent + '% saved)');
})().catch(error => { console.error(error); process.exitCode = 1; });
