import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'TASKIT',
        short_name: 'TASKIT',
        description: 'Sumber kebenaran rapat tim',
        theme_color: '#1E1B4B',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/jobs': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
      '/upload': 'http://localhost:3000',
      '/share': 'http://localhost:3000',
      '/tasks': 'http://localhost:3000',
      '/playground': 'http://localhost:3000',
      '/search': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
