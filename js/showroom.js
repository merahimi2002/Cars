import { rigWheels } from './wheel-rig.js';
import { createLandscape } from './landscape.js';
import { paintPalettes } from './paint-palettes.js';
import { transitionEnvironment } from './environment-transition.js';
import { createDriveStory } from './drive-story.js';

const hero = document.getElementById('showroom');
const canvas = hero.querySelector('canvas');
const progress = hero.querySelector('.showroom-progress');
const loadingText = document.getElementById('showroom-loading-text');
const errorPanel = hero.querySelector('.showroom-error');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const paintButtons = [...hero.querySelectorAll('[data-paint]')];
const customPaint = document.getElementById('showroom-custom-paint');
const environmentButtons = [...hero.querySelectorAll('[data-environment]')];
let currentEnvironment = 'desert';
const viewButtons = [...hero.querySelectorAll('[data-view]')];
const rotateButton = document.getElementById('showroom-rotate');
const replayButton = document.getElementById('showroom-replay');
const carButtons = [...hero.querySelectorAll('[data-car]')];
const interactiveButtons = [...paintButtons, customPaint, ...viewButtons, rotateButton, replayButton, ...carButtons, ...environmentButtons];
const cars = {
    huracan: { file: 'huracan.glb', title: 'HURACÁN', label: '01 — HURACÁN SPYDER', name: 'لامبورگینی هوراکان اسپایدر', rotation: Math.PI / 2 },
    ferrari: { file: 'ferrari-458.glb', title: '458 ITALIA', label: '02 — FERRARI 458 ITALIA', name: 'فراری 458 ایتالیا', rotation: Math.PI },
    bmw: { file: 'bmw-m4.glb', title: 'BMW M4', label: '03 — BMW M4 COMPETITION', name: 'بی‌ام‌و M4 کامپتیشن', rotation: 0 },
    porsche: { file: 'porsche-911.glb', title: '911 CARRERA', label: '04 — PORSCHE 911 CARRERA 4S', name: 'پورشه ۹۱۱ کاررا 4S', rotation: 0 },
    nissan: { file: 'nissan-r34.glb', title: 'SKYLINE GT-R', label: '05 — NISSAN SKYLINE R34', name: 'نیسان اسکای‌لاین GT-R R34', rotation: 0 }
};

// Classic scripts work under file://; no fetch or ES-module requests are made there.
const localScripts = new Map();
function loadLocalScript(src) {
    if (!localScripts.has(src)) localScripts.set(src, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Unable to load local asset: ' + src));
        document.body.appendChild(script);
    }));
    return localScripts.get(src);
}
function decodeLocalBase64(encoded) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

function showError(error) {
    console.error('Showroom could not start:', error);
    hero.classList.remove('is-ready');
    hero.querySelector('.showroom-loader').hidden = true;
    hero.querySelector('.showroom-hint').hidden = true;
    errorPanel.hidden = false;
    interactiveButtons.forEach(button => { button.disabled = true; });
}

document.getElementById('showroom-retry').addEventListener('click', () => location.reload());

