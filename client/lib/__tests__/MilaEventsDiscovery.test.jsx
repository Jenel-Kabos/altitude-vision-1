import React from 'react';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import MilaEventsDiscovery from '../components/public/MilaEventsDiscovery';

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_target, tag) => tag === 'create' ? (Component) => Component : ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileInView: _whileInView, viewport: _viewport, whileTap: _whileTap, whileHover: _whileHover, ...props }) => React.createElement(tag, props, children),
  });
  return { motion, AnimatePresence: ({ children }) => children, useInView: () => true, useReducedMotion: () => false };
});

vi.mock('../components/public/HeroEcosystem', () => ({ default: () => <section data-testid="hero-ecosystem"><h1>Hero Altitude Vision</h1></section> }));
vi.mock('../components/public/IntentRouter', () => ({ default: () => <section data-testid="intent-router">Trouver · Publier · Gérer · Développer</section> }));
vi.mock('../components/public/AltimmoDiscovery', () => ({ default: () => <section data-testid="altimmo-discovery">Acheter · Louer · Séjourner</section> }));
vi.mock('../components/public/AltcomDiscovery', () => ({ default: () => <section data-testid="altcom-discovery">Communication 360° · Branding &amp; design · Studio &amp; contenus</section> }));
vi.mock('../components/public/AltitudeApproach', () => ({ default: () => <section data-testid="web07-about">Des métiers différents. Une vision commune.</section> }));
vi.mock('../components/public/AltitudeMethod', () => ({ default: () => <section data-testid="web08-credibility">Du besoin à la réalisation.</section> }));
vi.mock('../components/HomeSlider', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));
vi.mock('../components/WhyChooseUs', () => ({ default: () => null }));
vi.mock('../services/propertyService', () => ({ getLatestPropertiesByPoles: vi.fn().mockResolvedValue({ Altimmo: [] }) }));
vi.mock('../services/eventService', () => ({ getAllEvents: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/portfolioService', () => ({ getAllPortfolioItems: vi.fn().mockResolvedValue([]) }));

const renderHomepage = () => render(<HomePageNext />);

describe('WEB-09 — Mila Events Discovery', () => {
  test('WEB09-01/02 : la section Mila reste présente avant les réalisations', () => {
    renderHomepage();
    const mila = screen.getByTestId('mila-events-discovery');
    const realisations = screen.getByTestId('realisations-editorial');
    expect(mila.compareDocumentPosition(realisations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('WEB09-03/23 : la section Mila se rend avant la suite de la homepage', () => {
    renderHomepage();
    const mila = screen.getByTestId('mila-events-discovery');
    const next = screen.getByTestId('web07-about');
    expect(mila.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('WEB09-04/05 : utilise la route canonique Mila Events, jamais un href="#"', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    const links = within(section).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).not.toHaveAttribute('href', '#');
    });
    expect(within(section).getByRole('link', { name: /Voir nos réalisations/i })).toHaveAttribute('href', '/evenementiel#realisations');
  });

  test('WEB09-06/07/08/09 : aucune statistique, témoignage, logo ou récompense fabriqués', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    expect(section).not.toHaveTextContent(/\d+\+|\d+\s?%|témoignage|partenaire|certifié|award|n°1|leader|référence au Congo/i);
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
  });

  test('WEB09-10/12 : aucun portfolio généré ou projet fabriqué — un seul média éditorial générique', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    expect(within(section).getAllByRole('img')).toHaveLength(1);
    expect(section).not.toHaveTextContent(/projet 0\d|client|réalisé par|mariage .+ & .+/i);
  });

  test('WEB09-11 : aucune image de stock externe', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    within(section).queryAllByRole('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      expect(src).not.toMatch(/unsplash|pexels|images\.pexels|cdn\.pixabay/i);
    });
  });

  test('WEB09-13/14 : le contenu essentiel est visible par défaut, sans IntersectionObserver', () => {
    const originalIO = window.IntersectionObserver;
    // @ts-expect-error simulate an environment without IntersectionObserver support
    delete window.IntersectionObserver;

    render(<MilaEventsDiscovery />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();

    window.IntersectionObserver = originalIO;
  });

  test('WEB09-15 : le contenu reste visible avec prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MilaEventsDiscovery />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('WEB09-16 : conserve un seul H1 sur la homepage', () => {
    renderHomepage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  test('WEB09-17/18/19/20/21/22 : les sections verrouillées restent présentes', () => {
    renderHomepage();
    expect(screen.getByTestId('hero-ecosystem')).toBeInTheDocument();
    expect(screen.getByTestId('intent-router')).toBeInTheDocument();
    expect(screen.getByTestId('altimmo-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('altcom-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('web07-about')).toBeInTheDocument();
    expect(screen.getByTestId('web08-credibility')).toBeInTheDocument();
  });

  test('WEB09-24 : se rend sans auth ni contexte tenant (scope public isolé)', () => {
    expect(() => render(<MilaEventsDiscovery />)).not.toThrow();
  });

  test('WEB09-25 : ne crée aucune nouvelle route (pas de /mila ni /nos-evenements)', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    within(section).getAllByRole('link').forEach((link) => {
      const href = link.getAttribute('href');
      expect(href).not.toBe('/mila');
      expect(href).not.toBe('/nos-evenements');
      expect(href).not.toBe('/events');
    });
  });

  test('WEB09-27 : le média événementiel temporaire reste local et non attribué à Mila', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    const image = within(section).getByRole('img');
    expect(image).toHaveAttribute('src', '/images/editorial-temp/mila-scenography-editorial.webp');
    expect(image).toHaveAccessibleName('Espace de réception scénographié entre lumière bleue et bougies');
    expect(section).toHaveTextContent(/Photographie éditoriale temporaire/i);
  });

  test('accessibilité : titre H2 sémantique, identité Mila présente', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    expect(within(section).getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(section).toHaveTextContent(/Mila Events/i);
  });

  test('ne duplique pas la séquence exacte des trois principes WEB-07', () => {
    renderHomepage();
    const section = screen.getByTestId('mila-events-discovery');
    expect(section).not.toHaveTextContent(/Comprendre le besoin/i);
    expect(section).not.toHaveTextContent(/Coordonner les expertises/i);
    expect(section).not.toHaveTextContent(/Transformer l.idée en réalisation/i);
  });
});
