if (typeof WOW !== 'undefined') new WOW().init();

const menuButton = document.querySelector('.first-button');
if (menuButton) {
    const menu = document.getElementById('navbarSupportedContent');
    menu.addEventListener('shown.bs.collapse', () => menuButton.querySelector('.animated-icon1').classList.add('open'));
    menu.addEventListener('hidden.bs.collapse', () => menuButton.querySelector('.animated-icon1').classList.remove('open'));
}
