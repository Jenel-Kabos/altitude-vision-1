import React from 'react';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_target, tag) => tag === 'create' ? (Component) => Component : ({ children, initial, animate, exit, transition, whileInView, viewport, whileTap, ...props }) => React.createElement(tag, props, children),
  });
  return { motion, AnimatePresence: ({ children }) => children, useReducedMotion: () => false };
});

vi.mock('../components/public/HeroEcosystem', () => ({ default: () => <section data-testid="hero-ecosystem"><h1>Hero Altitude Vision</h1></section> }));
vi.mock('../components/public/IntentRouter', () => ({ default: () => <section data-testid="intent-router">Trouver · Publier · Gérer · Développer</section> }));
vi.mock('../components/public/AltimmoDiscovery', () => ({ default: () => <section data-testid="altimmo-discovery">Acheter · Louer · Séjourner</section> }));
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

describe('WEB-06 — continuation éditoriale Altcom', () => {
  test('WEB06-01/12/13/14 : place Altcom après les trois sections publiques verrouillées', () => {
    renderHomepage();
    const orderedSections = [
      screen.getByTestId('hero-ecosystem'),
      screen.getByTestId('intent-router'),
      screen.getByTestId('altimmo-discovery'),
      screen.getByTestId('altcom-discovery'),
    ];

    expect(orderedSections.every((section, index) => index === 0 || orderedSections[index - 1].compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  test('WEB06-02/15/16 : conserve un seul H1 et donne à WEB-06 un H2 et une navigation sémantiques', () => {
    renderHomepage();
    const section = screen.getByTestId('altcom-discovery');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(section).getByRole('heading', { level: 2, name: /à la hauteur de ses ambitions/i })).toBeInTheDocument();
    expect(within(section).getByRole('navigation', { name: /expertises Altcom/i })).toBeInTheDocument();
  });

  test('WEB06-03 : utilise la route publique canonique Altcom', () => {
    renderHomepage();
    expect(within(screen.getByTestId('altcom-discovery')).getByRole('link', { name: /Voir nos réalisations/i })).toHaveAttribute('href', '/communication#portfolio');
  });

  test('WEB06-04/05/06 : ne fabrique ni statistique, ni témoignage, ni réalisation client', () => {
    renderHomepage();
    const section = screen.getByTestId('altcom-discovery');

    expect(section).not.toHaveTextContent(/\d+\+|témoignage|ils nous font confiance|nos clients|réalisation client/i);
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
    const image = within(section).getByRole('img');
    expect(image).toHaveAttribute('src', '/images/editorial-temp/altcom-studio-editorial.webp');
    expect(image).toHaveAccessibleName('Créatrice préparant une prise de vue dans un studio');
  });

  test('WEB06-07/08 : approfondit Altcom sans dupliquer les parcours IntentRouter ou Altimmo', () => {
    renderHomepage();
    const section = screen.getByTestId('altcom-discovery');

    expect(section).not.toHaveTextContent(/Trouver|Publier|Gérer|Acheter|Louer|Séjourner/i);
    expect(within(section).getByText('Communication 360°')).toBeInTheDocument();
    expect(within(section).getByText('Branding & design')).toBeInTheDocument();
    expect(within(section).getByText('Studio & contenus')).toBeInTheDocument();
  });

  test('WEB06-09 : retire la grille legacy remplacée de la homepage', () => {
    renderHomepage();
    expect(screen.queryByRole('heading', { name: /Trois pôles, une seule vision/i })).not.toBeInTheDocument();
  });
});
