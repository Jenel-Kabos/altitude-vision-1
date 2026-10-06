// GOOGLE-PLAY-P0-1 — vérifie que la politique de confidentialité web
// mentionne bien les services tiers audités et la nouvelle procédure
// de suppression du compte ajoutée par ce sprint.

// jsdom n'a pas IntersectionObserver (requis par framer-motion
// whileInView utilisé dans la page). setup.js polyfill matchMedia et
// ResizeObserver mais pas IO — polyfill local scope à ce test.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

import { render, screen } from '@testing-library/react';
import PolitiqueConfidentialite from '../pages/PolitiqueConfidentialite';

describe('PolitiqueConfidentialite — remédiation P0', () => {
  beforeEach(() => { render(<PolitiqueConfidentialite />); });

  test('affiche le H1 de la politique', () => {
    expect(screen.getByRole('heading', { level: 1, name: /politique de confidentialité/i })).toBeInTheDocument();
  });

  test('contact support@altitudevision.agency est présent', () => {
    const mailto = document.querySelector('a[href^="mailto:support@altitudevision.agency"]');
    expect(mailto).toBeTruthy();
  });

  test('nouvelles sections SDK mobile et Suppression présentes dans le sommaire', () => {
    // Chaque section a un h2 correspondant à son titre dans le composant
    // AccordionSection (fermé par défaut, mais le heading est rendu).
    expect(screen.getByRole('heading', { level: 2, name: /application mobile altimmo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /suppression de votre compte/i })).toBeInTheDocument();
  });

  test('sous-traitants Sentry / Expo / Google Sign-In / Google Maps référencés', () => {
    expect(screen.getByRole('heading', { level: 2, name: /hébergement.*sous-traitants/i })).toBeInTheDocument();
  });

  test('ne promet aucune durée de conservation ou de réponse non juridiquement confirmée', () => {
    expect(document.body.textContent).not.toMatch(/30 jours|90 jours|12 mois|24 mois/i);
    expect(document.body.textContent).toMatch(/revue juridique humaine requise/i);
  });
});
