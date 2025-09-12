import { resolve } from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',

            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,webmanifest}']
            },

            manifest: {
                "name": "Todo App - Phần mềm quản lý công việc",
                "short_name": "Todo App",
                "description": "Phần mềm quản lý công việc cá nhân thông minh.",
                "start_url": "dashboard.html",
                "display": "standalone",
                "background_color": "#000000",
                "theme_color": "#000000",
                "icons": [
                    {
                        "src": "/images/android-chrome-192x192.png",
                        "sizes": "192x192",
                        "type": "image/png"
                    },
                    {
                        "src": "/images/android-chrome-512x512.png",
                        "sizes": "512x512",
                        "type": "image/png"
                    }
                ]
            }
        })
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                dashboard: resolve(__dirname, 'dashboard.html'),
            },
        },
    },
})