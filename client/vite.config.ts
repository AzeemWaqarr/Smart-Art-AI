import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.png'],
      manifest: {
        name: 'Smart Art Coach',
        short_name: 'Smart Art',
        description: 'Your personal AI art coach. Snap a drawing, see what is working and get three tips to try next time.',
        theme_color: '#0E4A53',
        background_color: '#E7F0F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['education', 'kids'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Coach my drawing', short_name: 'Coach', url: '/app/coach', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Lessons', url: '/app/lessons', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Drawing photos never change once uploaded
            urlPattern: ({ url }) => /^\/api\/drawings\/[^/]+\/image$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'drawings', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // Lessons and progress work offline with the last known copy
            urlPattern: ({ url, request }) => request.method === 'GET' && /^\/api\/(lessons|progress|home|plans|family|auth\/me)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 4, expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // keep the browser's Host header so the API's same-origin check sees the real site
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false, xfwd: true } },
  },
});
