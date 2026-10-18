// Bake wheel surfaces into four axle pivots. Imported files may merge all rims
// into one mesh, so splitting by wheel position also handles those exports.
export function rigWheels(THREE, model, paint, modelId) {
    model.updateMatrixWorld(true);
    if (modelId === 'huracan') return rigHuracanWheels(THREE, model);
    const samples = Array.from({ length: 4 }, () => []);
    const point = new THREE.Vector3();
    const meshes = [];
    model.traverse(mesh => {
        if (!mesh.isMesh || !mesh.visible) return;
        meshes.push(mesh);
        if (!mesh.userData.wheelSurface || mesh.userData.wheelSample === false) return;
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
            samples[(point.x > 0 ? 2 : 0) + (point.z > 0 ? 1 : 0)].push(point.clone());
        }
    });
    if (samples.some(points => points.length === 0)) return { object: model, wheels: [] };
    const display = new THREE.Group();
    display.add(model);
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const wheels = samples.map(points => {
        // Some exporters share rim material with isolated trim/steering pieces.
        // Medians keep those outliers from shifting the axle away from the hub.
        // The Porsche export has its front wheels steered 20 degrees. Keep that
        // steering on a parent so rolling uses the wheel's own axle, not world X.
        const steering = modelId === 'porsche' && points[0].z > 0 ? -Math.PI / 9 : 0;
        const axleFrame = new THREE.Matrix4().makeRotationY(-steering);
        const tireBounds = new THREE.Box3().setFromPoints(points.map(point => point.clone().applyMatrix4(axleFrame)));
        const tireSamples = modelId === 'porsche' || modelId === 'nissan';
        const center = tireSamples ? tireBounds.getCenter(new THREE.Vector3()).applyAxisAngle(new THREE.Vector3(0, 1, 0), steering) : new THREE.Vector3(...['x', 'y', 'z'].map(axis => median(points.map(point => point[axis]))));
        const radius = tireSamples ? Math.max((tireBounds.max.y - tireBounds.min.y) / 2, .15) : Math.max(center.y, .15);
        const pivot = new THREE.Group();
        const axle = new THREE.Group();
        axle.position.copy(center);
        axle.rotation.y = steering;
        axle.add(pivot);
        display.add(axle);
        return { pivot, radius, center, steering, width: .5 };
    });

    function subset(source, faces) {
        const geometry = new THREE.BufferGeometry();
        const remap = new Map();
        const vertices = [];
        const indices = faces.map(index => {
            if (!remap.has(index)) { remap.set(index, vertices.length); vertices.push(index); }
            return remap.get(index);
        });
        for (const [name, attribute] of Object.entries(source.attributes)) {
            const values = new Float32Array(vertices.length * attribute.itemSize);
            const methods = ['getX', 'getY', 'getZ', 'getW'];
            vertices.forEach((vertex, i) => {
                for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute[methods[c]](vertex);
            });
            geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
        }
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();
        return geometry;
    }

    for (const mesh of meshes) {
        if (!mesh.userData.wheelSurface || Array.isArray(mesh.material) || mesh.material === paint) continue;
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const world = new Float32Array(positions.count * 3);
        for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
            point.toArray(world, i * 3);
        }
        const buckets = [[], [], [], [], []];
        const count = geometry.index ? geometry.index.count : positions.count;
        for (let i = 0; i < count; i += 3) {
            const a = geometry.index ? geometry.index.getX(i) : i;
            const b = geometry.index ? geometry.index.getX(i + 1) : i + 1;
            const c = geometry.index ? geometry.index.getX(i + 2) : i + 2;
            // These Porsche meshes contain only paired wheel surfaces. Splitting
            // by side/axle keeps the steered tire complete instead of leaving
            // stationary fragments outside a world-aligned cylinder.
            const wheel = modelId === 'porsche'
                ? (world[a * 3] > 0 ? 2 : 0) + (world[a * 3 + 2] > 0 ? 1 : 0)
                : wheels.findIndex(({ center, radius, width }) => [a, b, c].every(vertex =>
                Math.abs(world[vertex * 3] - center.x) < width / 2 &&
                (world[vertex * 3 + 1] - center.y) ** 2 + (world[vertex * 3 + 2] - center.z) ** 2 < (radius * 1.04) ** 2));
            buckets[wheel + 1].push(a, b, c);
        }
        if (buckets.slice(1).every(bucket => bucket.length === 0)) continue;
        if (buckets[0].length) mesh.geometry = subset(geometry, buckets[0]);
        else mesh.visible = false;
        wheels.forEach(({ pivot, center, steering }, i) => {
            if (!buckets[i + 1].length) return;
            const part = subset(geometry, buckets[i + 1]);
            part.applyMatrix4(mesh.matrixWorld);
            part.translate(-center.x, -center.y, -center.z);
            if (steering) part.rotateY(-steering);
            const surface = new THREE.Mesh(part, mesh.material);
            surface.castShadow = surface.receiveShadow = true;
            pivot.add(surface);
        });
    }
    return { object: display, wheels };
}

function rigHuracanWheels(THREE, model) {
    // This export has separate wheel meshes. Its spokes are not evenly sampled,
    // so a vertex median is not the axle. Use each complete rim's circular bounds.
    const parts = [];
    const rims = [];
    const rotatingParts = new Set([10, 12, 13, 14, 15, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56]);
    model.traverse(mesh => {
        if (!mesh.isMesh) return;
        const number = Number(mesh.name.match(/^FrontSide[._]?(\d+)$/)?.[1]);
        if (rotatingParts.has(number)) parts.push(mesh);
        if ([41, 42, 48, 49].includes(number)) rims.push(mesh);
    });
    if (rims.length !== 4) return { object: model, wheels: [] };
    const display = new THREE.Group();
    display.add(model);
    const wheels = rims.map(mesh => {
        const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        const pivot = new THREE.Group();
        pivot.position.copy(center);
        display.add(pivot);
        return { pivot, center, radius: center.z > 0 ? .42 : .44 };
    });
    for (const mesh of parts) {
        const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        const wheel = wheels.reduce((nearest, candidate) => candidate.center.distanceToSquared(center) < nearest.center.distanceToSquared(center) ? candidate : nearest);
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geometry.translate(-wheel.center.x, -wheel.center.y, -wheel.center.z);
        const surface = new THREE.Mesh(geometry, mesh.material);
        surface.castShadow = surface.receiveShadow = true;
        wheel.pivot.add(surface);
        mesh.visible = false;
    }
    // Brake calipers and nearby body trim remain fixed in the source hierarchy.
    return { object: display, wheels };
}
