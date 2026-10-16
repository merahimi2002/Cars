// Local procedural roadside scenery; no remote textures or model requests.
import { createEnvironment } from './environments.js';

export function createLandscape(THREE, scene, renderer) {
    let seed = 1847;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
        const value = 168 + random() * 58;
        pixels.data.set([value, value, value, 255], i);
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(32, 36);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const geometry = new THREE.PlaneGeometry(170, 230, 136, 184);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -.075, -55);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const earth = new THREE.Color('#b6aa8b');
    const meadow = new THREE.Color('#788566');
    const distant = new THREE.Color('#74877d');
    function elevation(x, z) {
        const shoulder = THREE.MathUtils.smoothstep(Math.abs(x), 7, 16);
        const rolling = .12 + .07 * Math.sin(x * .32 + z * .08) + .05 * Math.cos(z * .27);
        const hills = 2.2 * Math.exp(-((x + 48) ** 2 / 270 + (z + 96) ** 2 / 440))
            + 3 * Math.exp(-((x - 54) ** 2 / 380 + (z + 126) ** 2 / 600))
            + 1.8 * Math.exp(-((x + 66) ** 2 / 360 + (z + 144) ** 2 / 430));
        return -.075 + shoulder * (rolling + hills);
    }
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        positions.setY(i, elevation(x, z));
        const growth = THREE.MathUtils.smoothstep(Math.abs(x), 6.5, 13);
        const color = earth.clone().lerp(meadow, growth);
        color.lerp(distant, THREE.MathUtils.smoothstep(-z, 30, 95) * .45);
        color.multiplyScalar(.94 + random() * .12);
        color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: .035, vertexColors: true, roughness: 1 });
    const ground = new THREE.Mesh(geometry, material);
    ground.receiveShadow = true;
    scene.add(ground);

    // Instancing keeps the gravel and sparse roadside planting inexpensive.
    const stoneMaterial = new THREE.MeshStandardMaterial({ map: texture, color: 0x847c68, roughness: 1 });
    const rockGeometry = new THREE.SphereGeometry(1, 7, 5);
    const rockPositions = rockGeometry.attributes.position;
    for (let i = 0; i < rockPositions.count; i++) {
        const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i);
        // A continuous deformation keeps the UV seam closed while breaking symmetry.
        const irregularity = 1 + .15 * Math.sin(x * 7 + z * 4) * Math.cos(y * 6);
        rockPositions.setXYZ(i, x * irregularity, y * irregularity, z * irregularity);
    }
    rockGeometry.computeVertexNormals();
    const stones = new THREE.InstancedMesh(rockGeometry, stoneMaterial, 320);
    const blades = [], bladeColors = [];
    const green = new THREE.Color('#626c40'), dry = new THREE.Color('#a49a66');
    for (let i = 0; i < 28; i++) {
        const angle = random() * Math.PI * 2, radius = random() * .48;
        const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
        const height = .25 + random() * .65, width = .015 + random() * .035;
        const bend = .1 + random() * .22, dx = Math.cos(angle), dz = Math.sin(angle);
        const sideX = -dz * width, sideZ = dx * width;
        blades.push(x - sideX, 0, z - sideZ, x + sideX, 0, z + sideZ,
            x + dx * bend + sideX * .5, height * .55, z + dz * bend + sideZ * .5,
            x - sideX, 0, z - sideZ,
            x + dx * bend + sideX * .5, height * .55, z + dz * bend + sideZ * .5,
            x + dx * bend * 1.8, height, z + dz * bend * 1.8);
        const color = green.clone().lerp(dry, random());
        for (let v = 0; v < 6; v++) color.clone().multiplyScalar(v % 3 === 2 ? 1.08 : .75).toArray(bladeColors, bladeColors.length);
    }
    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
    grassGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bladeColors, 3));
    grassGeometry.computeVertexNormals();
    const shrubMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
    const shrubs = new THREE.InstancedMesh(grassGeometry, shrubMaterial, 210);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < stones.count; i++) {
        const x = (i % 2 ? -1 : 1) * (6 + random() * 9), z = -65 + random() * 95;
        const size = .025 + random() ** 2 * .085;
        dummy.position.set(x, elevation(x, z) + size * .08, z);
        dummy.rotation.set(random(), random() * Math.PI, random());
        dummy.scale.set(size * 1.4, size * .55, size);
        dummy.updateMatrix();
        stones.setMatrixAt(i, dummy.matrix);
        stones.setColorAt(i, new THREE.Color().setHSL(.1 + random() * .04, .08 + random() * .12, .45 + random() * .15));
    }
    for (let i = 0; i < shrubs.count; i++) {
        const x = (i % 2 ? -1 : 1) * (8 + random() * 24), z = -83 + random() * 108;
        const size = .22 + random() * .5;
        dummy.position.set(x, elevation(x, z) - .015, z);
        dummy.rotation.set(0, random() * Math.PI, 0);
        dummy.scale.set(size * (1 + random()), size, size);
        dummy.updateMatrix();
        shrubs.setMatrixAt(i, dummy.matrix);
    }
    scene.add(stones, shrubs);
    const environments = new Map();
    let active = 'desert', isDark = false;
    return {
        ground,
        setMode(id) {
            active = id;
            ground.visible = stones.visible = shrubs.visible = id === 'desert';
            if (id !== 'desert' && !environments.has(id)) {
                const environment = createEnvironment(THREE, id);
                environments.set(id, environment);
                scene.add(environment.group);
            }
            environments.forEach((environment, key) => {
                environment.group.visible = active === key;
                environment.setTheme(isDark);
            });
        },
        setTheme(dark) {
            isDark = dark;
            material.color.set(dark ? 0x687782 : 0xffffff);
            stoneMaterial.color.set(dark ? 0x66717a : 0xb7aa91);
            shrubMaterial.color.set(dark ? 0x71827b : 0xffffff);
            environments.forEach(environment => environment.setTheme(dark));
        }
    };
}
