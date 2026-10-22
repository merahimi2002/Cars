// Wheels and the moving root remain live. Imported fixed parts do not need
// their identical local matrix recomposed on every animation frame.
export function cacheLocalTransforms(root, dynamic = new Set()) {
    root.traverse(node => {
        if (dynamic.has(node) || node.isSkinnedMesh) return;
        node.updateMatrix();
        node.matrixAutoUpdate = false;
    });
}
