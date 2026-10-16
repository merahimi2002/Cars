const navbar = document.querySelector('.Navbar-class');
if (navbar) {
    const syncNavbarHeight = () => {
        const height = Math.ceil(navbar.getBoundingClientRect().height) + 'px';
        if (document.documentElement.style.getPropertyValue('--navbar-height') !== height) {
            document.documentElement.style.setProperty('--navbar-height', height);
        }
    };
    syncNavbarHeight();
    new ResizeObserver(syncNavbarHeight).observe(navbar);
    const syncNavbarSurface = () => navbar.classList.toggle('is-scrolled', scrollY > 24);
    syncNavbarSurface();
    addEventListener('scroll', syncNavbarSurface, { passive: true });
}

const menuButton = document.querySelector('.first-button');
if (menuButton) {
    const menu = document.getElementById('navbarSupportedContent');
    menu.addEventListener('shown.bs.collapse', () => menuButton.querySelector('.animated-icon1').classList.add('open'));
    menu.addEventListener('hidden.bs.collapse', () => menuButton.querySelector('.animated-icon1').classList.remove('open'));
}

const navigationLinks = [...document.querySelectorAll('.navbar-nav .nav-link')];
document.querySelectorAll('.navbar-nav a[href^="#"], .site-footer a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
        const target = document.getElementById(link.getAttribute('href').slice(1));
        if (!target) return;
        event.preventDefault();
        const menu = document.getElementById('navbarSupportedContent');
        if (window.bootstrap) {
            const collapse = bootstrap.Collapse.getOrCreateInstance(menu, { toggle: false });
            if (menu.classList.contains('collapsing') && menuButton?.getAttribute('aria-expanded') === 'true') {
                menu.addEventListener('shown.bs.collapse', () => collapse.hide(), { once: true });
            } else if (menu.classList.contains('show')) collapse.hide();
        }
        navigationLinks.forEach(item => {
            const selected = item.getAttribute('href') === link.getAttribute('href');
            item.parentElement.classList.toggle('active', selected);
            if (selected) item.setAttribute('aria-current', 'location');
            else item.removeAttribute('aria-current');
        });
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
});

const footer = document.querySelector('.site-footer');
if (footer) {
    footer.querySelector('[data-footer-year]').textContent = new Date().getFullYear().toLocaleString('fa-IR', { useGrouping: false });
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        footer.classList.add('footer-motion');
        const reveal = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    reveal.unobserve(entry.target);
                }
            });
        }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
        footer.querySelectorAll('[data-footer-reveal]').forEach((node, index) => {
            node.style.setProperty('--footer-delay', index * 70 + 'ms');
            reveal.observe(node);
        });
    }
}
