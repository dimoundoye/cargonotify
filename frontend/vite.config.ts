import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'manifest.json', 'sw.js'],
      manifest: {
        name: 'CargoNotify — Transit & Logistique',
        short_name: 'CargoNotify',
        description: 'Application de gestion de fret maritime, conteneurs, lots clients et notifications WhatsApp.',
        theme_color: '#1d4ed8',
        background_color: '#0b1329',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '48x48 72x72 96x96 128x128 256x256 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

