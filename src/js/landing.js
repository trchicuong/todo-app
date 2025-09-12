document.addEventListener('DOMContentLoaded', function () {
    // --- PWA Install Button Logic ---
    let deferredPrompt;
    const installButton = document.getElementById('install-btn');

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();

        deferredPrompt = event;

        installButton.classList.remove('hidden');
    });

    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return;
        }

        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('Người dùng đã đồng ý cài đặt ứng dụng');
        } else {
            console.log('Người dùng đã từ chối cài đặt ứng dụng');
        }

        deferredPrompt = null;

        installButton.classList.add('hidden');
    });

    if (typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": "#ffffff" },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.5, "random": true, "anim": { "enable": true, "speed": 1, "opacity_min": 0.1, "sync": false } },
                "size": { "value": 3, "random": true, "anim": { "enable": false } },
                "line_linked": { "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.4, "width": 1 },
                "move": { "enable": true, "speed": 2, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": false }, "resize": true },
                "modes": { "repulse": { "distance": 100, "duration": 0.4 } }
            },
            "retina_detect": true
        });
    }
});