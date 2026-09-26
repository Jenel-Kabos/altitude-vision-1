import React from 'react';
import fs from 'fs';
import path from 'path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';

import HomePageNext from '../pages/HomePageNext';
import AltimmoDiscovery from '../components/public/AltimmoDiscovery';
import { searchAltimmo } from '../services/propertyService';

vi.mock('framer-motion', () => {
  const make = (tag) => ({
    children,
    initial: _initial,
    animate: _animate,
    whileInView: _whileInView,
    viewport: _viewport,
    variants: _variants,
    transition: _transition,
    ...props
  }) => React.createElement(tag, props, children);

  return {
    motion: new Proxy({}, { get: (_target, tag) => tag === 'create' ? (Component) => Component : make(tag) }),
    useReducedMotion: () => false,
  };
});

vi.mock('../components/FacebookFeed', () => ({ default: () => <section data-testid="legacy-publications">Publications</section> }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => <section data-testid="legacy-cta">Apporteur d’affaires</section> }));
vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn() }));

const publishedProperty = {
  _id: 'property-public-1',
  title: 'Villa des tests',
  type: 'Villa',
  address: { city: 'Brazzaville' },
  price: 125000000,
  status: 'disponible',
  images: ['/images/property-public.webp'],
};

describe('WEB-COMMERCIAL-01.1 — calibration commerciale et visuelle', () => {
  beforeEach(() => {
    searchAltimmo.mockResolvedValue({ properties: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('CAL-01 à CAL-07 : Hero et IntentRouter conservent textes, CTA, médias et routes', () => {
    render(<HomePageNext />);

    const hero = screen.getByTestId('hero-commercial');
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(
      /Un bien à trouver \?\s*Une entreprise à faire connaître \?\s*Un événement à organiser \?/,
    );
    expect(hero).toHaveTextContent('Trois expertises. Un seul partenaire pour faire avancer vos projets.');
    expect(hero).toHaveTextContent('Altitude Vision réunit immobilier, communication et événementiel pour accompagner vos projets de l’idée à leur réalisation.');
    expect(within(hero).getByRole('link', { name: /Découvrir nos solutions/i })).toHaveAttribute('href', '#solutions');
    expect(within(hero).getByRole('link', { name: /Parler de mon projet/i })).toHaveAttribute('href', '/contact');
    expect(within(hero).getAllByRole('img').map((image) => image.getAttribute('src'))).toEqual([
      '/images/editorial-temp/realisations-altimmo.webp',
      '/images/editorial-temp/realisations-altcom.webp',
      '/images/editorial-temp/realisations-mila.webp',
    ]);

    const intent = screen.getByTestId('intent-router');
    expect(intent).toHaveTextContent('Trouver ou confier un bien');
    expect(intent).toHaveTextContent('Faire connaître mon entreprise');
    expect(intent).toHaveTextContent('Préparer un événement');
    expect(within(intent).getByRole('link', { name: /Découvrir Altimmo/i })).toHaveAttribute('href', '/immobilier');
  });

  test('CAL-08 : Altimmo conserve son état alimenté par de vraies données', async () => {
    searchAltimmo.mockResolvedValue({ properties: [publishedProperty] });
    render(<AltimmoDiscovery />);

    expect(await screen.findByRole('heading', { level: 3, name: 'Villa des tests' })).toBeVisible();
    expect(screen.getByText('Une sélection disponible')).toBeVisible();
    expect(screen.getByText(/125.000.000 FCFA/)).toBeVisible();
  });

  test('CAL-09/CAL-10 : l’état vide utilise un titre durable sans prétendre afficher un bien réel', async () => {
    searchAltimmo.mockResolvedValue({ properties: [] });
    render(<AltimmoDiscovery />);

    expect(await screen.findByText('Explorez nos opportunités immobilières')).toBeVisible();
    expect(screen.queryByText('Une sélection disponible')).not.toBeInTheDocument();
    expect(screen.queryByTestId('altimmo-property')).not.toBeInTheDocument();
    expect(screen.queryByText(/FCFA|m²|référence/i)).not.toBeInTheDocument();
  });

  test('CAL-09/CAL-10 : l’erreur de chargement reprend le même fallback éditorial sûr', async () => {
    searchAltimmo.mockRejectedValue(new Error('API locale indisponible'));
    render(<AltimmoDiscovery />);

    expect(await screen.findByText('Explorez nos opportunités immobilières')).toBeVisible();
    expect(screen.queryByText(/pas disponibles|erreur|API/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('altimmo-property')).not.toBeInTheDocument();
  });

  test('CAL-11 à CAL-14 : Altcom et Mila conservent leurs messages et CTA', () => {
    render(<HomePageNext />);

    const altcom = screen.getByTestId('altcom-discovery');
    expect(altcom).toHaveTextContent(/Votre entreprise mérite une communication\s*à la hauteur de ses ambitions\./);
    expect(within(altcom).getByRole('link', { name: /Voir nos réalisations/i })).toHaveAttribute('href', '/communication#portfolio');
    expect(within(altcom).getByRole('link', { name: /Demander un devis/i })).toHaveAttribute('href', '/communication?openQuoteModal=true');

    const mila = screen.getByTestId('mila-events-discovery');
    expect(mila).toHaveTextContent(/Vos moments méritent\s*une mise en scène inoubliable\./);
    expect(within(mila).getByRole('link', { name: /Voir nos réalisations/i })).toHaveAttribute('href', '/evenementiel#realisations');
    expect(within(mila).getByRole('link', { name: /Imaginer mon événement/i })).toHaveAttribute('href', '/evenementiel?openQuoteModal=true');
  });

  test('CAL-15 à CAL-17 : les médias temporaires sont présentés comme des univers, pas comme des projets réalisés', () => {
    render(<HomePageNext />);
    const gallery = screen.getByTestId('realisations-editorial');

    expect(within(gallery).getByRole('heading', { level: 2, name: 'Nos univers en images' })).toBeVisible();
    expect(gallery).not.toHaveTextContent(/projet client|réalisé par Altitude Vision/i);
    expect(within(gallery).getAllByRole('img')).toHaveLength(3);
  });

  test('CAL-18 à CAL-22 : la réassurance et le CTA final conservent tous leurs contenus', () => {
    render(<HomePageNext />);

    expect(screen.getByTestId('web07-about')).toHaveTextContent(/Des métiers différents\.\s*Une vision commune\./);
    expect(screen.getByTestId('web08-credibility')).toHaveTextContent(/Du besoin à la réalisation,\s*un suivi clair à chaque étape\./);
    expect(screen.getByTestId('web11-trust')).toHaveTextContent(/Clarté dans l’échange\.\s*Exigence dans l’exécution\./);
    expect(screen.getByTestId('web11-trust')).toHaveTextContent(/Clarté.*Rigueur.*Cohérence/);
    const finalCta = screen.getByTestId('commercial-final-cta');
    expect(finalCta).toHaveTextContent(/Un projet en tête \?\s*Parlons-en\./);
    expect(within(finalCta).getByRole('link', { name: /Parler de mon projet/i })).toHaveAttribute('href', '/contact');
  });

  test('CAL-23 à CAL-27 : aucune dépendance, photographie, carousel ou motion parallèle', () => {
    render(<HomePageNext />);
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));

    expect(pkg.dependencies['framer-motion']).toBe('^12.23.24');
    expect(pkg.dependencies).not.toHaveProperty('swiper');
    expect(pkg.dependencies).not.toHaveProperty('slick-carousel');
    expect(screen.queryByRole('button', { name: /suivant|précédent|pause/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('motion-hero')).toBeInTheDocument();
    expect(screen.getByTestId('motion-approach')).toBeInTheDocument();
    expect(screen.getByTestId('motion-method')).toBeInTheDocument();
    expect(screen.getByTestId('motion-trust')).toBeInTheDocument();
  });

  test('CAL-28 à CAL-32 : l’ordre commercial certifié reste inchangé jusqu’aux blocs legacy', async () => {
    render(<HomePageNext />);
    await waitFor(() => expect(searchAltimmo).toHaveBeenCalled());

    const order = [
      'hero-commercial', 'intent-router', 'altimmo-discovery', 'altcom-discovery',
      'mila-events-discovery', 'realisations-editorial', 'web07-about',
      'web08-credibility', 'web11-trust', 'commercial-final-cta',
      'legacy-publications', 'legacy-cta',
    ].map((id) => screen.getByTestId(id));

    order.slice(0, -1).forEach((node, index) => {
      expect(node.compareDocumentPosition(order[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
