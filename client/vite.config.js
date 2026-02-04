import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // -- PLUGINS --
  // Le plugin de base pour faire fonctionner React avec Vite.
  // Il gère le JSX, le Fast Refresh (HMR), et d'autres optimisations.
  plugins: [react()],

  // -- SERVEUR DE DÉVELOPPEMENT --
  server: {
    // Port sur lequel le serveur de développement frontend va tourner.
    port: 5173,
    // Ouvre automatiquement le navigateur au démarrage.
    open: true,
    // LA PARTIE LA PLUS IMPORTANTE : Le Proxy
    // Redirige les requêtes API du frontend vers le backend pour éviter les erreurs CORS.
    proxy: {
      // Toutes les requêtes qui commencent par '/api' seront redirigées.
      '/api': {
        // L'adresse de votre serveur backend.
        target: 'https://altitude-vision.onrender.com',
        // Nécessaire pour que le backend accepte la requête redirigée.
        changeOrigin: true,
        // Ne réécrit pas le chemin, '/api/users' reste '/api/users'.
        rewrite: (path) => path,
      },
      
      // ✅ CORRECTION AJOUTÉE :
      // Redirige les requêtes pour les images (ou autres fichiers statiques)
      // vers le backend.
      '/uploads': {
        target: 'https://altitude-vision.onrender.com',
        changeOrigin: true,
      }
    },
  },

  // -- CONFIGURATION DU BUILD --
  build: {
    // Le dossier où les fichiers finaux seront générés après `npm run build`.
    outDir: 'dist',
    // Génère des sourcemaps pour faciliter le débogage en production.
    // Mettre à `false` pour ne pas exposer le code source.
    sourcemap: true,
    // Augmente la limite de taille pour les avertissements sur les "chunks".
    chunkSizeWarningLimit: 1500,
  },

  // -- CONFIGURATION DE L'APERÇU (après le build) --
  preview: {
    // Port pour prévisualiser le build localement avec `npm run preview`.
    port: 4173,
    open: true,
  },
});