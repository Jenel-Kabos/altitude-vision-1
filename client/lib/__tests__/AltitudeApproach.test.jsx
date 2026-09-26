import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import AltitudeApproach from '../components/public/AltitudeApproach';

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_target, tag) => tag === 'create' ? (Component) => Component : ({ children, initial, animate, exit, transition, whileInView, viewport, whileTap, ...props }) => React.createElement(tag, props, children),
  });
  return { motion, AnimatePresence: ({ children }) => children, useReducedMotion: () => false };
});

vi.mock('../components/public/HeroEcosystem', () => ({ default: () => <section data-testid="hero-ecosystem"><h1>Hero Altitude Vision</h1></section> }));
vi.mock('../components/public/IntentRouter', () => ({ default: () => <section data-testid="intent-router">Trouver · Publier · Gérer · Développer</section> }));
vi.mock('../components/public/AltimmoDiscovery', () => ({ default: () => <section data-testid="altimmo-discovery">Acheter · Louer · Séjourner</section> }));
vi.mock('../components/public/AltcomDiscovery', () => ({ default: () => <section data-testid="altcom-discovery">Communication 360° · Branding &amp; design · Studio &amp; contenus</section> }));
vi.mock('../components/HomeSlider', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));
vi.mock('../components/StatsCounter', () => ({ default: () => null }));
vi.mock('../components/WhyChooseUs', () => ({ default: () => null }));
vi.mock('../services/propertyService', () => ({ getLatestPropertiesByPoles: vi.fn().mockResolvedValue({ Altimmo: [] }) }));
vi.mock('../services/eventService', () => ({ getAllEvents: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/portfolioService', () => ({ getAllPortfolioItems: vi.fn().mockResolvedValue([]) }));

const renderHomepage = () => render(<HomePageNext />);

describe('WEB-07 — Altitude Vision, approche parent-brand', () => {
  test('WEB07-01/28 : place la section About immédiatement après AltcomDiscovery', () => {
    renderHomepage();
    const orderedSections = [
      screen.getByTestId('hero-ecosystem'),
      screen.getByTestId('intent-router'),
      screen.getByTestId('altimmo-discovery'),
      screen.getByTestId('altcom-discovery'),
      screen.getByTestId('web07-about'),
    ];

    expect(orderedSections.every((section, index) => index === 0 || orderedSections[index - 1].compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  test('WEB07-02/03 : conserve un seul H1 et donne à WEB-07 un H2 sémantique', () => {
    renderHomepage();
    const section = screen.getByTestId('web07-about');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(section).getByRole('heading', { level: 2, name: /vision commune/i })).toBeInTheDocument();
  });

  test('WEB07-04/05 : le contenu essentiel est visible par défaut, sans IntersectionObserver', () => {
    const originalIO = window.IntersectionObserver;
    // @ts-expect-error simulate an environment without IntersectionObserver support
    delete window.IntersectionObserver;

    render(<AltitudeApproach />);

    expect(screen.getByRole('heading', { level: 2, name: /vision commune/i })).toBeVisible();
    expect(screen.getByText(/réunit l’immobilier, la communication et l’événementiel/i)).toBeVisible();
    expect(screen.getByText('Comprendre le besoin')).toBeVisible();

    window.IntersectionObserver = originalIO;
  });

  test('WEB07-06 : le contenu reste visible avec prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<AltitudeApproach />);
    expect(screen.getByRole('heading', { level: 2, name: /vision commune/i })).toBeVisible();
  });

  test('WEB07-07/08/09/10 : ne fabrique ni statistique, ni témoignage, ni historique, ni logo client', () => {
    renderHomepage();
    const section = screen.getByTestId('web07-about');

    expect(section).not.toHaveTextContent(/\d+\+|\d+\s?%|témoignage|ils nous font confiance|depuis \d{4}|fondée en/i);
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
    expect(within(section).queryByRole('img')).not.toBeInTheDocument();
  });

  test('WEB07-11 : ne recrée pas la grille générique "Trois pôles, une seule vision"', () => {
    renderHomepage();
    expect(screen.queryByRole('heading', { name: /Trois pôles, une seule vision/i })).not.toBeInTheDocument();
  });

  test('WEB07-12 : la marque parent domine (encre/ivoire/laiton), pas les couleurs de branche', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/public/AltitudeApproach.module.css'),
      'utf8'
    );
    expect(css).toContain('#17201e');
    expect(css).toContain('#ae8540');
    expect(css).not.toMatch(/#b62e36|#d66f32/i);
  });

  test('WEB07-13 : mentionne Mila Events sans en faire une section de découverte dédiée', () => {
    renderHomepage();
    const section = screen.getByTestId('web07-about');

    expect(section).toHaveTextContent(/événementiel/i);
    expect(within(section).queryByRole('navigation', { name: /Mila/i })).not.toBeInTheDocument();
  });

  test('WEB07-14/15/16/17 : les sections verrouillées restent présentes et inchangées en position', () => {
    renderHomepage();
    expect(screen.getByTestId('hero-ecosystem')).toBeInTheDocument();
    expect(screen.getByTestId('intent-router')).toBeInTheDocument();
    expect(screen.getByTestId('altimmo-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('altcom-discovery')).toBeInTheDocument();
  });

  test('WEB07-18 : se rend sans auth ni contexte tenant (scope public isolé)', () => {
    expect(() => render(<AltitudeApproach />)).not.toThrow();
  });

  test('WEB07-19 : retire le bloc "À propos" legacy de la composition homepage', () => {
    renderHomepage();
    expect(screen.queryByText(/Qui sommes-nous/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/200\+ familles logées/i)).not.toBeInTheDocument();
  });

  test('WEB07-20 : ne crée pas de nouvelle route /a-propos, le CTA cible une route existante', () => {
    renderHomepage();
    const section = screen.getByTestId('web07-about');
    const cta = within(section).getByRole('link', { name: /Nous contacter/i });
    expect(cta).toHaveAttribute('href', '/contact');
  });
});
