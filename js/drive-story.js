import { driveData } from './drive-data.js';

export function createDriveStory(THREE, RoomEnvironment, heroView) {
    const section = document.getElementById('discover');
    const visual = section.querySelector('.drive-visual');
    const canvas = section.querySelector('canvas');
    const steps = [...section.querySelectorAll('.drive-step')];
    const jumps = [...section.querySelectorAll('[data-drive-jump]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 767px)');
    const heading = section.querySelector('.drive-header');
    const narrative = section.querySelector('.drive-narrative');
    function positionHeading() {
        // On mobile the car gets its own sticky lane above all story copy.
        // The heading scrolls beneath that lane instead of across the car's path.
        if (mobile.matches) narrative.prepend(heading);
        else section.prepend(heading);
    }
    positionHeading();
    const heroUi = heroView ? [...heroView.hero.querySelectorAll('.showroom-controls, .showroom-hint, .showroom-car-picker, .environment-picker, .showroom-title, .showroom-subtitle')] : [];
    // A layout anchor lets the same detail canvas travel outside its section,
    // then settle back into the sticky frame without changing its projection.
    const anchor = document.createElement('span');
    anchor.className = 'drive-canvas'; anchor.setAttribute('aria-hidden', 'true');
    canvas.before(anchor);
    // Blur only the feathered border using the existing composited frame.
    // No second WebGL render or full-car blur is needed.
    const edgeBlur = document.createElement('div');
    edgeBlur.className = 'drive-edge-blur'; edgeBlur.setAttribute('aria-hidden', 'true');
    canvas.after(edgeBlur);
    let handoff = 0, displayedHandoff = 0, heroFrame = null, travelling = false;
    let approach = 0, displayedApproach = 0;
    let returning = false;
    let startRect, endRect;
    let renderer, scene, camera, model, latest, active = false, frame = null;
    let position = 0, destination = 0, previous = 0, reveal = 0, displayedReveal = 0, entry = 0, displayedEntry = 0;
    let lastStep = -1, statsText = '', shots = [];
    let wheelCopies = [];
    const clonedNodes = new Map();
    let hasRevealedStats = false;
    let unavailable = false;
    const look = new THREE.Vector3();
    const clamp = THREE.MathUtils.clamp;
    const ease = t => t * t * (3 - 2 * t);
    // Body placement, camera framing and axle travel share one arrival clock.
    // Once parked, nothing keeps descending or rolling while the section catches up.
    const arrival = progress => ease(clamp(progress / .6, 0, 1));
    const format = value => value.toLocaleString('fa-IR', { maximumFractionDigits: 1 });

    function cloneVisual(source) {
        // Reuse loaded geometry/textures; don't fetch or decode any model twice.
        const copy = source.isMesh ? new THREE.Mesh(source.geometry, source.material) : new THREE.Group();
        clonedNodes.set(source, copy);
        copy.position.copy(source.position); copy.quaternion.copy(source.quaternion); copy.scale.copy(source.scale);
        copy.visible = source.visible;
        for (const child of source.children) copy.add(cloneVisual(child));
        return copy;
    }
    function setModel(id, source) {
        latest = { id, source };
        const data = driveData[id];
        section.dataset.car = id;
        section.querySelectorAll('[data-drive-name]').forEach(node => { node.textContent = data.name; });
        section.querySelector('[data-drive-word]').textContent = data.short;
        section.querySelector('[data-drive-edition]').textContent = data.edition;
        section.querySelector('[data-drive-engine]').textContent = data.engine;
        for (const field of ['lead', 'wheel', 'lights', 'cabin', 'note']) section.querySelector('[data-drive-' + field + ']').textContent = data[field];
        section.querySelectorAll('[data-drive-stat]').forEach((node, i) => { node.setAttribute('aria-label', format(data.stats[i])); });
        canvas.setAttribute('aria-label', 'جزئیات سه‌بعدی ' + data.name);
        displayedReveal = 0; statsText = ''; hasRevealedStats = false;
        if (renderer) installModel();
        measure(); wake();
    }
    function installModel() {
        if (model) scene.remove(model);
        clonedNodes.clear();
        model = cloneVisual(latest.source);
        wheelCopies = (latest.source.userData.wheels || []).map(wheel => ({
            pivot: clonedNodes.get(wheel.pivot), radius: wheel.radius, source: wheel.pivot, base: wheel.pivot.rotation.x
        })).filter(wheel => wheel.pivot);
        scene.add(model);
        const hub = latest.source.userData.wheels?.find(wheel => wheel.center.x > 0 && wheel.center.z > 0)?.center;
        const wheel = hub ? hub.clone() : new THREE.Vector3(1.05, .45, 1.5);
        shots = [
            { eye: [9.4, 2.5, .6], aim: [0, .65, 0] },
            { eye: [wheel.x + 2.6, wheel.y + .7, wheel.z + 1.3], aim: wheel.toArray() },
            { eye: [3.1, 1.9, 5.5], aim: [.6, .65, 2.25] },
            { eye: [3, 3.5, .7], aim: [0, 1, -.1] },
            { eye: [7.1, 3, 7.1], aim: [0, .65, 0] }
        ];
        scene.updateMatrixWorld(true);
    }
    function initialize() {
        if (renderer || !latest || unavailable) return;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
            renderer.setPixelRatio(Math.min(devicePixelRatio, mobile.matches ? 1.25 : 1.5));
            renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(34, 1, .1, 70);
            const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
            scene.environment = generator.fromScene(room, .06).texture;
            room.dispose(); generator.dispose();
            scene.add(new THREE.HemisphereLight(0xe5edff, 0x303847, 2));
            const key = new THREE.DirectionalLight(0xfff0df, 3); key.position.set(4, 7, 5);
            const rim = new THREE.DirectionalLight(0xa9cced, 2); rim.position.set(-4, 4, -3); scene.add(key, rim);
            const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
            const context = shadowCanvas.getContext('2d'), gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
            gradient.addColorStop(0, '#00000065'); gradient.addColorStop(.5, '#00000035'); gradient.addColorStop(1, '#00000000');
            context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
            const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
            shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.03; scene.add(shadow);
            installModel(); resize(); section.classList.add('drive-ready');
        } catch (error) {
            console.error('Detail view unavailable:', error);
            renderer?.dispose(); renderer = null; scene = null; model = null; shots = []; unavailable = true;
            section.classList.add('drive-unavailable');
        }
    }
    function measure() {
        let travelStart = 0, travelEnd = 0;
        if (heroView) {
            const heroRect = heroView.hero.getBoundingClientRect();
            const source = heroView.canvas.getBoundingClientRect();
            const target = anchor.getBoundingClientRect();
            const layout = section.querySelector('.drive-layout').getBoundingClientRect();
            const start = heroRect.top + scrollY;
            const end = layout.top + scrollY;
            travelStart = start; travelEnd = end;
            const nextHandoff = clamp((scrollY - start) / Math.max(1, end - start), 0, 1);
            if (Math.abs(nextHandoff - handoff) > .0001) returning = nextHandoff < handoff;
            handoff = nextHandoff;
            startRect = { left: source.left, top: source.top - heroRect.top, width: source.width, height: source.height };
            endRect = { left: target.left, top: target.top - visual.getBoundingClientRect().top, width: target.width, height: target.height };
            if (handoff === 0 && displayedHandoff === 0) heroFrame = null;
            else if (!heroFrame) {
                heroFrame = heroView.capture();
                wheelCopies.forEach(wheel => { wheel.base = wheel.source.rotation.x; });
            }
        }
        entry = clamp((innerHeight - visual.getBoundingClientRect().top) / innerHeight, 0, 1);
        const focus = innerHeight * (mobile.matches ? .73 : .55);
        const centers = steps.map(step => { const rect = step.getBoundingClientRect(); return rect.top + rect.height / 2; });
        if (heroView) {
            // The mobile heading and specs can extend beyond the handoff. Keep
            // the approach moving until the first detail camera actually starts.
            const parkedAt = travelStart + (travelEnd - travelStart) * .6;
            const detailsAt = Math.max(travelEnd, centers[0] + scrollY - focus);
            approach = clamp((scrollY - parkedAt) / Math.max(1, detailsAt - parkedAt), 0, 1);
        }
        destination = centers.length - 1;
        for (let i = 0; i < centers.length - 1; i++) {
            if (focus <= centers[i + 1]) { destination = i + clamp((focus - centers[i]) / Math.max(1, centers[i + 1] - centers[i]), 0, 1); break; }
        }
        if (section.querySelector('.drive-stats').getBoundingClientRect().top < innerHeight * .95) hasRevealedStats = true;
        reveal = hasRevealedStats ? 1 : 0;
    }
    function resize() {
        if (heroView && heroFrame) heroFrame = heroView.capture();
        if (renderer) {
            const width = canvas.clientWidth, height = canvas.clientHeight;
            if (width && height) { renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
        }
        measure(); wake();
    }
    function dockCanvas() {
        if (travelling) {
            anchor.after(canvas); canvas.classList.remove('drive-canvas-travelling'); canvas.removeAttribute('style'); travelling = false;
            canvas.after(edgeBlur); edgeBlur.classList.remove('is-travelling'); edgeBlur.removeAttribute('style');
        }
    }
    function syncHeroUi() {
        if (!heroView) return;
        const progress = Math.max(handoff, displayedHandoff);
        const leaving = progress > .0001;
        // On return, controls follow the final crossfade back to the hero.
        // Keep interaction locked until both body and wheels have settled.
        const fade = ease(clamp(progress / (returning ? .065 : .025), 0, 1));
        heroView.hero.classList.toggle('is-handoff', leaving);
        heroUi.forEach(node => {
            node.inert = leaving;
            node.style.opacity = fade === 0 ? '' : String(1 - fade);
            node.style.visibility = fade === 1 ? 'hidden' : '';
        });
        heroView.canvas.inert = leaving;
        heroView.setTransitioning(leaving);
    }
    function wake() {
        if (frame === null && active && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function tick(now) {
        frame = null;
        if (!active || document.hidden) return;
        const dt = Math.min((now - (previous || now - 16)) / 1000, .05); previous = now;
        const damping = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
        position += (destination - position) * damping;
        displayedReveal += (reveal - displayedReveal) * damping;
        displayedEntry += (entry - displayedEntry) * damping;
        displayedHandoff += (handoff - displayedHandoff) * damping;
        displayedApproach += (approach - displayedApproach) * damping;
        if (Math.abs(handoff - displayedHandoff) < .0001) displayedHandoff = handoff;
        if (displayedHandoff === 0) heroFrame = null;
        syncHeroUi();
        // Reveal frame labels only when their section has reached the parked car.
        // Otherwise they scroll through the stationary car during the handoff.
        const interfaceReveal = heroView && !reduced.matches ? ease(clamp((displayedHandoff - .94) / .06, 0, 1)) : 1;
        visual.style.setProperty('--drive-interface-opacity', String(interfaceReveal));
        section.querySelector('.drive-jumps').inert = interfaceReveal < .99;
        const index = clamp(Math.round(position), 0, steps.length - 1);
        if (index !== lastStep) {
            lastStep = index;
            steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
            jumps.forEach((jump, i) => { if (i === index) jump.setAttribute('aria-current', 'step'); else jump.removeAttribute('aria-current'); });
            section.querySelector('[data-drive-detail]').textContent = ['نمای کلی', 'رینگ و لاستیک', 'امضای چراغ‌ها', 'فضای راننده', 'انتخاب تو'][index];
            section.querySelector('[data-drive-callout]').textContent = ['نمای کلی', 'رینگ و لاستیک', 'امضای چراغ‌ها', 'فضای راننده', 'انتخاب تو'][index];
            section.dataset.step = String(index);
        }
        section.style.setProperty('--drive-progress', String(position / 4));
        if (latest) {
            const text = driveData[latest.id].stats.map((value, i) => format(i === 1 ? value * ease(displayedReveal) : Math.round(value * ease(displayedReveal)))).join('|');
            if (text !== statsText) { statsText = text; section.querySelectorAll('[data-drive-stat]').forEach((node, i) => { node.textContent = text.split('|')[i]; }); }
        }
        if (renderer && shots.length) {
            // First unwind detail close-ups to the parked overview; then reverse
            // the shared body/wheel path. A fast upward scroll must not carry a
            // zoomed-in camera into the growing transfer canvas.
            const overview = heroView && !reduced.matches ? ease(clamp((displayedHandoff - .6) / .4, 0, 1)) : 1;
            const shotPosition = position * overview;
            const i = Math.min(3, Math.floor(shotPosition)), t = ease(shotPosition - i), a = shots[i], b = shots[i + 1];
            const eye = a.eye.map((value, axis) => THREE.MathUtils.lerp(value, b.eye[axis], t));
            const aim = a.aim.map((value, axis) => THREE.MathUtils.lerp(value, b.aim[axis], t));
            camera.clearViewOffset();
            camera.aspect = endRect ? endRect.width / endRect.height : canvas.clientWidth / canvas.clientHeight;
            look.fromArray(aim); camera.position.fromArray(eye);
            // Keep the full car inside narrow screens; close-ups retain their framing.
            const wide = Math.max(1, 1.22 / camera.aspect);
            const overviewWeight = 1 - ease(clamp(shotPosition, 0, 1)) + ease(clamp(shotPosition - 3, 0, 1));
            // After the wheels park, use the rest of the handoff for a gentle
            // camera push into the story. It joins the first detail shot without
            // restarting body movement or spinning stationary wheels.
            const approachFit = heroView && !reduced.matches ? 1 + .12 * (1 - ease(displayedApproach)) : 1;
            const fit = (1 + (wide - 1) * (.2 + .8 * overviewWeight)) * approachFit;
            camera.position.sub(look).multiplyScalar(fit).add(look);
            camera.lookAt(look); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
            const endAnchor = new THREE.Vector3(0, .65, 0).project(camera);
            const transferring = heroFrame && displayedHandoff > 0 && displayedHandoff < 1 && !reduced.matches;
            if (transferring) {
                const blend = arrival(displayedHandoff);
                if (!travelling) {
                    document.body.append(canvas, edgeBlur);
                    canvas.classList.add('drive-canvas-travelling'); edgeBlur.classList.add('is-travelling'); travelling = true;
                }
                const rect = {};
                for (const key of ['left', 'top', 'width', 'height']) rect[key] = THREE.MathUtils.lerp(startRect[key], endRect[key], blend);
                for (const key of ['left', 'top', 'width', 'height']) {
                    canvas.style[key] = rect[key] + 'px'; edgeBlur.style[key] = rect[key] + 'px';
                }
                renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
                camera.aspect = rect.width / rect.height;
                camera.position.lerp(heroFrame.eye, 1 - blend); look.lerp(heroFrame.aim, 1 - blend);
                model.position.copy(latest.source.position).addScaledVector(heroFrame.translation, 1 - blend);
                // Keep a single projected centre throughout the move. Interpolating
                // view offsets and aspect alone makes low cars dip near the finish.
                camera.lookAt(look); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
                const point = new THREE.Vector3(0, .65, 0).addScaledVector(heroFrame.translation, 1 - blend).project(camera);
                const startY = startRect.top + heroFrame.anchorY * startRect.height;
                const endY = endRect.top + (1 - endAnchor.y) * .5 * endRect.height;
                const desiredY = THREE.MathUtils.lerp(startY, endY, blend);
                const offset = (1 - point.y) * .5 * rect.height - (desiredY - rect.top);
                camera.setViewOffset(rect.width, rect.height, 0, offset, rect.width, rect.height);
                const opacity = ease(clamp((displayedHandoff - .025) / .055, 0, 1));
                canvas.style.opacity = String(opacity);
                // Clear the blur before hero controls start fading back in.
                edgeBlur.style.opacity = String(opacity * ease(clamp((displayedHandoff - .065) / .045, 0, 1)));
                heroView.canvas.style.opacity = String(1 - opacity);
            } else {
                dockCanvas();
                model.position.copy(latest.source.position);
                if (heroView) heroView.canvas.style.opacity = reduced.matches || handoff === 0 ? '' : '0';
                if (endRect) renderer.setSize(Math.round(endRect.width), Math.round(endRect.height), false);
            }
            // Distance / radius gives axle rotation. Absolute scroll progress
            // makes reverse scrolling retrace the wheels without accumulated drift.
            wheelCopies.forEach(wheel => {
                const distance = (mobile.matches ? 2.8 : 5.8) + (heroFrame?.translation.length() || 0);
                wheel.pivot.rotation.x = wheel.base + (reduced.matches ? 0 : distance * arrival(displayedHandoff) / wheel.radius);
            });
            camera.updateProjectionMatrix(); camera.lookAt(look);
            renderer.render(scene, camera);
        }
        if (Math.abs(destination - position) > .0002 || Math.abs(reveal - displayedReveal) > .0002 || Math.abs(entry - displayedEntry) > .0002 || Math.abs(approach - displayedApproach) > .0002 || displayedHandoff !== handoff) wake();
    }
    addEventListener('scroll', () => { if (active) { measure(); wake(); } }, { passive: true });
    addEventListener('resize', resize, { passive: true });
    mobile.addEventListener('change', () => { positionHeading(); resize(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { measure(); wake(); } });
    reduced.addEventListener('change', () => { measure(); wake(); });
    jumps.forEach((jump, i) => jump.addEventListener('click', event => {
        event.preventDefault(); steps[i].scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    }));
    new ResizeObserver(resize).observe(visual);
    new IntersectionObserver(entries => {
        active = entries[0].isIntersecting;
        if (active) { initialize(); measure(); previous = 0; wake(); }
        else {
            measure(); displayedHandoff = handoff; dockCanvas();
            syncHeroUi();
            if (heroView) heroView.canvas.style.opacity = '';
            if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
        }
    }, { rootMargin: '100% 0px' }).observe(section);
    return { setModel, wake };
}
