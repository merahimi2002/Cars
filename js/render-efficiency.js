import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Keep every vertex, normal, UV and material. Only static opaque scenery is
// combined, in small spatial cells so distant geometry can still be culled.
export function batchStaticScenery(THREE, root) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const buckets = new Map();
    root.traverse(node => {
        if (!node.isMesh || node.name === 'static-scenery-batch' || node.isInstancedMesh || node.isSkinnedMesh || !node.visible ||
            Array.isArray(node.material) || node.material.transparent || node.morphTargetInfluences ||
            node.geometry.drawRange.count !== Infinity) return;
        const geometry = node.geometry;
        const matrix = inverse.clone().multiply(node.matrixWorld);
        const center = new THREE.Vector3().setFromMatrixPosition(matrix);
        const attributes = Object.keys(geometry.attributes).sort().map(key => {
            const a = geometry.attributes[key]; return `${key}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
        }).join('|');
        const key = [node.material.uuid, node.castShadow, node.receiveShadow, node.renderOrder,
            node.layers.mask, Math.floor(center.x / 32), Math.floor(center.z / 32), attributes].join(';');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ node, matrix });
    });
    for (const bucket of buckets.values()) {
        if (bucket.length < 2) continue;
        const copies = bucket.map(({ node, matrix }) => {
            const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
            geometry.applyMatrix4(matrix); geometry.clearGroups(); return geometry;
        });
        const geometry = mergeGeometries(copies, false);
        copies.forEach(copy => copy.dispose());
        if (!geometry) continue;
        geometry.computeBoundingSphere();
        const source = bucket[0].node;
        const mesh = new THREE.Mesh(geometry, source.material);
        mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
        mesh.renderOrder = source.renderOrder; mesh.layers.mask = source.layers.mask;
        mesh.name = 'static-scenery-batch';
        root.add(mesh);
        bucket.forEach(({ node }) => node.removeFromParent());
    }
}

// Wheels and the moving root remain live. Imported fixed parts do not need
// their identical local matrix recomposed on every animation frame.
export function cacheLocalTransforms(root, dynamic = new Set()) {
    root.traverse(node => {
        if (dynamic.has(node) || node.isSkinnedMesh) return;
        node.updateMatrix();
        node.matrixAutoUpdate = false;
    });
}
