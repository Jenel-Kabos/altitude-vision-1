import React from 'react';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import AltitudeTrust from '../components/public/AltitudeTrust';

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
vi.mock('../components/public/AltitudeMethod', () => ({ default: () => <section data-testid="web08-credibility">Du besoin à la réalisation.</section> }));
vi.mock('../components/public/MilaEventsDiscovery', () => ({ default: () => <section data-testid="mila-events-discovery">Créer le moment. Orchestrer l&apos;expérience.</section> }));
vi.mock('../components/public/AltitudeContinuation', () => ({ default: () => <section data-testid="web10-continuation">À découvrir.</section> }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));

const renderHomepage = () => render(<HomePageNext />);

describe('WEB-11 — réassurance parent-brand (remplace "Pourquoi nous choisir")', () => {
  test('01 : la section WEB-11 est présente', () => {
    renderHomepage();
    expect(screen.getByTestId('web11-trust')).toBeInTheDocument();
  });

  test('02 : se rend après la méthode dans la séquence de réassurance', () => {
    renderHomepage();
    const web10 = screen.getByTestId('web08-credibility');
    const web11 = screen.getByTestId('web11-trust');
    expect(web10.compareDocumentPosition(web11) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('03 : l\'ancien "Pourquoi nous choisir" n\'est plus dans la homepage', () => {
    renderHomepage();
    expect(screen.queryByText(/Pourquoi nous choisir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/L.excellence à votre service/i)).not.toBeInTheDocument();
  });

  test('04 : "Expertise Certifiée" absent sauf preuve réelle', () => {
    renderHomepage();
    expect(screen.queryByText(/Expertise Certifiée/i)).not.toBeInTheDocument();
  });

  test('05 : "Réactivité Totale" absent', () => {
    renderHomepage();
    expect(screen.queryByText(/Réactivité Totale/i)).not.toBeInTheDocument();
  });

  test('06 : promesse "24h" absente sauf preuve réelle', () => {
    renderHomepage();
    const section = screen.getByTestId('web11-trust');
    expect(section).not.toHaveTextContent(/24h|24 h|sous 24/i);
  });

  test('07/08/09 : aucune statistique, certification ou récompense inventée', () => {
    renderHomepage();
    const section = screen.getByTestId('web11-trust');
    expect(section).not.toHaveTextContent(/\d+\+|\d+\s?%|certifié|certification|award|récompense|n°1|leader|meilleur|garanti|100%|toujours/i);
  });

  test('10 : aucun témoignage inventé', () => {
    renderHomepage();
    const section = screen.getByTestId('web11-trust');
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
  });

  test('11 : aucun logo client inventé', () => {
    renderHomepage();
    const section = screen.getByTestId('web11-trust');
    expect(within(section).queryAllByRole('img')).toHaveLength(0);
  });

  test('12/13 : contenu essentiel visible sans IntersectionObserver, pas d\'opacity:0 essentielle', () => {
    const originalIO = window.IntersectionObserver;
    // @ts-expect-error simulate an environment without IntersectionObserver support
    delete window.IntersectionObserver;

    render(<AltitudeTrust />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();

    window.IntersectionObserver = originalIO;
  });

  test('reduced motion : contenu reste visible', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<AltitudeTrust />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('14 : conserve un seul H1 sur la homepage', () => {
    renderHomepage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  test('15-22 : les sections verrouillées restent présentes', () => {
    renderHomepage();
    expect(screen.getByTestId('hero-ecosystem')).toBeInTheDocument();
    expect(screen.getByTestId('intent-router')).toBeInTheDocument();
    expect(screen.getByTestId('altimmo-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('altcom-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('web07-about')).toBeInTheDocument();
    expect(screen.getByTestId('web08-credibility')).toBeInTheDocument();
    expect(screen.getByTestId('mila-events-discovery')).toBeInTheDocument();
    expect(screen.queryByTestId('web10-continuation')).not.toBeInTheDocument();
  });

  test('24 : se rend sans auth ni contexte tenant (scope public isolé)', () => {
    expect(() => render(<AltitudeTrust />)).not.toThrow();
  });

  test('ne duplique pas la séquence exacte de WEB-07 ni de WEB-08', () => {
    renderHomepage();
    const section = screen.getByTestId('web11-trust');
    expect(section).not.toHaveTextContent(/Comprendre le besoin/i);
    expect(section).not.toHaveTextContent(/Coordonner les expertises/i);
    expect(section).not.toHaveTextContent(/Transformer l.idée en réalisation/i);
    expect(section).not.toHaveTextContent(/Un interlocuteur identifié à chaque étape/i);
    expect(section).not.toHaveTextContent(/Des étapes lisibles, du besoin à la livraison/i);
  });

  test('accessibilité : titre H2 sémantique', () => {
    renderHomepage();
    const section = screen.getByTestId('web11-trust');
    expect(within(section).getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});
