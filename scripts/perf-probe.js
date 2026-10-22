// Opt-in real-renderer benchmark: open ?perf=1. No quality or FPS overrides.
const output = document.createElement('pre');
output.id = 'cars-perf-results';
output.style.cssText = 'position:fixed;inset:auto 8px 8px;z-index:9999;max-height:22vh;overflow:auto;background:#111e;color:#fff;font:11px monospace;padding:8px;direction:ltr;pointer-events:none';
document.body.append(output);
let current = null;
const results = [];
window.CarsPerf = {
    attach(renderer, name) {
        const render = renderer.render.bind(renderer), size = renderer.setSize.bind(renderer);
        renderer.setSize = (...args) => { if (current) current.resizeCalls++; return size(...args); };
        renderer.render = (...args) => {
            const start = performance.now();
            if (current && renderer.shadowMap.enabled && (renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate)) current.shadowUpdates++;
            const result = render(...args);
            if (current) { current.renders++; current.renderCpuMs += performance.now() - start; current[name]++; current.drawCalls += renderer.info.render.calls; current.triangles += renderer.info.render.triangles; }
            return result;
        };
    }
};
const originalRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () { if (current) current.layoutReads++; return originalRect.call(this); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(test) {
    const start = performance.now();
    while (!test()) { if (performance.now() - start > 90000) throw new Error('Readiness timeout'); await sleep(100); }
}
async function phase(name, work) {
    const intervals = [];
    const stats = { name, renders: 0, hero: 0, story: 0, shadowUpdates: 0, resizeCalls: 0, layoutReads: 0, renderCpuMs: 0, drawCalls: 0, triangles: 0 };
    let previous = 0, running = true;
    function sample(t) { if (!running) return; if (previous) intervals.push(t - previous); previous = t; requestAnimationFrame(sample); }
    current = stats; output.textContent = 'Running: ' + name; requestAnimationFrame(sample);
    const start = performance.now(); await work();
    stats.elapsedMs = +(performance.now() - start).toFixed(1); running = false; current = null;
    intervals.sort((a, b) => a - b);
    stats.frameP50Ms = +(intervals[Math.floor(intervals.length * .5)] || 0).toFixed(2);
    stats.frameP95Ms = +(intervals[Math.floor(intervals.length * .95)] || 0).toFixed(2);
    stats.fps = +(intervals.length * 1000 / intervals.reduce((a, b) => a + b, 0)).toFixed(1);
    stats.framesOver25Ms = intervals.filter(ms => ms > 25).length;
    stats.renderCpuMs = +stats.renderCpuMs.toFixed(2);
    results.push(stats);
}
async function sweep(from, to, duration = 1800) {
    const start = performance.now();
    await new Promise(resolve => {
        function move(now) {
            const t = Math.min(1, (now - start) / duration);
            scrollTo({ top: from + (to - from) * t, behavior: 'instant' });
            if (t < 1) requestAnimationFrame(move); else resolve();
        }
        requestAnimationFrame(move);
    });
}
async function smoke() {
    const checks = [];
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const models = new URLSearchParams(location.search).has('all') ? ['huracan', 'ferrari', 'bmw', 'porsche', 'nissan'] : ['porsche', 'nissan'];
    for (const id of models) {
        output.textContent = 'Checking features: ' + id;
        await waitFor(() => {
            scrollTo({ top: 0, behavior: 'instant' });
            return !document.querySelector('#showroom').classList.contains('is-handoff') && !document.querySelector('button[data-car="' + id + '"]').disabled;
        });
        document.querySelector('button[data-car="' + id + '"]').click();
        await waitFor(() => document.querySelector('#showroom').dataset.car === id && !document.querySelector('button[data-car="' + id + '"]').disabled);
        document.querySelectorAll('.paint-button')[1].click(); await sleep(1500);
        assert(document.querySelectorAll('.paint-button')[1].getAttribute('aria-pressed') === 'true', 'Paint selection');
        document.querySelector('[data-view="front"]').click(); await sleep(1200);
        assert(document.querySelector('[data-view="front"]').getAttribute('aria-pressed') === 'true', 'Front camera');
        document.querySelector('#showroom-rotate').click(); await sleep(600);
        assert(document.querySelector('#showroom-rotate').getAttribute('aria-pressed') === 'true', 'Auto rotate');
        document.querySelector('#showroom-rotate').click();
        const color = document.querySelector('#showroom-custom-paint');
        color.value = '#5a4477'; color.dispatchEvent(new Event('input', { bubbles: true })); await sleep(1500);
        assert(document.querySelector('#paint-name').textContent === 'رنگ دلخواه', 'Custom paint');
        const footerY = document.querySelector('#contact').getBoundingClientRect().top + scrollY;
        await sweep(0, footerY, 1400); await sleep(1500);
        assert(document.querySelector('#discover').dataset.car === id, 'Shared story model');
        assert(document.querySelector('.footer-selection').textContent.includes('رنگ دلخواه'), 'Footer paint sync');
        await sweep(footerY, 0, 1400); await sleep(1800);
        assert(!document.querySelector('#showroom').classList.contains('is-handoff'), 'Reverse handoff');
        assert(document.documentElement.scrollWidth <= innerWidth, 'Horizontal overflow');
        checks.push({ model: id, passed: ['palette', 'custom paint', 'front camera', 'auto rotate', 'story/footer sync', 'forward/reverse scroll', 'no overflow'] });
    }
    output.textContent = JSON.stringify({ complete: true, mode: 'smoke', viewport: [innerWidth, innerHeight], checks }, null, 2);
}
(async () => {
try {
    if (new URLSearchParams(location.search).get('perf') === 'visual') {
        const query = new URLSearchParams(location.search);
        await waitFor(() => { scrollTo({ top: 0, behavior: 'instant' }); return document.querySelector('button[data-car="nissan"]')?.disabled === false; });
        const model = query.get('model') || 'nissan';
        document.querySelector('button[data-car="' + model + '"]').click();
        await waitFor(() => document.querySelector('#showroom').dataset.car === model && !document.querySelector('button[data-car="' + model + '"]').disabled);
        await sleep(1600);
        output.hidden = true;
        output.textContent = JSON.stringify({ complete: true, mode: 'visual', model, viewport: [innerWidth, innerHeight] });
        return;
    }
    if (new URLSearchParams(location.search).get('perf') === 'smoke') { await smoke(); return; }
    const fpsTest = new URLSearchParams(location.search).get('perf') === 'fps';
    await waitFor(() => { scrollTo({ top: 0, behavior: 'instant' }); return document.querySelector('button[data-car="nissan"]')?.disabled === false; });
    document.querySelector('button[data-car="nissan"]').click();
    await waitFor(() => document.querySelector('#showroom').dataset.car === 'nissan' && !document.querySelector('button[data-car="nissan"]').disabled);
    await sleep(2000);
    if (fpsTest) {
        document.querySelector('#showroom-rotate').click();
        await phase('orbit-road', () => sleep(4000));
        document.querySelector('#showroom-rotate').click(); await sleep(300);
    }
    await phase('paint-settle', async () => { document.querySelectorAll('.paint-button')[1].click(); await sleep(3500); });
    await phase('hero-idle', () => sleep(2000));
    const y = selector => document.querySelector(selector).getBoundingClientRect().top + scrollY;
    const storyStart = y('#drive-step-0'), storyEnd = y('#drive-step-2');
    await sweep(0, storyStart, 1000); await sleep(1800);
    await phase('camera-scroll', () => sweep(storyStart, storyEnd));
    await sleep(1800);
    await phase('story-idle', () => sleep(2000));
    const footer = y('#contact');
    await phase('footer-forward', () => sweep(storyEnd, footer));
    await phase('footer-reverse', () => sweep(footer, storyEnd));
    await sleep(1800);
    output.textContent = JSON.stringify({ complete: true, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, model: 'nissan', results }, null, 2);
} catch (error) { output.textContent = JSON.stringify({ error: String(error), results }); }
finally { current = null; Element.prototype.getBoundingClientRect = originalRect; }
})();
