// UX-ACCOMMODATION-SEARCH-BAR-1 — point d'entrée de test uniquement (jamais
// chargé par l'application réelle, jamais servi par Next.js). Bundle le VRAI
// composant de production `ManageAccommodationsPage.jsx` pour une preuve
// visuelle en moteur Chromium réel (light/dark, desktop/mobile) — même
// technique que INBOX-2 (esbuild + Playwright déjà présents dans le projet,
// aucune dépendance ajoutée).
import React from 'react';
import { createRoot } from 'react-dom/client';
import ManageAccommodationsPage from '../../lib/pages/dashboard/ManageAccommodationsPage';

window.mountAccommodations = () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(<ManageAccommodationsPage />);
};
