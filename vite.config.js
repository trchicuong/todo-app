import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',

      workbox: {
        importScripts: ['sw-custom.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,webmanifest}'],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tailwind-cdn-cache',
            },
          },
          {
            // Cache file CSS từ Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            // Cache file font (woff2) từ Google Fonts
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 năm
              },
            },
          },
          {
            // Cache Font Awesome từ CDNJS
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-awesome-cache',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 năm
              },
            },
          },
          {
            // Dùng chung quy tắc cho cdn.jsdelivr.net
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cache',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 năm
              },
            },
          },
        ],
      },

      manifest: {
        name: 'Todo App - Phần mềm quản lý công việc',
        short_name: 'Todo App',
        description: 'Phần mềm quản lý công việc cá nhân thông minh.',
        start_url: 'dashboard',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/images/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/images/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
});
