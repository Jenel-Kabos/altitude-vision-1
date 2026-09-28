import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AltimmoAppPage from '../pages/AltimmoAppPage';

vi.mock('next/image', () => ({
  default: ({ priority = false, fill: _fill, ...props }) => (
    <img {...props} data-priority={priority ? 'true' : 'false'} />
  ),
}));

vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal(), useInView: () => true, useReducedMotion: () => false,
}));

const OFFICIAL_ASSETS = [
  '/images/altimmo-app/mockups/01-altimmo-home.png',
  '/images/altimmo-app/mockups/02-altimmo-map.png',
  '/images/altimmo-app/mockups/03-altimmo-properties.png',
  '/images/altimmo-app/mockups/04-altimmo-hotel..png',
  '/images/altimmo-app/mockups/05-altimmo-accommodation.png',
  '/images/altimmo-app/mockups/06-altimmo-property-detail.png — Détail d’un bien + contacter + planifier une visite.png',
  '/images/altimmo-app/mockups/07-altimmo-messaging.png',
  '/images/altimmo-app/mockups/08-altimmo-owner-profile.png',
  '/images/altimmo-app/mockups/09-altimmo-owner-properties.png.png',
  '/images/altimmo-app/mockups/10-altimmo-account-services.png',
];

describe('SPRINT 2 — product storytelling Altimmo', () => {
  test('APP2-01 : la page raconte les dix étapes du parcours produit', () => {
    const { container } = render(<AltimmoAppPage />);
    const sections = container.querySelectorAll('section[data-story-step]');

    expect(sections).toHaveLength(10);
    expect(Array.from(sections, section => section.dataset.storyStep)).toEqual([
      'promise', 'discover', 'map', 'buy-rent', 'hospitality',
      'messaging', 'owners', 'account', 'ecosystem', 'final-cta',
    ]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/L’immobilier.*votre poche/i);
  });

  test('APP2-02 : les dix mockups officiels sont intégrés selon leur usage réel', () => {
    const { container } = render(<AltimmoAppPage />);
    const sources = Array.from(container.querySelectorAll('img'), image => image.getAttribute('src'));

    for (const asset of OFFICIAL_ASSETS) expect(sources).toContain(asset);
    expect(sources.some(source => source?.includes('/altimmo-home.webp'))).toBe(false);
    expect(sources.some(source => source?.includes('/altimmo-map.webp'))).toBe(false);
    expect(sources.some(source => source?.includes('/altimmo-mila-hotel.webp'))).toBe(false);
  });

  test('APP2-03 : les sections produit essentielles restent explicites', () => {
    render(<AltimmoAppPage />);
    expect(screen.getByRole('heading', { name: /Explorez la ville/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Du premier regard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Séjournez autrement|De l’immobilier à l’hébergement/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /commence par un échange/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Vos biens.*Votre activité.*Un seul espace/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tout votre parcours.*au même endroit/i })).toBeInTheDocument();
  });

  test('APP2-04 : les CTA utilisent les routes publiques auditées', () => {
    render(<AltimmoAppPage />);
    expect(screen.getAllByRole('link', { name: /Découvrir les biens/i })[0]).toHaveAttribute('href', '/immobilier/annonces');
    expect(screen.getByRole('link', { name: /Explorer l’application/i })).toHaveAttribute('href', '#decouvrir');
    expect(screen.getByRole('link', { name: /Publier un bien/i })).toHaveAttribute('href', '/properties/submit');
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href');
      expect(href).toBeTruthy();
      if (href.startsWith('#')) continue;
      const relative = href.slice(1).split('#')[0].split('?')[0];
      expect(existsSync(resolve('app', relative, 'page.jsx'))).toBe(true);
    }
  });

  test('APP2-05 : la règle apporteur reste qualifiée et non automatique', () => {
    const { container } = render(<AltimmoAppPage />);
    const copy = container.textContent || '';
    expect(copy).toMatch(/apporteurs d’affaires éligibles.*jusqu’à 30\s*%.*transaction admissible.*règles du réseau/is);
    expect(copy).not.toMatch(/gagn(?:ez|er) automatiquement/i);
  });

  test('APP2-06 : aucun store badge, statistique ou témoignage non vérifié', () => {
    const { container } = render(<AltimmoAppPage />);
    const html = container.innerHTML;
    expect(screen.queryByRole('link', { name: /télécharger|app store|play store/i })).not.toBeInTheDocument();
    expect(html).not.toMatch(/apps\.apple\.com|play\.google\.com|200\+|98\s*%|5\s*ans\s+d[’']?expertise/i);
    expect(html).not.toMatch(/Marie\s*K\.|Jean-Pierre\s*M\.|Christelle\s*N\./i);
  });

  test('APP2-07 : la page ne reconstruit aucune coque de téléphone', () => {
    const { container } = render(<AltimmoAppPage />);
    expect(container.querySelector('[data-device-model]')).toBeNull();
    expect(container.querySelector('[class*="deviceFrame"], [class*="phoneFrame"], [class*="phoneShell"]')).toBeNull();
  });

  test('APP2-08 : structure, textes alternatifs et chargement des images sont accessibles', () => {
    const { container } = render(<AltimmoAppPage />);
    const story = container.querySelector('[data-story-step="promise"]');
    const images = Array.from(container.querySelectorAll('img'));
    const officialImages = images.filter(image => OFFICIAL_ASSETS.includes(image.getAttribute('src')));

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('section[aria-labelledby]')).toHaveLength(10);
    expect(within(story).getByText(/organisez vos visites/i)).toBeInTheDocument();
    expect(officialImages.length).toBeGreaterThanOrEqual(10);
    expect(officialImages.every(image => image.hasAttribute('sizes'))).toBe(true);
    expect(officialImages.filter(image => image.dataset.priority === 'true')).toHaveLength(3);

    const informativeAlts = officialImages.map(image => image.alt).filter(Boolean);
    expect(informativeAlts.length).toBeGreaterThanOrEqual(10);
    expect(new Set(informativeAlts).size).toBe(informativeAlts.length);
    expect(officialImages.some(image => image.alt === '')).toBe(true);
  });

  test('APP2-09 : la metadata ne promet ni plateforme ni gratuité non vérifiées', () => {
    const source = readFileSync(resolve('app/altimmo/application/page.jsx'), 'utf8');

    expect(source).not.toMatch(/operatingSystem:\s*['"]Android, iOS/i);
    expect(source).not.toMatch(/offers:\s*\{[^}]*price:\s*['"]0['"]/s);
    expect(source).toMatch(/recherche de biens, carte des opportunités/i);
  });
});
