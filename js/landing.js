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
