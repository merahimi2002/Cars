import { batchStaticScenery, cacheLocalTransforms } from './render-efficiency.js';

// Lightweight scenery built locally, shared by the module and standalone builds.
export function createEnvironment(THREE, id, optimize = true) {
    const group = new THREE.Group();
    let seed = id === 'city' ? 923 : 124;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    function noiseTexture(size, base, spread) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
        const context = canvas.getContext('2d'), image = context.createImageData(size, size);
        for (let i = 0; i < image.data.length; i += 4) {
            const value = base + random() * spread;
            image.data.set([value, value, value, 255], i);
        }
        context.putImageData(image, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(34, 38); texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }
    function surface(width, length, x, y, z, material) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    }
    const grain = noiseTexture(256, 185, 55);
    const floor = new THREE.MeshStandardMaterial({ map: grain, bumpMap: grain, bumpScale: .025, color: id === 'city' ? 0x929da4 : 0xc8b58a, roughness: 1 });
    surface(190, 200, 0, -.075, -35, floor);
    if (id === 'city') {
        const buildingMaterials = [];
        for (const stone of ['#5b6971', '#aca799', '#78848b']) {
            const windowCanvas = document.createElement('canvas'); windowCanvas.width = 256; windowCanvas.height = 512;
            const context = windowCanvas.getContext('2d');
            context.fillStyle = stone; context.fillRect(0, 0, 256, 512);
            for (let y = 8; y < 512; y += 28) {
                context.fillStyle = '#0000001c'; context.fillRect(0, y + 23, 256, 2);
                for (let x = 7; x < 256; x += 25) {
                    const reflection = context.createLinearGradient(x, y, x + 17, y + 21);
                    reflection.addColorStop(0, random() > .7 ? '#a8bfc5' : '#4c6776');
                    reflection.addColorStop(1, '#243e50');
                    context.fillStyle = '#172b37'; context.fillRect(x - 1, y - 1, 19, 23);
                    context.fillStyle = reflection; context.fillRect(x, y, 17, 21);
                    if (random() > .7) { context.fillStyle = '#c5bda6a0'; context.fillRect(x, y, 17, 4 + random() * 11); }
                    context.fillStyle = '#c5d2d633'; context.fillRect(x + 8, y, 1, 21);
                }
            }
            const windows = new THREE.CanvasTexture(windowCanvas); windows.colorSpace = THREE.SRGBColorSpace;
            buildingMaterials.push(new THREE.MeshStandardMaterial({ map: windows, emissiveMap: windows, emissive: 0xb9cbd6, emissiveIntensity: .025, metalness: .2, roughness: .58 }));
        }
        const sidewalk = new THREE.MeshStandardMaterial({ map: grain, color: 0xa9aaa5, roughness: .95 });
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x697378, roughness: .85 });
        const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xb6b6ad, roughness: .9 });
        for (const side of [-1, 1]) {
            surface(4, 120, side * 8, -.025, -40, sidewalk);
            const curb = new THREE.Mesh(new THREE.BoxGeometry(.15, .13, 120), curbMaterial);
            curb.position.set(side * 6.1, -.025, -40); group.add(curb);
            for (let i = 0; i < 13; i++) {
                const height = 4 + random() * 12, width = 4 + random() * 3, depth = 5 + random() * 4;
                const x = side * (17 + random() * 9), z = -13 - i * 9;
                const buildingMaterial = buildingMaterials[i % buildingMaterials.length];
                const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterial);
                building.position.set(x, height / 2 - .075, z);
                const roof = new THREE.Mesh(new THREE.BoxGeometry(width + .18, .13, depth + .18), roofMaterial);
                roof.position.set(x, height, z);
                const podium = new THREE.Mesh(new THREE.BoxGeometry(width + .4, 1.4, depth + .4), buildingMaterials[(i + 1) % 3]);
                podium.position.set(x, .625, z);
                const roofUnit = new THREE.Mesh(new THREE.BoxGeometry(width * .35, .4, depth * .3), roofMaterial);
                roofUnit.position.set(x + width * .15, height + .26, z);
                group.add(building, roof, podium, roofUnit);
                if (i % 3 === 0) {
                    const annex = new THREE.Mesh(new THREE.BoxGeometry(width * .7, height * .6, depth * 1.25), buildingMaterial);
                    annex.position.set(x + side * width * .75, height * .3, z + .8); group.add(annex);
                }
            }
        }
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x3c4950, metalness: .7, roughness: .4 });
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x50654c, map: grain, roughness: 1 });
        const trunk = new THREE.MeshStandardMaterial({ color: 0x6c6153, roughness: 1 });
        const canopyGeometry = new THREE.IcosahedronGeometry(1, 2);
        const canopyPoints = canopyGeometry.attributes.position;
        for (let i = 0; i < canopyPoints.count; i++) {
            const x = canopyPoints.getX(i), y = canopyPoints.getY(i), z = canopyPoints.getZ(i);
            const r = 1 + .14 * Math.sin(x * 19 + z * 11) * Math.cos(y * 17);
            canopyPoints.setXYZ(i, x * r, y * r, z * r);
        }
        canopyGeometry.computeVertexNormals();
        for (const side of [-1, 1]) for (let z = -9; z > -68; z -= 15) {
            const x = side * 11;
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(.065, .1, 2.2, 7), trunk);
            stem.position.set(x, 1.025, z); group.add(stem);
            for (let crown = 0; crown < 6; crown++) {
                const canopy = new THREE.Mesh(canopyGeometry, treeMaterial);
                canopy.position.set(x + (random() - .5) * 1.1, 2.2 + random() * .7, z + (random() - .5));
                canopy.scale.set(.5 + random() * .35, .55 + random() * .3, .5 + random() * .3);
                group.add(canopy);
            }
        }
        const joints = new THREE.LineBasicMaterial({ color: 0x777d7c, transparent: true, opacity: .25 });
        const jointPoints = [];
        for (const side of [-1, 1]) for (let z = -95; z < 15; z += 2) {
            jointPoints.push(new THREE.Vector3(side * 6.2, -.02, z), new THREE.Vector3(side * 9.9, -.02, z));
        }
        group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(jointPoints), joints));
        const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e5ca, emissive: 0xffdc9b, emissiveIntensity: .8 });
        for (const side of [-1, 1]) for (let z = -10; z > -75; z -= 14) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .055, 3.8, 6), poleMaterial);
            pole.position.set(side * 9, 1.9, z);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, .055, .06), poleMaterial);
            arm.position.set(side * 8.5, 3.8, z);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(.55, .06, .25), lampMaterial);
            lamp.position.set(side * 8.15, 3.75, z);
            group.add(pole, arm, lamp);
        }
        if (optimize) { batchStaticScenery(THREE, group); cacheLocalTransforms(group); }
        return { group, setTheme(dark) {
            floor.color.set(dark ? 0x343e49 : 0x929da4);
            sidewalk.color.set(dark ? 0x56616b : 0xb6bdc0);
            buildingMaterials.forEach(material => { material.emissiveIntensity = dark ? .22 : .025; });
            lampMaterial.emissiveIntensity = dark ? 2 : .8;
            treeMaterial.color.set(dark ? 0x33483f : 0x50654c);
        } };
    }

    const seaGeometry = new THREE.PlaneGeometry(72, 180, 36, 90);
    seaGeometry.rotateX(-Math.PI / 2);
    seaGeometry.translate(-46, -.055, -35);
    const positions = seaGeometry.attributes.position;
    const colors = [];
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        const shore = THREE.MathUtils.smoothstep(x, -26, -10);
        positions.setX(i, x + Math.sin(z * .13) * shore * .5);
        positions.setY(i, -.055 + Math.sin(x * 1.8 + z * .9) * .012);
        new THREE.Color('#24798f').lerp(new THREE.Color('#84bdb4'), shore).toArray(colors, i * 3);
    }
    seaGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    seaGeometry.computeVertexNormals();
    const normalCanvas = document.createElement('canvas'); normalCanvas.width = normalCanvas.height = 256;
    const normalContext = normalCanvas.getContext('2d'), normals = normalContext.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const p = (y * 256 + x) * 4;
        const wave = Math.sin(x * Math.PI / 16 + Math.sin(y * Math.PI / 32) * 2);
        const ripple = Math.cos(y * Math.PI / 8 + Math.sin(x * Math.PI / 32));
        normals.data.set([128 + wave * 28, 128 + ripple * 18, 250, 255], p);
    }
    normalContext.putImageData(normals, 0, 0);
    const waterNormals = new THREE.CanvasTexture(normalCanvas);
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping; waterNormals.repeat.set(12, 25);
    const seaMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, normalMap: waterNormals, normalScale: new THREE.Vector2(.45, .45), metalness: .18, roughness: .25 });
    group.add(new THREE.Mesh(seaGeometry, seaMaterial));
    const foam = new THREE.LineBasicMaterial({ color: 0xe2e8d9, transparent: true, opacity: .28 });
    for (let wave = 0; wave < 45; wave++) {
        const points = [];
        const start = -105 + random() * 140, length = 1.5 + random() * 6, offset = random() * 4;
        for (let z = start; z < start + length; z += .4) points.push(new THREE.Vector3(-10.9 - offset + Math.sin(z * .13) * .5, -.035, z));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), foam));
    }
    const barkCanvas = document.createElement('canvas'); barkCanvas.width = 64; barkCanvas.height = 256;
    const barkContext = barkCanvas.getContext('2d'); barkContext.fillStyle = '#96866b'; barkContext.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 8) {
        barkContext.fillStyle = '#4f46394d'; barkContext.fillRect(0, y, 64, 1 + random() * 2);
        barkContext.fillStyle = '#c8b99c70'; barkContext.fillRect(0, y + 3, 64, 1);
    }
    const bark = new THREE.CanvasTexture(barkCanvas); bark.colorSpace = THREE.SRGBColorSpace;
    const trunkMaterial = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: .015, color: 0xaaa08e, roughness: 1 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x587951, roughness: .9, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
        const palm = new THREE.Group(), height = 2.8 + random();
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(.1, height * .6, 0), new THREE.Vector3(.5, height, .1));
        palm.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, .07, 6, false), trunkMaterial));
        const vertices = [];
        for (let leaf = 0; leaf < 11; leaf++) {
            const angle = leaf / 11 * Math.PI * 2, length = 1.2 + random() * .5;
            for (let segment = 0; segment < 6; segment++) {
                const point = (t, side) => {
                    const width = Math.sin(t * Math.PI) * .16 * side;
                    return [.5 + Math.cos(angle) * t * length - Math.sin(angle) * width,
                        height + Math.sin(t * Math.PI) * .4 - t * .55,
                        .1 + Math.sin(angle) * t * length + Math.cos(angle) * width];
                };
                const a = segment / 6, b = (segment + 1) / 6;
                vertices.push(...point(a, -1), ...point(a, 1), ...point(b, 1), ...point(a, -1), ...point(b, 1), ...point(b, -1));
                for (let leaflet = 0; leaflet < 3; leaflet++) {
                    const t = (segment + leaflet / 3) / 6;
                    const center = point(t, 0), next = point(Math.min(1, t + .045), 0);
                    for (const side of [-1, 1]) {
                        const spread = Math.sin(t * Math.PI) * .34 * side;
                        const tip = [center[0] - Math.sin(angle) * spread + Math.cos(angle) * .13,
                            center[1] - .06, center[2] + Math.cos(angle) * spread + Math.sin(angle) * .13];
                        vertices.push(...center, ...next, ...tip);
                    }
                }
            }
        }
        const leaves = new THREE.BufferGeometry();
        leaves.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); leaves.computeVertexNormals();
        palm.add(new THREE.Mesh(leaves, leafMaterial));
        const palmX = i < 3 ? -8.5 - random() * .6 : 10 + random() * 7;
        palm.position.set(palmX, -.075, i < 3 ? -6 - i * 7 : -10 - i * 9);
        palm.rotation.y = random() * Math.PI;
        group.add(palm);
    }
    if (optimize) { batchStaticScenery(THREE, group); cacheLocalTransforms(group); }
    return { group, setTheme(dark) {
        floor.color.set(dark ? 0x6a7167 : 0xc8b58a);
        seaMaterial.color.set(dark ? 0x668696 : 0xffffff);
        leafMaterial.color.set(dark ? 0x364f47 : 0x587951);
        foam.opacity = dark ? .12 : .28;
    } };
}
