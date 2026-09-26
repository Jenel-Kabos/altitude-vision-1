import React from 'react';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import AltitudeMethod from '../components/public/AltitudeMethod';

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_target, tag) => tag === 'create' ? (Component) => Component : ({ children, initial, animate, exit, transition, whileInView, viewport, whileTap, whileHover, ...props }) => React.createElement(tag, props, children),
  });
  return { motion, AnimatePresence: ({ children }) => children, useInView: () => true, useReducedMotion: () => false };
});

vi.mock('../components/public/HeroEcosystem', () => ({ default: () => <section data-testid="hero-ecosystem"><h1>Hero Altitude Vision</h1></section> }));
vi.mock('../components/public/IntentRouter', () => ({ default: () => <section data-testid="intent-router">Trouver · Publier · Gérer · Développer</section> }));
vi.mock('../components/public/AltimmoDiscovery', () => ({ default: () => <section data-testid="altimmo-discovery">Acheter · Louer · Séjourner</section> }));
vi.mock('../components/public/AltcomDiscovery', () => ({ default: () => <section data-testid="altcom-discovery">Communication 360° · Branding &amp; design · Studio &amp; contenus</section> }));
vi.mock('../components/public/AltitudeApproach', () => ({ default: () => <section data-testid="web07-about">Des métiers différents. Une vision commune.</section> }));
vi.mock('../components/HomeSlider', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));
vi.mock('../components/WhyChooseUs', () => ({ default: () => null }));
vi.mock('../services/propertyService', () => ({ getLatestPropertiesByPoles: vi.fn().mockResolvedValue({ Altimmo: [] }) }));
vi.mock('../services/eventService', () => ({ getAllEvents: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/portfolioService', () => ({ getAllPortfolioItems: vi.fn().mockResolvedValue([]) }));

const renderHomepage = () => render(<HomePageNext />);

describe('WEB-08 — méthode/crédibilité parent-brand', () => {
  test('WEB08-01 : la nouvelle section se place après AltitudeApproach', () => {
    renderHomepage();
    const approach = screen.getByTestId('web07-about');
    const credibility = screen.getByTestId('web08-credibility');
    expect(approach.compareDocumentPosition(credibility) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('WEB08-02 : StatsCounter n\'occupe plus sa position homepage historique', () => {
    renderHomepage();
    expect(screen.queryByText(/Altitude-Vision en chiffres/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Des résultats qui parlent d'eux-mêmes/i)).not.toBeInTheDocument();
  });

  test('WEB08-03/04/05 : les statistiques non vérifiées ("98%", "200+") sont absentes', () => {
    renderHomepage();
    expect(screen.queryByText(/98\s?%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/200\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/80\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/biens vendus|clients satisfaits|événements organisés/i)).not.toBeInTheDocument();
  });

  test('WEB08-06/07/08 : aucun témoignage, logo partenaire ou badge de certification', () => {
    renderHomepage();
    const section = screen.getByTestId('web08-credibility');
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
    expect(within(section).queryByRole('img')).not.toBeInTheDocument();
    expect(section).not.toHaveTextContent(/témoignage|partenaire|certifié|award|n°1|leader|référence au Congo/i);
  });

  test('WEB08-09 : aucun compteur animé générique (pas de chiffre animé affiché)', () => {
    renderHomepage();
    const section = screen.getByTestId('web08-credibility');
    expect(section).not.toHaveTextContent(/\d+\+|\d+\s?%|\d+\sans/);
  });

  test('WEB08-10/11 : le contenu essentiel est visible par défaut, sans IntersectionObserver', () => {
    const originalIO = window.IntersectionObserver;
    // @ts-expect-error simulate an environment without IntersectionObserver support
    delete window.IntersectionObserver;

    render(<AltitudeMethod />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();

    window.IntersectionObserver = originalIO;
  });

  test('WEB08-12 : le contenu reste visible avec prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<AltitudeMethod />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('WEB08-13 : conserve un seul H1 sur la homepage', () => {
    renderHomepage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  test('WEB08-14/15/16/17/18 : les sections verrouillées restent présentes', () => {
    renderHomepage();
    expect(screen.getByTestId('hero-ecosystem')).toBeInTheDocument();
    expect(screen.getByTestId('intent-router')).toBeInTheDocument();
    expect(screen.getByTestId('altimmo-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('altcom-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('web07-about')).toBeInTheDocument();
  });

  test('WEB08-19 : se rend sans auth ni contexte tenant (scope public isolé)', () => {
    expect(() => render(<AltitudeMethod />)).not.toThrow();
  });

  test('WEB08-20 : ne crée aucune nouvelle route', () => {
    renderHomepage();
    const section = screen.getByTestId('web08-credibility');
    within(section).queryAllByRole('link').forEach((link) => {
      expect(link).not.toHaveAttribute('href', '/a-propos');
      expect(link).not.toHaveAttribute('href', '/nos-references');
    });
  });

  test('WEB08-21 : n\'introduit pas de section de découverte Mila Events', () => {
    renderHomepage();
    const section = screen.getByTestId('web08-credibility');
    expect(within(section).queryByRole('navigation', { name: /Mila/i })).not.toBeInTheDocument();
    expect(section).not.toHaveTextContent(/Mila Events/i);
  });

  test('WEB08-22 : ne recrée pas les trois principes exacts de WEB-07', () => {
    renderHomepage();
    const section = screen.getByTestId('web08-credibility');
    expect(section).not.toHaveTextContent(/Comprendre le besoin/i);
    expect(section).not.toHaveTextContent(/Coordonner les expertises/i);
    expect(section).not.toHaveTextContent(/Transformer l.idée en réalisation/i);
  });

  test('accessibilité : titre H2 sémantique et section identifiable', () => {
    renderHomepage();
    const section = screen.getByTestId('web08-credibility');
    expect(within(section).getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});
