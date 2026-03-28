import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({

  // ── PLUGINS ───────────────────────────────────────────────────
  plugins: [react()],

  // ── SERVEUR DE DÉVELOPPEMENT ──────────────────────────────────
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target:       'https://altitude-vision.onrender.com',
        changeOrigin: true,
        rewrite:      (path) => path,
      },
      '/uploads': {
        target:       'https://altitude-vision.onrender.com',
        changeOrigin: true,
      },
    },
  },

  // ── BUILD PRODUCTION ──────────────────────────────────────────
  build: {
    outDir:    'dist',
    sourcemap: false, // ✅ false en prod : évite d'exposer le code source sur Netlify

    // ✅ Réduit à 800 (ton 1500 masquait des chunks trop gros)
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // ✅ Code splitting manuel — chaque groupe est mis en cache séparément.
        // Si React ne change pas entre deux déploiements, le navigateur
        // utilise sa version en cache au lieu de tout retélécharger.
        manualChunks: {
          // React core — change rarement → cache très long
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],

          // Framer Motion — ~150Ko, chargé uniquement sur les pages qui l'utilisent
          'vendor-motion': ['framer-motion'],

          // Leaflet — chargé seulement sur les pages avec carte (PropertyDetailPage)
          'vendor-map':    ['leaflet', 'react-leaflet'],

          // Lucide — partagé partout, isolé pour le cache
          'vendor-icons':  ['lucide-react'],

          // Notifications toast
          'vendor-ui':     ['react-hot-toast'],
        },
      },
    },

    // Les fichiers < 4Ko sont inlinés en base64 → zéro requête réseau supplémentaire
    assetsInlineLimit: 4096,
  },

  // ── PRÉVISUALISATION (npm run preview) ────────────────────────
  preview: {
    port: 4173,
    open: true,
  },

  // ── OPTIMISATION DES DÉPENDANCES (dev server) ─────────────────
  // Pré-bundle ces dépendances au démarrage pour accélérer le HMR
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
  },
});