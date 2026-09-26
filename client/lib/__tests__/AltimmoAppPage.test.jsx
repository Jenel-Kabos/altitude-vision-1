import React from 'react';
import { render, screen } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import AltimmoAppPage from '../pages/AltimmoAppPage';

// Viewport animation is unrelated to CTA behavior and unavailable in jsdom.
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal(), useInView: () => true,
}));

describe('WEB-01 — présentation Altimmo et destinations disponibles', () => {
  test('APP-01 : aucun bouton de téléchargement/store non vérifié', () => {
    render(<AltimmoAppPage />);
    expect(screen.queryByRole('link', { name: /télécharger|download|app store|play store/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').some(link => /apps\.apple\.com|play\.google\.com/.test(link.href))).toBe(false);
  });

  test('APP-02 : les CTA proposent les annonces et des routes publiques existantes', () => {
    render(<AltimmoAppPage />);
    expect(screen.getByRole('link', { name: /Voir les annonces/i })).toHaveAttribute('href', '/altimmo/annonces');
    expect(screen.getByRole('link', { name: /Explorer les biens/i })).toHaveAttribute('href', '/altimmo/annonces');
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href');
      expect(href).toMatch(/^\//);
      expect(existsSync(resolve('app', href.slice(1), 'page.jsx'))).toBe(true);
    }
    expect(existsSync(resolve('app/altimmo/application/page.jsx'))).toBe(true);
  });
});
