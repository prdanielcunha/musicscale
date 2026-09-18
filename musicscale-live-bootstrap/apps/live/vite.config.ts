import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MusicScale Live',
        short_name: 'MusicScale Live',
        description: 'LAN-first worship production cockpit',
        theme_color: '#0B0C11',
        background_color: '#0B0C11',
        display: 'standalone',
        start_url: '/'
      }
    })
  ],
  server: {
    port: 4316,
    host: '0.0.0.0'
  }
});
