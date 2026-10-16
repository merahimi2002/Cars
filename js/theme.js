(() => {
    const root = document.documentElement;
    const palettes = { logo: ['#18191d', '#ff1f2a'], ocean: ['#142638', '#ff963f'], emerald: ['#123b33', '#af7d2c'], amethyst: ['#2d2145', '#9d7bdd'] };
    let state = { palette: 'logo', mode: 'light', colors: palettes.logo.slice() };
    try {
        const saved = JSON.parse(localStorage.getItem('cars-theme'));
        if (saved && ['light', 'dark'].includes(saved.mode)) state.mode = saved.mode;
        if (saved && Object.hasOwn(palettes, saved.palette)) {
            state.palette = saved.palette;
            state.colors = palettes[saved.palette].slice();
        } else if (saved && saved.palette === 'custom' && Array.isArray(saved.colors) && saved.colors.length === 2 && saved.colors.every(c => /^#[0-9a-f]{6}$/i.test(c))) {
            state.palette = 'custom'; state.colors = saved.colors;
        }
    } catch (_) { /* Storage is optional. */ }
    function apply() {
        root.dataset.mode = state.mode;
        state.colors.forEach((hex, i) => {
            const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16)).join(', ');
            root.style.setProperty(i === 0 ? '--first-color' : '--second-color', rgb);
            if (i === 0) root.style.setProperty('--surface-color', rgb);
        });
        const linear = state.colors[0].slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
        const luminance = linear.reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        root.style.setProperty('--surface-text', luminance > .179 ? '17, 18, 21' : '255, 255, 255');
    }
    apply();
    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('ThemeBoxSwitchInput');
        const inputs = [document.getElementById('firstColorInput'), document.getElementById('secondColorInput')];
        const buttons = document.querySelectorAll('[data-theme]');
        function sync() {
            apply();
            toggle.checked = state.mode === 'dark';
            inputs.forEach((input, i) => { input.value = state.colors[i]; });
            buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.palette)));
        }
        function update() {
            sync();
            try { localStorage.setItem('cars-theme', JSON.stringify(state)); } catch (_) { /* Storage is optional. */ }
        }
        toggle.addEventListener('change', () => { state.mode = toggle.checked ? 'dark' : 'light'; update(); });
        buttons.forEach(button => button.addEventListener('click', () => {
            state.palette = button.dataset.theme; state.colors = palettes[state.palette].slice(); update();
        }));
        inputs.forEach((input, i) => input.addEventListener('input', () => {
            state.palette = 'custom'; state.colors[i] = input.value; update();
        }));
        const picker = document.querySelector('.theme-picker');
        const trigger = picker.querySelector('summary');
        trigger.setAttribute('aria-expanded', String(picker.open));
        picker.addEventListener('toggle', () => {
            trigger.setAttribute('aria-expanded', String(picker.open));
        });
        document.addEventListener('click', event => {
            if (picker.open && !picker.contains(event.target)) picker.open = false;
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && picker.open) {
                picker.open = false;
                trigger.focus();
            }
        });
        document.getElementById('themeReset').addEventListener('click', () => {
            state = { palette: 'logo', mode: 'light', colors: palettes.logo.slice() };
            update();
        });
        sync();
    });
})();
