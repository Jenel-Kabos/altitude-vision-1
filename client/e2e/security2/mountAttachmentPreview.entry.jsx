// HOTFIX-INBOX-SECURITY-2 — FINAL CERTIFICATION
// Point d'entrée de test uniquement (jamais chargé par l'application réelle,
// jamais servi par Next.js — hors `app/`/`lib/`, non importé ailleurs).
// Bundle le VRAI composant de production `SafeAttachmentPreview.jsx` (avec
// React/ReactDOM/DOMPurify réels) pour un test en moteur Chromium réel via
// Playwright — jamais une réimplémentation ni une copie du mécanisme.
import React from 'react';
import { createRoot } from 'react-dom/client';
import SafeAttachmentPreview from '../../lib/components/messaging/SafeAttachmentPreview';

window.mountAttachmentPreview = (props) => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(<SafeAttachmentPreview {...props} />);
};
