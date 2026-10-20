import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.module.js';
import { createEnvironment } from '../js/environments.js';
import { batchStaticScenery, cacheLocalTransforms } from '../js/render-efficiency.js';
import fs from 'node:fs';
import { GLTFLoader } from '../js/vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../js/vendor/meshopt_decoder.module.js';
import { rigWheels } from '../js/wheel-rig.js';

globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, createLinearGradient: () => ({ addColorStop() {} })
}) }) };

function snapshot(root) {
    root.updateMatrixWorld(true);
    const triangles = new Map(); let meshes = 0;
    root.traverse(mesh => {
        if (!mesh.isMesh) return;
        meshes++;
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        const names = Object.keys(geometry.attributes).sort();
        const vertices = [];
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            const values = [];
            for (const name of names) {
                const a = geometry.attributes[name];
                for (let j = 0; j < a.itemSize; j++) values.push(Math.round(a.getComponent(i, j) * 1000));
            }
            vertices.push(values.join(','));
        }
        for (let i = 0; i < vertices.length; i += 3) {
            // Keep winding and material, permit cyclic rotation of triangle corners.
            const corners = vertices.slice(i, i + 3);
            const rotations = corners.map((_, j) => [...corners.slice(j), ...corners.slice(0, j)].join('/')).sort();
            const key = mesh.material.uuid + ':' + rotations[0];
            triangles.set(key, (triangles.get(key) || 0) + 1);
        }
        geometry.dispose();
    });
    return { triangles, meshes };
}
for (const id of ['city', 'coast']) {
    const { group, setTheme } = createEnvironment(THREE, id, false);
    const before = snapshot(group);
    batchStaticScenery(THREE, group);
    const after = snapshot(group);
    assert.deepEqual(after.triangles, before.triangles, id + ': geometry/material/normal/UV changed');
    assert(after.meshes < before.meshes);
    setTheme(true); setTheme(false);
    console.log(`${id}: ${before.meshes} -> ${after.meshes} meshes; all triangle attributes and materials retained (1e-3 comparison grid).`);
}

const root = new THREE.Group(), fixed = new THREE.Group(), wheel = new THREE.Group();
root.add(fixed); fixed.add(wheel); wheel.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
fixed.position.set(2, 3, 4); fixed.rotation.y = .7;
const reference = root.clone(true);
cacheLocalTransforms(root, new Set([root, wheel]));
for (let i = 0; i < 100; i++) {
    root.position.z = reference.position.z = i * .02;
    wheel.rotation.x = reference.children[0].children[0].rotation.x = i * .07;
    root.updateMatrixWorld(true); reference.updateMatrixWorld(true);
    const actual = [], expected = [];
    root.traverse(n => actual.push(n.matrixWorld.elements)); reference.traverse(n => expected.push(n.matrixWorld.elements));
    assert.deepEqual(actual, expected);
}
console.log('Cached local transforms: moving root, nested wheel pivots and wheel children match uncached matrices exactly.');

// Exercise the actual model preparation and steering-wheel rigs, without
// browser-only image decoding. Geometry and source node transforms are intact.
const source = fs.readFileSync('js/showroom.js', 'utf8');
const prepare = new Function('THREE', 'gltf', 'id', 'paint', 'config', 'rigWheels', 'modelCache', 'cacheLocalTransforms',
    source.slice(source.indexOf('        const model = new THREE.Group();'), source.indexOf('\n    car.add(await loadModel')).replace(/\n    }\s*$/, ''));
for (const [id, file, rotation] of [['huracan', 'huracan', Math.PI / 2], ['bmw', 'bmw-m4', 0], ['porsche', 'porsche-911', 0], ['nissan', 'nissan-r34', 0]]) {
    const bytes = fs.readFileSync(`assets/models/${file}.glb`), size = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + size));
    json.materials = json.materials.map(material => ({ name: material.name }));
    const raw = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
    raw.copy(padded);
    const rest = bytes.subarray(20 + size), output = Buffer.alloc(20 + padded.length + rest.length);
    bytes.copy(output, 0, 0, 20); output.writeUInt32LE(output.length, 8); output.writeUInt32LE(padded.length, 12);
    padded.copy(output, 20); rest.copy(output, 20 + padded.length);
    const load = async cache => {
        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
        return prepare(THREE, gltf, id, new THREE.MeshPhysicalMaterial(), { rotation }, rigWheels, new Map(), cache);
    };
    const before = await load(() => {}), after = await load(cacheLocalTransforms);
    const a = [], b = []; before.traverse(n => a.push(n)); after.traverse(n => b.push(n));
    assert.equal(a.length, b.length);
    for (let i = 0; i < 60; i++) {
        before.position.z = after.position.z = -19 + i / 3;
        before.rotation.y = after.rotation.y = i * .02;
        before.userData.wheels.forEach(w => { w.pivot.rotation.x = i / w.radius; });
        after.userData.wheels.forEach(w => { w.pivot.rotation.x = i / w.radius; });
        before.updateMatrixWorld(true); after.updateMatrixWorld(true);
        a.forEach((node, index) => assert.deepEqual(b[index].matrixWorld.elements, node.matrixWorld.elements, id + ': moving part changed'));
    }
    console.log(`${id}: ${a.length} node matrices match exactly through 60 body/wheel poses; ${b.filter(n => !n.matrixAutoUpdate).length} fixed local matrices cached.`);
}
