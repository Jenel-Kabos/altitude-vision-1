import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import { searchAltimmo } from '../services/propertyService';

vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn() }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));

const publicProperty = (index) => ({
  _id: `public-${index}`,
  title: `Bien public ${index}`,
  type: 'Villa',
  status: 'Disponible',
  price: 100000000 + index,
  address: { city: 'Brazzaville' },
  images: [`https://res.cloudinary.com/altitude-vision/image/upload/public-${index}.jpg`],
});

beforeEach(() => {
  vi.clearAllMocks();
  searchAltimmo.mockResolvedValue({
    properties: [publicProperty(1), publicProperty(2), publicProperty(3)],
    total: 3,
  });
});

describe('WEB-VISUAL-01 — système photographique authentique de la homepage', () => {
  test('01/02/14 : préserve toutes les sections WEB-03→11, le headline Hero et un H1 unique', async () => {
    render(<HomePageNext />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Un bien à trouver/);
    expect(screen.getByRole('heading', { name: /Que voulez-vous faire/ })).toBeInTheDocument();
    expect(screen.getByTestId('altimmo-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('altcom-discovery')).toBeInTheDocument();
    expect(screen.getByTestId('web07-about')).toBeInTheDocument();
    expect(screen.getByTestId('web08-credibility')).toBeInTheDocument();
    expect(screen.getByTestId('mila-events-discovery')).toBeInTheDocument();
    expect(screen.queryByTestId('web10-continuation')).not.toBeInTheDocument();
    expect(screen.getByTestId('web11-trust')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await screen.findAllByTestId('altimmo-property')).toHaveLength(3);
  });

  test('03/04/05/06 : préserve les routes canoniques des trois branches', () => {
    render(<HomePageNext />);

    expect(screen.getAllByRole('link', { name: /Acheter/i })[0]).toHaveAttribute('href', '/immobilier/annonces?offerType=vente');
    expect(screen.getAllByRole('link', { name: /Louer/i })[0]).toHaveAttribute('href', '/immobilier/annonces?offerType=location');
    const orientation = screen.getByTestId('intent-router');
    expect(within(orientation).getByRole('link', { name: /Découvrir Altcom/i })).toHaveAttribute('href', '/communication');
    expect(within(orientation).getByRole('link', { name: /Découvrir Mila Events/i })).toHaveAttribute('href', '/evenementiel');
  });

  test('07/08/15 : rend les trois photos Altimmo valides, lazy-loaded, sans média externe non approuvé ni carousel', async () => {
    render(<HomePageNext />);
    const altimmo = screen.getByTestId('altimmo-discovery');
    const images = await within(altimmo).findAllByRole('img');

    expect(images).toHaveLength(3);
    images.forEach((image) => {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image.getAttribute('src')).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      expect(image).toHaveAccessibleName(/Bien public [123]/);
    });
    expect(within(altimmo).queryByRole('region', { name: /carousel|diaporama/i })).not.toBeInTheDocument();
  });

  test('09/10/11/12 : n’ajoute aucune fausse preuve visuelle ou métier', async () => {
    render(<HomePageNext />);
    await screen.findAllByTestId('altimmo-property');
    const homepage = screen.getByTestId('altimmo-discovery').parentElement;

    expect(homepage).not.toHaveTextContent(/portfolio fictif|client fictif|événement fictif|propriété fictive/i);
    expect(homepage).not.toHaveTextContent(/\d+ entreprises accompagnées|\d+ événements réalisés/i);
    expect(within(screen.getByTestId('altcom-discovery')).getByRole('img').getAttribute('src')).toMatch(/^\/images\/editorial-temp\//);
    expect(within(screen.getByTestId('mila-events-discovery')).getByRole('img').getAttribute('src')).toMatch(/^\/images\/editorial-temp\//);
  });

  test('13/20/21/22 : remplace immédiatement une photo en échec par le fallback éditorial', async () => {
    render(<HomePageNext />);
    const image = await screen.findByRole('img', { name: 'Bien public 1' });
    const card = image.closest('[data-testid="altimmo-property"]');

    fireEvent.error(image);

    expect(within(card).queryByRole('img')).not.toBeInTheDocument();
    expect(within(card).getByText('Sélection Altimmo')).toBeInTheDocument();
  });
});
