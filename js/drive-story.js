import { driveData } from './drive-data.js';

export function createDriveStory(THREE, RoomEnvironment, heroView) {
    const section = document.getElementById('discover');
    const visual = section.querySelector('.drive-visual');
    const canvas = section.querySelector('canvas');
    const footer = document.querySelector('.site-footer');
    const footerSlot = footer?.querySelector('.footer-car-slot');
    // The travelling WebGL canvas stays in one compositing layer. The footer
    // glass participates in that same stack, above the car, without reparenting it.
    if (footerSlot) footer.classList.add('has-live-car');
    let footerTravel = 0, displayedFooterTravel = 0;
    const steps = [...section.querySelectorAll('.drive-step')];
    const jumps = [...section.querySelectorAll('[data-drive-jump]')];
    const layout = section.querySelector('.drive-layout');
    const stats = section.querySelector('.drive-stats');
    const statNodes = [...section.querySelectorAll('[data-drive-stat]')];
    const jumpGroup = section.querySelector('.drive-jumps');
    const detailLabel = section.querySelector('[data-drive-detail]');
    const calloutLabel = section.querySelector('[data-drive-callout]');
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
    // Reuse scratch storage in the animation loop; keep cached layout reads
    // ahead of style writes and coalesce multiple scroll events into one frame.
    const scratch = Array.from({ length: 6 }, () => new THREE.Vector3());
    const travelRect = {};
    let footerFromRect, footerToRect, measurePending = false;
    let layoutMetrics = null;
    let renderWidth = 0, renderHeight = 0;
    let lastUiFade = null, lastUiLeaving = null;
    const shadowPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
    const shadowWheelAngles = [];
    function setRenderSize(width, height) {
        width = Math.max(1, Math.round(width)); height = Math.max(1, Math.round(height));
        if (width === renderWidth && height === renderHeight) return;
        renderer.setSize(width, height, false);
        renderWidth = width; renderHeight = height;
    }
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
        layoutMetrics = null;
        latest = { id, source };
        const data = driveData[id];
        section.dataset.car = id;
        section.querySelectorAll('[data-drive-name]').forEach(node => { node.textContent = data.name; });
        section.querySelector('[data-drive-word]').textContent = data.short;
        section.querySelector('[data-drive-edition]').textContent = data.edition;
        section.querySelector('[data-drive-engine]').textContent = data.engine;
        const labels = data.statLabels || [['قدرت موتور', 'اسب‌بخار متریک'], ['صفر تا صد', 'ثانیه'], ['حداکثر سرعت', 'کیلومتر بر ساعت']];
        section.querySelectorAll('.drive-stats > div').forEach((item, i) => {
            item.querySelector('dt').textContent = labels[i][0];
            item.querySelector('dd > span').textContent = labels[i][1];
        });
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
        model.traverse(node => { if (node.isMesh) node.castShadow = true; });
        scene.add(model);
        renderer.shadowMap.needsUpdate = true;
        shadowPosition.set(Infinity, Infinity, Infinity);
        shadowWheelAngles.length = 0;
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
            window.CarsPerf?.attach(renderer, 'story');
            renderer.setPixelRatio(Math.min(devicePixelRatio, mobile.matches ? 1.25 : 1.5));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.VSMShadowMap;
            renderer.shadowMap.autoUpdate = false;
            renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(34, 1, .1, 70);
            const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
            scene.environment = generator.fromScene(room, .06).texture;
            room.dispose(); generator.dispose();
            scene.add(new THREE.HemisphereLight(0xe5edff, 0x303847, 2));
            const key = new THREE.DirectionalLight(0xfff0df, 3); key.position.set(4, 7, 5);
            const rim = new THREE.DirectionalLight(0xa9cced, 2); rim.position.set(-4, 4, -3); key.castShadow = true;
            key.shadow.mapSize.set(1024, 1024);
            Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -7, near: .5, far: 24 });
            key.shadow.bias = -.0002; key.shadow.normalBias = .025;
            key.shadow.radius = 5; key.shadow.blurSamples = 8;
            scene.add(key, rim);
            // A transparent receiver anchors every model to the photographed floor.
            // Its projection follows the very same camera as the body and wheels.
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), new THREE.ShadowMaterial({ opacity: .26, depthWrite: false }));
            ground.rotation.x = -Math.PI / 2; ground.position.y = -.025;
            ground.receiveShadow = true; scene.add(ground);
            const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
            const context = shadowCanvas.getContext('2d'), gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
            gradient.addColorStop(0, '#000000b0'); gradient.addColorStop(.3, '#00000078'); gradient.addColorStop(.65, '#00000028'); gradient.addColorStop(1, '#00000000');
            context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
            const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
            shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.015; scene.add(shadow);
            installModel(); resize(); section.classList.add('drive-ready');
        } catch (error) {
            console.error('Detail view unavailable:', error);
            renderer?.dispose(); renderer = null; scene = null; model = null; shots = []; unavailable = true;
            section.classList.add('drive-unavailable');
        }
    }
    function measure() {
        measurePending = false;
        // Document-space geometry is stable while scrolling. Invalidate it on
        // resize, font/layout changes and model text changes, not every event.
        if (!layoutMetrics) {
            const visualRect = visual.getBoundingClientRect();
            const pinnedTop = parseFloat(getComputedStyle(visual).top) || 0;
            layoutMetrics = {
                centers: steps.map(step => { const r = step.getBoundingClientRect(); return r.top + scrollY + r.height / 2; }),
                statsTop: stats.getBoundingClientRect().top + scrollY
            };
            if (heroView) {
                const heroRect = heroView.hero.getBoundingClientRect();
                const source = heroView.canvas.getBoundingClientRect();
                const target = anchor.getBoundingClientRect();
                layoutMetrics.start = heroRect.top + scrollY;
                layoutMetrics.end = layout.getBoundingClientRect().top + scrollY - pinnedTop;
                startRect = { left: source.left, top: source.top - heroRect.top, width: source.width, height: source.height };
                endRect = { left: target.left, top: target.top - visualRect.top + pinnedTop, width: target.width, height: target.height };
            }
            if (footerSlot) {
                const footerRect = footer.getBoundingClientRect(), slot = footerSlot.getBoundingClientRect();
                layoutMetrics.footerTop = footerRect.top + scrollY;
                layoutMetrics.slotTop = slot.top + scrollY;
                footerToRect = { left: slot.left, top: slot.top, width: slot.width, height: slot.height };
            }
        }
        let travelStart = 0, travelEnd = 0;
        if (heroView) {
            const start = layoutMetrics.start, end = layoutMetrics.end;
            travelStart = start; travelEnd = end;
            const nextHandoff = clamp((scrollY - start) / Math.max(1, end - start), 0, 1);
            if (Math.abs(nextHandoff - handoff) > .0001) returning = nextHandoff < handoff;
            handoff = nextHandoff;
            if (handoff === 0 && displayedHandoff === 0) heroFrame = null;
            else if (!heroFrame) {
                heroFrame = heroView.capture();
                wheelCopies.forEach(wheel => { wheel.base = wheel.source.rotation.x; });
            }
        }
        if (footerSlot) {
            const footerTop = layoutMetrics.footerTop - scrollY;
            footerTravel = clamp((innerHeight - footerTop) / (innerHeight * .8), 0, 1);
            if (footerTravel > 0 || displayedFooterTravel > 0) footerFromRect = anchor.getBoundingClientRect();
            footerToRect.top = layoutMetrics.slotTop - scrollY;
        }
        entry = clamp((innerHeight - visual.getBoundingClientRect().top) / innerHeight, 0, 1);
        const focus = innerHeight * (mobile.matches ? .73 : .55);
        const centers = layoutMetrics.centers;
        if (heroView) {
            // The mobile heading and specs can extend beyond the handoff. Keep
            // the approach moving until the first detail camera actually starts.
            const parkedAt = travelStart + (travelEnd - travelStart) * .6;
            const detailsAt = Math.max(travelEnd, centers[0] - focus);
            approach = clamp((scrollY - parkedAt) / Math.max(1, detailsAt - parkedAt), 0, 1);
        }
        destination = centers.length - 1;
        for (let i = 0; i < centers.length - 1; i++) {
            if (focus + scrollY <= centers[i + 1]) { destination = i + clamp((focus + scrollY - centers[i]) / Math.max(1, centers[i + 1] - centers[i]), 0, 1); break; }
        }
        if (layoutMetrics.statsTop - scrollY < innerHeight * .95) hasRevealedStats = true;
        reveal = hasRevealedStats ? 1 : 0;
    }
    function resize() {
        layoutMetrics = null;
        if (heroView && heroFrame) heroFrame = heroView.capture();
        if (renderer) {
            const width = canvas.clientWidth, height = canvas.clientHeight;
            if (width && height) { setRenderSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }
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
        if (fade === lastUiFade && leaving === lastUiLeaving) return;
        lastUiFade = fade; lastUiLeaving = leaving;
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
        if (measurePending) measure();
        const dt = Math.min((now - (previous || now - 16)) / 1000, .05); previous = now;
        const damping = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
        position += (destination - position) * damping;
        displayedReveal += (reveal - displayedReveal) * damping;
        displayedEntry += (entry - displayedEntry) * damping;
        displayedHandoff += (handoff - displayedHandoff) * damping;
        displayedApproach += (approach - displayedApproach) * damping;
        displayedFooterTravel += (footerTravel - displayedFooterTravel) * damping;
        if (Math.abs(footerTravel - displayedFooterTravel) < .0001) displayedFooterTravel = footerTravel;
        if (Math.abs(handoff - displayedHandoff) < .0001) displayedHandoff = handoff;
        if (displayedHandoff === 0) heroFrame = null;
        syncHeroUi();
        // Reveal frame labels only when their section has reached the parked car.
        // Otherwise they scroll through the stationary car during the handoff.
        const interfaceReveal = heroView && !reduced.matches ? ease(clamp((displayedHandoff - .94) / .06, 0, 1)) : 1;
        visual.style.setProperty('--drive-interface-opacity', String(interfaceReveal));
        jumpGroup.inert = interfaceReveal < .99;
        const index = clamp(Math.round(position), 0, steps.length - 1);
        if (index !== lastStep) {
            lastStep = index;
            steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
            jumps.forEach((jump, i) => { if (i === index) jump.setAttribute('aria-current', 'step'); else jump.removeAttribute('aria-current'); });
            detailLabel.textContent = ['نمای کلی', 'رینگ و لاستیک', 'امضای چراغ‌ها', 'فضای راننده', 'انتخاب تو'][index];
            calloutLabel.textContent = detailLabel.textContent;
            section.dataset.step = String(index);
        }
        section.style.setProperty('--drive-progress', String(position / 4));
        if (latest) {
            const text = driveData[latest.id].stats.map((value, i) => format(i === 1 ? value * ease(displayedReveal) : Math.round(value * ease(displayedReveal)))).join('|');
            if (text !== statsText) { statsText = text; const values = text.split('|'); statNodes.forEach((node, i) => { node.textContent = values[i]; }); }
        }
        if (renderer && shots.length) {
            // First unwind detail close-ups to the parked overview; then reverse
            // the shared body/wheel path. A fast upward scroll must not carry a
            // zoomed-in camera into the growing transfer canvas.
            const overview = heroView && !reduced.matches ? ease(clamp((displayedHandoff - .6) / .4, 0, 1)) : 1;
            const shotPosition = position * overview;
            const i = Math.min(3, Math.floor(shotPosition)), t = ease(shotPosition - i), a = shots[i], b = shots[i + 1];
            const eye = scratch[0].fromArray(a.eye).lerp(scratch[1].fromArray(b.eye), t);
            const aim = scratch[2].fromArray(a.aim).lerp(scratch[3].fromArray(b.aim), t);
            camera.clearViewOffset();
            camera.aspect = endRect ? endRect.width / endRect.height : canvas.clientWidth / canvas.clientHeight;
            look.copy(aim); camera.position.copy(eye);
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
            const endAnchor = scratch[0].set(0, .65, 0).project(camera);
            const footerActive = !!footerSlot && displayedFooterTravel > .0001 && displayedHandoff >= .999;
            canvas.classList.toggle('is-footer-background', footerActive);
            edgeBlur.classList.toggle('is-footer-background', footerActive);
            const transferring = heroFrame && displayedHandoff > 0 && displayedHandoff < 1 && !reduced.matches;
            if (transferring) {
                const blend = arrival(displayedHandoff);
                if (!travelling) {
                    document.body.append(canvas, edgeBlur);
                    canvas.classList.add('drive-canvas-travelling'); edgeBlur.classList.add('is-travelling'); travelling = true;
                }
                const rect = travelRect;
                for (const key of ['left', 'top', 'width', 'height']) rect[key] = THREE.MathUtils.lerp(startRect[key], endRect[key], blend);
                for (const key of ['left', 'top', 'width', 'height']) {
                    canvas.style[key] = rect[key] + 'px'; edgeBlur.style[key] = rect[key] + 'px';
                }
                setRenderSize(rect.width, rect.height);
                camera.aspect = rect.width / rect.height;
                camera.position.lerp(heroFrame.eye, 1 - blend); look.lerp(heroFrame.aim, 1 - blend);
                model.position.copy(latest.source.position).addScaledVector(heroFrame.translation, 1 - blend);
                // Keep a single projected centre throughout the move. Interpolating
                // view offsets and aspect alone makes low cars dip near the finish.
                camera.lookAt(look); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
                const point = scratch[1].set(0, .65, 0).addScaledVector(heroFrame.translation, 1 - blend).project(camera);
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
                if (displayedFooterTravel === 0) dockCanvas();
                model.position.copy(latest.source.position);
                if (heroView) heroView.canvas.style.opacity = reduced.matches || handoff === 0 ? '' : '0';
                if (endRect && displayedFooterTravel === 0) setRenderSize(endRect.width, endRect.height);
            }
            // Distance / radius gives axle rotation. Absolute scroll progress
            // makes reverse scrolling retrace the wheels without accumulated drift.
            wheelCopies.forEach(wheel => {
                const distance = (mobile.matches ? 2.8 : 5.8) + (heroFrame?.translation.length() || 0);
                wheel.pivot.rotation.x = wheel.base + (reduced.matches ? 0 : (distance * arrival(displayedHandoff) + 4 * ease(displayedFooterTravel)) / wheel.radius);
            });
            if (footerSlot && displayedFooterTravel > 0 && displayedHandoff >= .999) {
                const blend = reduced.matches ? 1 : ease(displayedFooterTravel);
                const from = footerFromRect, to = footerToRect;
                // Preserve the source's projected centre before changing aspect.
                const hub = scratch[0].set(0, .65, 0);
                camera.updateProjectionMatrix(); camera.lookAt(look); camera.updateMatrixWorld(true);
                const sourceAnchor = scratch[1].copy(hub).project(camera);
                if (!travelling) {
                    document.body.append(canvas, edgeBlur);
                    canvas.classList.add('drive-canvas-travelling'); edgeBlur.classList.add('is-travelling'); travelling = true;
                }
                const rect = travelRect;
                for (const key of ['left', 'top', 'width', 'height']) {
                    rect[key] = THREE.MathUtils.lerp(from[key], to[key], blend);
                    canvas.style[key] = edgeBlur.style[key] = rect[key] + 'px';
                }
                canvas.style.opacity = '1'; edgeBlur.style.opacity = '1';
                setRenderSize(rect.width, rect.height);
                camera.aspect = rect.width / rect.height;
                const footerLook = scratch[2].set(0, .65, 0);
                const footerEye = scratch[3].set(-5.8, 1.9, 5.3);
                footerEye.sub(footerLook).multiplyScalar(Math.max(1, 1.15 / camera.aspect) * (mobile.matches ? 1.2 : 1)).add(footerLook);
                // Orbit around the nose rather than lerping straight through the body.
                // This scroll-driven arc reverses exactly when scrolling upward.
                const startOffset = scratch[4].copy(camera.position).sub(look);
                const endOffset = scratch[5].copy(footerEye).sub(footerLook);
                const startAngle = Math.atan2(startOffset.x, startOffset.z);
                const endAngle = Math.atan2(endOffset.x, endOffset.z);
                const angle = THREE.MathUtils.lerp(startAngle, endAngle, blend);
                const radius = THREE.MathUtils.lerp(Math.hypot(startOffset.x, startOffset.z), Math.hypot(endOffset.x, endOffset.z), blend);
                const height = THREE.MathUtils.lerp(startOffset.y, endOffset.y, blend);
                look.lerp(footerLook, blend);
                camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius).add(look);
                // Interpolate projected scale, rather than independently growing
                // the canvas and moving the camera (which produces a zoom lurch).
                const distancePerPixel = THREE.MathUtils.lerp(startOffset.length() / from.height, endOffset.length() / to.height, blend);
                camera.position.sub(look).setLength(distancePerPixel * rect.height).add(look);
                camera.clearViewOffset(); camera.lookAt(look);
                camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
                const projected = hub.project(camera);
                const sourceX = from.left + (sourceAnchor.x + 1) * .5 * from.width;
                const sourceY = from.top + (1 - sourceAnchor.y) * .5 * from.height;
                const desiredX = THREE.MathUtils.lerp(sourceX, to.left + to.width / 2, blend);
                const desiredY = THREE.MathUtils.lerp(sourceY, to.top + to.height / 2, blend);
                camera.setViewOffset(rect.width, rect.height,
                    (projected.x + 1) * .5 * rect.width - (desiredX - rect.left),
                    (1 - projected.y) * .5 * rect.height - (desiredY - rect.top),
                    rect.width, rect.height);
            }
            camera.updateProjectionMatrix(); camera.lookAt(look);
            // A camera move does not change light-space depth. Refresh only
            // when a caster moves (body travel, rolling wheels, or a new model).
            let shadowDirty = !shadowPosition.equals(model.position);
            shadowPosition.copy(model.position);
            wheelCopies.forEach((wheel, i) => {
                if (shadowWheelAngles[i] !== wheel.pivot.rotation.x) shadowDirty = true;
                shadowWheelAngles[i] = wheel.pivot.rotation.x;
            });
            if (shadowDirty) renderer.shadowMap.needsUpdate = true;
            renderer.render(scene, camera);
        }
        if (Math.abs(destination - position) > .0002 || Math.abs(reveal - displayedReveal) > .0002 || Math.abs(entry - displayedEntry) > .0002 || Math.abs(approach - displayedApproach) > .0002 || displayedHandoff !== handoff || displayedFooterTravel !== footerTravel) wake();
    }
    addEventListener('scroll', () => { if (active) { measurePending = true; wake(); } }, { passive: true });
    addEventListener('resize', resize, { passive: true });
    mobile.addEventListener('change', () => { positionHeading(); resize(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { measure(); wake(); } });
    reduced.addEventListener('change', () => { measure(); wake(); });
    jumps.forEach((jump, i) => jump.addEventListener('click', event => {
        event.preventDefault(); steps[i].scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    }));
    const layoutObserver = new ResizeObserver(resize);
    layoutObserver.observe(visual);
    layoutObserver.observe(section);
    if (footer) layoutObserver.observe(footer);
    if (document.fonts) document.fonts.ready.then(() => { layoutMetrics = null; measurePending = true; wake(); });
    const visibleSections = new Set();
    const visibilityObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) visibleSections.add(entry.target); else visibleSections.delete(entry.target); });
        active = visibleSections.size > 0;
        if (active) { initialize(); measure(); previous = 0; wake(); }
        else {
            measure(); displayedHandoff = handoff; dockCanvas();
            syncHeroUi();
            if (heroView) heroView.canvas.style.opacity = '';
            if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
        }
    }, { rootMargin: '100% 0px' });
    visibilityObserver.observe(section);
    if (footer) visibilityObserver.observe(footer);
    return { setModel, wake };
}
