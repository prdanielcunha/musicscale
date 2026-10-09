import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageMetadata = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
) as { version: string };

const versionManifestPlugin: Plugin = {
  name: 'musicscale-version-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: packageMetadata.version }) + '\n',
    });
  },
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Preview deployment is dispatched from the production-trusted GitHub
    // workflow, but checks out MAIN. Restrict visual-only build flags to
    // exactly that temporary GitHub preview workflow and channel. Production
    // and local builds never inherit these flags.
    const isPremiumReviewBuild =
      process.env.GITHUB_ACTIONS === 'true' &&
      process.env.GITHUB_WORKFLOW === 'MusicScale Main Firebase Preview' &&
      process.env.PREVIEW_CHANNEL === 'main-review';
    const previewOnlyVisualFlags = isPremiumReviewBuild ? {
      'import.meta.env.VITE_NEW_TRIAL_UI_PRESENTATION': JSON.stringify('true'),
      'import.meta.env.VITE_NEW_PLANS_UI_PRESENTATION': JSON.stringify('true'),
      'import.meta.env.VITE_NEW_ONBOARDING_UI_PRESENTATION': JSON.stringify('true'),
      'import.meta.env.VITE_NEW_DASHBOARD_UI_PRESENTATION': JSON.stringify('true'),
    } : {};
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: process.env.DISABLE_HMR === 'true' ? false : true,
      },
      plugins: [
        react(),
        tailwindcss(),
        versionManifestPlugin,
        VitePWA({
          registerType: 'autoUpdate',
          // PNG icons are already covered by globPatterns; avoid adding the same URLs twice.
          includeManifestIcons: false,
          workbox: {
            maximumFileSizeToCacheInBytes: 6000000,
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            globPatterns: ['**/*.{js,css,ico,png,svg,json}'],
            globIgnores: ['version.json', 'sw-migration-rescue.js'],
            navigateFallback: null,
            importScripts: ['/sw-migration-rescue.js'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          },
          manifest: {
            name: 'MusicScale Manager',
            short_name: 'MusicScale',
            description: 'MusicScale Premium Ministerial Platform',
            theme_color: '#000000',
            background_color: '#ffffff',
            display: 'standalone',
            start_url: '/',
            icons: [
              {
                src: '/LogoIcon-192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/LogoIcon.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: '/LogoIcon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ]
          }
        })
      ],
      define: previewOnlyVisualFlags,
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
