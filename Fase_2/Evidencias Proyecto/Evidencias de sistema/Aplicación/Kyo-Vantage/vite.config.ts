import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // The application registers and links the manifest only on VITE_APP_URL.
      injectRegister: false,
      manifest: false,
      includeAssets: [
        'offline.html', 'app.webmanifest', 'V.png', 'VANTAGE.png',
        'Logo_transparent.png', 'icons/*.png',
      ],
      injectManifest: {
        globPatterns: ['assets/**/*.{js,css,png,svg,webp,ico,woff,woff2}'],
        // Authenticated documents and the SPA entry must never become offline pages.
        globIgnores: ['index.html'],
      },
    }),
  ],
  appType: 'spa',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
  },
});