async function initShowroom() {
    const [THREE, { OrbitControls }, { GLTFLoader }, { RoomEnvironment }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
        import('./vendor/three.module.js'),
        import('./vendor/OrbitControls.js'),
        import('./vendor/GLTFLoader.js'),
        import('./vendor/RoomEnvironment.js'),
        import('./vendor/DRACOLoader.js'),
        import('./vendor/meshopt_decoder.module.js')
    ]);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x202033, .022);
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 140);
    const controls = new OrbitControls(camera, canvas);
    canvas.style.touchAction = 'pan-y';
    controls.target.set(0, .65, 0);
    controls.enableDamping = true;
    controls.dampingFactor = .07;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = .5;
    controls.minPolarAngle = .15;
    controls.maxPolarAngle = Math.PI / 2 - .025;
    controls.enabled = false;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xe4e9ff, 0x22202c, 1.0));
    const key = new THREE.DirectionalLight(0xffe9e0, 2.5);
    key.position.set(4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 40 });
    key.shadow.bias = -.0003;
    key.shadow.normalBias = .025;
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8c9ff, 1.7);
    rim.position.set(-5, 3, -5);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffc2b5, .8);
    fill.position.set(-6, 4, 5);
    scene.add(fill);

    const landscape = createLandscape(THREE, scene, renderer);
    const ground = landscape.ground;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.ShadowMaterial({ opacity: .35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -.02;
    shadow.receiveShadow = true;
    scene.add(shadow);

    // Deterministic, locally generated asphalt: aggregate, worn patches and tire tracks.
    const asphaltCanvas = document.createElement('canvas');
    asphaltCanvas.width = asphaltCanvas.height = 512;
    const asphaltContext = asphaltCanvas.getContext('2d');
    const aggregate = asphaltContext.createImageData(512, 512);
    let seed = 431;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < aggregate.data.length; i += 4) {
        const value = 66 + random() * 32 + (random() > .985 ? 24 : 0);
        aggregate.data[i] = value;
        aggregate.data[i + 1] = value + 3;
        aggregate.data[i + 2] = value + 5;
        aggregate.data[i + 3] = 255;
    }
    asphaltContext.putImageData(aggregate, 0, 0);
    for (const x of [65, 191, 321, 447]) {
        const track = asphaltContext.createLinearGradient(x - 14, 0, x + 14, 0);
        track.addColorStop(0, '#11182000');
        track.addColorStop(.5, '#11182020');
        track.addColorStop(1, '#11182000');
        asphaltContext.fillStyle = track;
        asphaltContext.fillRect(x - 14, 0, 28, 512);
    }
    const asphalt = new THREE.CanvasTexture(asphaltCanvas);
    asphalt.colorSpace = THREE.SRGBColorSpace;
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    asphalt.repeat.set(1, 28);
    asphalt.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const shoulderCanvas = document.createElement('canvas');
    shoulderCanvas.width = 512;
    shoulderCanvas.height = 128;
    const shoulderContext = shoulderCanvas.getContext('2d');
    const shoulderFade = shoulderContext.createLinearGradient(0, 0, 512, 0);
    for (const [stop, color] of [[0, '#000'], [.06, '#111'], [.12, '#777'], [.2, '#fff'], [.8, '#fff'], [.88, '#777'], [.94, '#111'], [1, '#000']]) shoulderFade.addColorStop(stop, color);
    shoulderContext.fillStyle = shoulderFade;
    shoulderContext.fillRect(0, 0, 512, 128);
    const shoulders = new THREE.CanvasTexture(shoulderCanvas);
    const roadMaterial = new THREE.MeshStandardMaterial({ map: asphalt, alphaMap: shoulders, transparent: true, depthWrite: false, bumpMap: asphalt, bumpScale: .018, roughness: .96, metalness: 0, color: 0xc1c8ce });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(15, 110), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -.04, -22);
    ground.renderOrder = -3;
    road.renderOrder = -2;
    shadow.renderOrder = -1;
    scene.add(road);
    const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e5d8, roughness: .95, transparent: true, opacity: .82 });
    function marking(x, z, length, width = .11) {
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(width, length), laneMaterial);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(x, -.015, z);
        scene.add(lane);
    }
    for (const x of [-5.2, 5.2]) marking(x, -22, 110);
    for (const x of [-1.8, 1.8]) {
        for (let z = -74; z < 32; z += 6) marking(x, z, 3);
    }

    const paint = new THREE.MeshPhysicalMaterial({ color: 0xed263c, metalness: .35, roughness: .27, clearcoat: 1, clearcoatRoughness: .18, envMapIntensity: .7 });
    const paintTarget = paint.color.clone();
    const car = new THREE.Group();
    scene.add(car);
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('./js/vendor/draco/');
    draco.setDecoderConfig({ type: 'wasm' });
    draco.setWorkerLimit(2);
    if (window.CARS_LOCAL_MODE) {
        await loadLocalScript('js/vendor/draco/local-decoder.js');
        // The pinned Draco loader otherwise fetches its JS/WASM libraries from file://.
        draco._loadLibrary = (name, type) => Promise.resolve(type === 'arraybuffer'
            ? decodeLocalBase64(window.CarsLocalDecoder.wasm) : window.CarsLocalDecoder.js);
    }
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
    const modelCache = new Map();
    let driveStory = null;
    let currentCar = 'huracan';
    let switching = false;
    async function loadModel(id) {
        if (modelCache.has(id)) return modelCache.get(id);
        const config = cars[id];
        const onProgress = event => {
            if (!event.total) return;
            const percentage = Math.min(96, Math.round(event.loaded / event.total * 96));
            progress.style.setProperty('--progress', percentage + '%');
            loadingText.textContent = 'در حال آماده‌سازی ' + config.name + ' · ' + percentage.toLocaleString('fa-IR') + '٪';
        };
        let gltf;
        if (window.CARS_LOCAL_MODE) {
            await loadLocalScript('assets/models/' + id + '.local.js');
            const buffer = decodeLocalBase64(window.CarsLocalAssets.models[id]);
            gltf = await loader.parseAsync(buffer, '');
            delete window.CarsLocalAssets.models[id];
        } else {
            gltf = await loader.loadAsync('./assets/models/' + config.file, onProgress);
        }
        const model = new THREE.Group();
        model.add(gltf.scene);
        let paintMeshes = 0;
        model.traverse(child => {
            if (!child.isMesh) return;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            child.userData.wheelSurface = materials.some(material => /cerchi|rim/i.test(material.name)) || /^rim_/.test(child.name);
            if (id === 'porsche') {
                // The source includes a baked floor and duplicate clearcoat shells.
                if (child.name === 'Plane_0' || materials.some(m => m.name === 'coat')) child.visible = false;
                child.userData.wheelSurface = /^Cylinder/.test(child.name) && materials.some(m => /^(silver|plastic|rubber)$/.test(m.name));
                child.userData.wheelSample = materials.some(m => m.name === 'rubber');
            } else if (id === 'nissan') {
                child.userData.wheelSurface = materials.some(m => /^(Material\.010|Material\.012)$/.test(m.name));
                child.userData.wheelSample = materials.some(m => m.name === 'Material.010');
            }
            child.castShadow = true;
            child.receiveShadow = true;
            const convert = material => {
                const body = id === 'huracan' ? material.name === 'scocca'
                    : id === 'ferrari' ? child.name === 'body'
                    : id === 'porsche' ? material.name === 'paint'
                    : id === 'nissan' ? material.name === 'Material.001'
                    : /paint|body|carros|kaross|livery|^Meshes(?:zx1|ff41)Mtl$/i.test(material.name);
                if (body) { paintMeshes++; return paint; }
                if (material.name === 'vetro' || child.name === 'glass') return new THREE.MeshPhysicalMaterial({ color: 0x202b38, metalness: .1, roughness: .06, transparent: true, opacity: .55, side: THREE.DoubleSide });
                if (material.name === 'fanali') return new THREE.MeshStandardMaterial({ color: 0xe3f5ff, emissive: 0xb3e9ff, emissiveIntensity: 2, roughness: .18 });
                if (material.name === 'cerchi' || /^rim_/.test(child.name)) return new THREE.MeshStandardMaterial({ color: 0x393c42, metalness: .9, roughness: .24 });
                material.envMapIntensity = .9;
                return material;
            };
            child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
        });
        if (!paintMeshes) throw new Error('No configurable paint material in ' + id);
        if (id === 'bmw') {
            // Infer the front from the kidney grille after all source transforms.
            // This avoids depending on the exporter's nested axis rotations.
            model.updateMatrixWorld(true);
            const bodyCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
            let grille;
            model.traverse(node => {
                if (node.isMesh && /piggrill/i.test(node.material?.name)) grille = node;
            });
            if (grille) {
                const front = new THREE.Box3().setFromObject(grille).getCenter(new THREE.Vector3()).sub(bodyCenter);
                model.rotation.y = -Math.atan2(front.x, front.z);
            } else model.rotation.y = config.rotation;
        } else model.rotation.y = config.rotation;
        // Remove hidden source-only geometry before computing the display bounds.
        const hidden = []; model.traverse(node => { if (node.isMesh && !node.visible) hidden.push(node); });
        hidden.forEach(node => node.removeFromParent());
        // Compressed exports can have rotated local bounds larger than the body.
        // Measure their vertices so the car stays centered at the intended size.
        const bounds = new THREE.Box3().setFromObject(model, id === 'porsche' || id === 'nissan');
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 5.8 / Math.max(size.x, size.z);
        const center = bounds.getCenter(new THREE.Vector3());
        model.scale.multiplyScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        const rig = rigWheels(THREE, model, paint, id);
        rig.object.userData.wheels = rig.wheels;
        modelCache.set(id, rig.object);
        return rig.object;
    }
    car.add(await loadModel(currentCar));

    let activeView = 'hero';
    let autoRotate = false;
    let intro = null;
    let transferPausedAt = null;
    let cameraTween = null;
    let visible = true;
    let frame = null;
    let rendering = false;
    let previousTime = performance.now();
    let needsFrames = 0;
    const spherical = new THREE.Spherical();
    const target = new THREE.Vector3(0, .65, 0);
    const presets = {
        hero: { theta: .8, phi: 1.37 },
        front: { theta: 0, phi: 1.40 },
        side: { theta: Math.PI / 2, phi: 1.33 },
        rear: { theta: Math.PI, phi: 1.38 },
        top: { theta: .1, phi: .16 }
    };
    function radius() {
        if (hero.clientWidth <= 575) {
            const space = hero.querySelector('.showroom-mobile-space');
            return Math.max(10.8 * canvas.clientHeight / hero.clientWidth,
                5 * canvas.clientHeight / Math.max(space.clientHeight, 60));
        }
        const base = canvas.clientWidth / canvas.clientHeight < 1.15
            ? Math.max(11.8, 10.8 * canvas.clientHeight / hero.clientWidth)
            : Math.min(8.4, Math.max(6.4, canvas.clientHeight / 75));
        return activeView === 'top' ? Math.max(base, 11) : base;
    }
    function setCamera(theta, phi, distance = radius()) {
        spherical.set(distance, phi, theta);
        camera.position.setFromSpherical(spherical).add(target);
        controls.target.copy(target);
        camera.lookAt(target);
    }
    function selectView(name, animate = true) {
        activeView = name;
        viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
        const destination = presets[name];
        if (!destination) return;
        autoRotate = false;
        rotateButton.setAttribute('aria-pressed', 'false');
        if (animate && !reducedMotion.matches) {
            const current = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
            // Follow the shortest arc rather than orbiting almost a full turn.
            const delta = Math.atan2(Math.sin(destination.theta - current.theta), Math.cos(destination.theta - current.theta));
            cameraTween = { start: performance.now(), theta: current.theta, phi: current.phi, radius: current.radius, endTheta: current.theta + delta, endPhi: destination.phi };
            controls.enabled = false;
        } else {
            cameraTween = null;
            setCamera(destination.theta, destination.phi);
            controls.enabled = true;
        }
        wake();
    }
    function replay() {
        autoRotate = false;
        rotateButton.setAttribute('aria-pressed', 'false');
        cameraTween = null;
        activeView = 'hero';
        viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === 'hero')));
        if (reducedMotion.matches) {
            interactiveButtons.forEach(button => { button.disabled = false; });
            car.position.z = 0;
            car.rotation.y = 0;
            selectView('hero', false);
            return;
        }
        intro = { start: performance.now() };
        controls.enabled = false;
        interactiveButtons.forEach(button => { button.disabled = true; });
        wake();
    }
    function keepSelectedCarVisible() {
        const picker = hero.querySelector('.showroom-car-picker');
        const selected = picker.querySelector('[aria-pressed="true"]');
        if (!selected || picker.scrollWidth <= picker.clientWidth) return;
        const box = picker.getBoundingClientRect();
        const button = selected.getBoundingClientRect();
        if (button.left < box.left + 5) picker.scrollLeft += button.left - box.left - 5;
        else if (button.right > box.right - 5) picker.scrollLeft += button.right - box.right + 5;
    }
    function resize() {
        keepSelectedCarVisible();
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Leave room for the glass controls while the road fills the whole stage.
        let offset = height * .1;
        if (hero.clientWidth <= 575) {
            const space = hero.querySelector('.showroom-mobile-space');
            offset = height / 2 - (space.offsetTop + space.clientHeight / 2);
        }
        camera.setViewOffset(width, height, 0, offset, width, height);
        camera.updateProjectionMatrix();
        if (!intro && !cameraTween) {
            const current = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
            setCamera(current.theta, current.phi);
        }
        wake();
    }
    function wake() {
        needsFrames = 80;
        if (frame === null && !rendering && visible && !document.hidden) {
            previousTime = performance.now();
            frame = requestAnimationFrame(tick);
        }
    }
    function tick(now) {
        frame = null;
        if (!visible || document.hidden || transferPausedAt !== null) return;
        rendering = true;
        const delta = Math.min((now - previousTime) / 1000, .05);
        previousTime = now;
        if (intro) {
            const t = Math.min((now - intro.start) / 2600, 1);
            const eased = 1 - (1 - t) ** 4;
            car.position.z = -19 * (1 - eased);
            car.rotation.y = 0;
            for (const wheel of car.children[0].userData.wheels || []) {
                wheel.pivot.rotation.x = 19 * eased / wheel.radius;
            }
            setCamera(presets.hero.theta, presets.hero.phi, radius() + 3 * (1 - eased));
            if (t === 1) {
                intro = null;
                controls.enabled = true;
                interactiveButtons.forEach(button => { button.disabled = false; });
            }
        } else if (cameraTween) {
            const t = Math.min((now - cameraTween.start) / 1000, 1);
            const eased = t * t * (3 - 2 * t);
            setCamera(THREE.MathUtils.lerp(cameraTween.theta, cameraTween.endTheta, eased), THREE.MathUtils.lerp(cameraTween.phi, cameraTween.endPhi, eased), THREE.MathUtils.lerp(cameraTween.radius, radius(), eased));
            if (t === 1) { cameraTween = null; controls.enabled = true; }
        } else {
            controls.autoRotate = autoRotate;
            controls.autoRotateSpeed = .7;
            controls.update(delta);
        }
        paint.color.lerp(paintTarget, reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 7));
        renderer.render(scene, camera);
        rendering = false;
        needsFrames--;
        if (intro || cameraTween || autoRotate || needsFrames > 0) frame = requestAnimationFrame(tick);
    }

    async function switchCar(id) {
        if (id === currentCar || switching) return;
        switching = true;
        autoRotate = false;
        controls.autoRotate = false;
        rotateButton.setAttribute('aria-pressed', 'false');
        interactiveButtons.forEach(button => { button.disabled = true; });
        hero.setAttribute('aria-busy', 'true');
        const loaderBox = hero.querySelector('.showroom-loader');
        loaderBox.hidden = false;
        hero.classList.add('is-switching');
        loadingText.textContent = 'در حال آماده‌سازی ' + cars[id].name;
        progress.style.setProperty('--progress', '4%');
        try {
            const nextModel = await loadModel(id);
            car.clear();
            car.add(nextModel);
            currentCar = id;
            refreshPaintPalette();
            paint.color.copy(paintTarget);
            driveStory?.setModel(id, nextModel);
            hero.dataset.car = id;
            hero.dataset.wheelCount = String(nextModel.userData.wheels.length);
            document.getElementById('showroom-title').textContent = cars[id].title;
            canvas.setAttribute('aria-label', 'نمای سه‌بعدی ' + cars[id].name + '؛ برای چرخش بکشید یا از کلیدهای جهت‌نما استفاده کنید');
            carButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.car === id)));
            keepSelectedCarVisible();
            document.getElementById('showroom-hint-text').textContent = 'برای دیدن از هر زاویه، خودرو را بچرخان';
            replay();
        } catch (error) {
            console.error('Car switch failed:', error);
            document.getElementById('showroom-hint-text').textContent = 'این خودرو بارگذاری نشد؛ دوباره انتخابش کنید.';
            interactiveButtons.forEach(button => { button.disabled = false; });
        } finally {
            switching = false;
            hero.classList.remove('is-switching');
            hero.removeAttribute('aria-busy');
            wake();
        }
    }
    carButtons.forEach(button => button.addEventListener('click', () => switchCar(button.dataset.car)));

    const paintSelections = new Map();
    function selectPaint(color, name, index = null) {
        paintTarget.set(color);
        hero.style.setProperty('--paint', color);
        paintButtons.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
        document.getElementById('paint-name').textContent = name;
        customPaint.value = color;
        customPaint.parentElement.classList.toggle('is-selected', index === null);
        document.getElementById('discover').style.setProperty('--drive-paint', color);
        const footer = document.querySelector('.site-footer');
        if (footer) {
            footer.style.setProperty('--footer-paint', color);
            footer.querySelector('[data-footer-car]').textContent = cars[currentCar].name;
            footer.querySelector('[data-footer-paint]').textContent = name;
        }
        paintSelections.set(currentCar, { color, name, index });
        wake();
    }
    function refreshPaintPalette() {
        const palette = paintPalettes[currentCar];
        paintButtons.forEach((button, i) => {
            const [name, color] = palette[i];
            button.dataset.paint = color;
            button.dataset.paintName = name;
            button.style.setProperty('--swatch', color);
            button.setAttribute('aria-label', name);
            button.title = name;
        });
        const saved = paintSelections.get(currentCar);
        if (saved) selectPaint(saved.color, saved.name, saved.index);
        else selectPaint(palette[0][1], palette[0][0], 0);
    }
    paintButtons.forEach((button, index) => button.addEventListener('click', () => selectPaint(button.dataset.paint, button.dataset.paintName, index)));
    customPaint.addEventListener('input', () => selectPaint(customPaint.value, 'رنگ دلخواه'));
    viewButtons.forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
    rotateButton.addEventListener('click', () => {
        autoRotate = !autoRotate;
        rotateButton.setAttribute('aria-pressed', String(autoRotate));
        activeView = null;
        viewButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
        wake();
    });
    replayButton.addEventListener('click', replay);
    controls.addEventListener('start', () => {
        autoRotate = false;
        controls.autoRotate = false;
        rotateButton.setAttribute('aria-pressed', 'false');
        activeView = null;
        viewButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
        wake();
    });
    controls.addEventListener('change', wake);
    controls.addEventListener('end', wake);
    canvas.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || !controls.enabled) return;
        event.preventDefault();
        const current = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
        if (event.key === 'ArrowLeft') current.theta -= .15;
        if (event.key === 'ArrowRight') current.theta += .15;
        if (event.key === 'ArrowUp') current.phi = Math.max(.15, current.phi - .1);
        if (event.key === 'ArrowDown') current.phi = Math.min(Math.PI / 2 - .025, current.phi + .1);
        setCamera(current.theta, current.phi);
        autoRotate = false;
        rotateButton.setAttribute('aria-pressed', 'false');
        viewButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
        wake();
    });
    reducedMotion.addEventListener('change', () => {
        if (reducedMotion.matches) {
            intro = null;
            cameraTween = null;
            autoRotate = false;
            car.position.z = 0;
            car.rotation.y = 0;
            interactiveButtons.forEach(button => { button.disabled = false; });
            selectView(activeView || 'hero', false);
        }
        wake();
    });
    new ResizeObserver(resize).observe(canvas.parentElement);
    new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) {
            if (intro && transferPausedAt === null) intro.start = performance.now();
            wake();
        } else {
            // Finish the hero paint blend before the shared model appears in the story.
            paint.color.copy(paintTarget);
            driveStory?.wake();
        }
    }, { rootMargin: '100px' }).observe(hero);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { if (intro && transferPausedAt === null) intro.start = performance.now(); wake(); }
    });
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        visible = false;
        if (frame !== null) cancelAnimationFrame(frame);
        showError(new Error('WebGL context was lost.'));
    });
    // Available for local asset QA and exported poster rendering.
    function syncSceneTheme() {
        const dark = document.documentElement.dataset.mode === 'dark';
        const environments = {
            desert: { fog: dark ? 0x283640 : 0xb4c0b9, light: 0xffe9e0, rim: 0xa8c9ff, fill: 0xffc2b5 },
            city: { fog: dark ? 0x1b293c : 0xa6bac7, light: 0xe3edff, rim: 0x81afff, fill: 0xe2deef },
            coast: { fog: dark ? 0x253d4d : 0xb8d6d7, light: 0xffeed2, rim: 0x90deef, fill: 0xffd8ad }
        };
        const environment = environments[currentEnvironment];
        scene.fog.density = currentEnvironment === 'desert' ? .022 : .013;
        landscape.setMode(currentEnvironment);
        landscape.setTheme(dark);
        scene.fog.color.set(environment.fog);
        key.color.set(environment.light);
        rim.color.set(environment.rim);
        fill.color.set(environment.fill);
        roadMaterial.color.set(dark ? 0x747e89 : 0xc1c8ce);
        laneMaterial.color.set(dark ? 0xc5ced1 : 0xe9e5d8);
        shadow.material.opacity = dark ? .35 : .2;
        wake();
    }
    environmentButtons.forEach(button => button.addEventListener('click', () => {
        if (currentEnvironment === button.dataset.environment) return;
        transitionEnvironment(hero, renderer, scene, camera, () => {
            currentEnvironment = button.dataset.environment;
            hero.dataset.environment = currentEnvironment;
            environmentButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            syncSceneTheme();
        }, reducedMotion.matches);
    }));
    new MutationObserver(syncSceneTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
    syncSceneTheme();
    refreshPaintPalette();
    paint.color.copy(paintTarget);
    driveStory = createDriveStory(THREE, RoomEnvironment, {
        hero, canvas,
        capture: () => {
            camera.updateMatrixWorld(true);
            const anchor = new THREE.Vector3(0, .65, 0).add(car.position).project(camera);
            return { eye: camera.position.clone(), aim: controls.target.clone(), translation: car.position.clone(), anchorY: (1 - anchor.y) * .5 };
        },
        setTransitioning: leaving => {
            if (leaving && transferPausedAt === null) {
                transferPausedAt = performance.now(); controls.enabled = false;
            } else if (!leaving && transferPausedAt !== null) {
                const pause = performance.now() - transferPausedAt;
                if (intro) intro.start += pause;
                if (cameraTween) cameraTween.start += pause;
                transferPausedAt = null;
                controls.enabled = !intro && !cameraTween;
                wake();
            }
        }
    });
    driveStory.setModel(currentCar, car.children[0]);
    hero.dataset.model = 'loaded';
    hero.dataset.car = currentCar;
    hero.dataset.wheelCount = String(car.children[0].userData.wheels.length);
    progress.style.setProperty('--progress', '100%');
    hero.classList.add('is-ready');
    interactiveButtons.forEach(button => { button.disabled = false; });
    setCamera(presets.hero.theta, presets.hero.phi);
    resize();
    replay();
}

initShowroom().catch(showError);
