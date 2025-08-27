if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('ServiceWorker đã được đăng ký thành công:', registration);
        }, err => {
            console.log('Đăng ký ServiceWorker thất bại:', err);
        });
    });
}
