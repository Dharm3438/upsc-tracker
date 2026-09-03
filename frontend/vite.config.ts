import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// The PWA manifest is registered now so the app is installable from phase 0;
// the offline shell and caching strategy are tuned in phase 8.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'UPSC Tracker',
        short_name: 'UPSC',
        description: 'Syllabus, revision and practice tracker',
        theme_color: '#16233A',
        background_color: '#FBF7F0',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173 },
})
