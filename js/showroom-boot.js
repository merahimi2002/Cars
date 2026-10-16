(() => {
    function failed(error) {
        console.error('Unable to load showroom script:', error);
        document.querySelector('.showroom-loader').hidden = true;
        document.querySelector('.showroom-error').hidden = false;
        document.getElementById('showroom-retry').addEventListener('click', () => location.reload());
    }
    if (location.protocol === 'file:' || new URLSearchParams(location.search).has('standalone')) {
        window.CARS_LOCAL_MODE = true;
        const script = document.createElement('script');
        script.src = 'js/showroom.standalone.js';
        script.onerror = failed;
        document.body.appendChild(script);
    } else {
        import('./showroom.js?v=28').catch(failed);
    }
})();
