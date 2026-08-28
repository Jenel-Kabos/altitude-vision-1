// INBOX-2 — point d'entrée de test uniquement (jamais chargé par
// l'application réelle, jamais servi par Next.js). Bundle le VRAI
// composant de production `InternalMessagingPage.jsx` pour une preuve
// visuelle en moteur Chromium réel (light/dark, desktop/mobile) — même
// technique que HOTFIX-INBOX-SECURITY-2 (esbuild + Playwright déjà
// présents, aucune dépendance ajoutée).
import React from 'react';
import { createRoot } from 'react-dom/client';
import InternalMessagingPage from '../../lib/pages/dashboard/InternalMessagingPage';

window.mountInbox = () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(<InternalMessagingPage />);
};
