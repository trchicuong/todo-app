window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();

    const deferredPrompt = event;
    const installButton = document.getElementById('install-btn');

    installButton.classList.remove('hidden');

    installButton.addEventListener('click', () => {
        installButton.classList.add('hidden');
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
        });
    });
});
