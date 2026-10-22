// A flat asphalt apron extends the five-lane road without dirt, hills or plants.
export function createLandscape(THREE, scene, renderer) {
    const geometry = new THREE.PlaneGeometry(170, 230);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -.075, -55);
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    // Match the main road's world-space aggregate scale and orientation.
    for (let i = 0; i < positions.count; i++) {
        uv.setXY(i, positions.getX(i) / 24 + .5, .5 - (positions.getZ(i) + 22) / 110);
    }
    const material = new THREE.MeshStandardMaterial({ color: 0xc1c8ce, roughness: .96, bumpScale: .018 });
    const ground = new THREE.Mesh(geometry, material);
    ground.receiveShadow = true;
    scene.add(ground);
    return {
        ground,
        setAsphalt(texture) { material.map = texture; material.bumpMap = texture; material.needsUpdate = true; },
        setTheme(dark) { material.color.set(dark ? 0x747e89 : 0xc1c8ce); }
    };
}
