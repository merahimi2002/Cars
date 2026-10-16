// Dissolve the previous rendered frame over the new environment without moving the car.
export async function transitionEnvironment(hero, renderer, scene, camera, change, reducedMotion) {
    hero.querySelectorAll('.environment-frame, .environment-sky-frame').forEach(layer => layer.remove());
    if (reducedMotion) { change(); return; }
    const stage = hero.querySelector('.showroom-stage');
    const sky = hero.querySelector('.showroom-sky');
    const skyFrame = sky.cloneNode(false);
    skyFrame.classList.add('environment-sky-frame');
    skyFrame.style.background = getComputedStyle(sky).background;
    hero.append(skyFrame);
    renderer.render(scene, camera);
    const frame = new Image();
    frame.className = 'environment-frame';
    frame.alt = '';
    frame.setAttribute('aria-hidden', 'true');
    try { frame.src = renderer.domElement.toDataURL('image/png'); }
    catch { skyFrame.remove(); change(); return; }
    stage.append(frame);
    await frame.decode().catch(() => {});
    if (!frame.isConnected) { skyFrame.remove(); return; }
    change();
    hero.dataset.environmentTransition = 'running';
    const options = { duration: 850, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' };
    const animation = frame.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(3px)' }], options);
    skyFrame.animate([{ opacity: 1 }, { opacity: 0 }], options);
    animation.finished.catch(() => {}).then(() => {
        frame.remove(); skyFrame.remove();
        if (!hero.querySelector('.environment-frame')) hero.dataset.environmentTransition = 'idle';
    });
}
