import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import AltimmoDiscovery from '../components/public/AltimmoDiscovery';
import { searchAltimmo } from '../services/propertyService';

vi.mock('../services/propertyService', () => ({
  searchAltimmo: vi.fn(),
}));

const property = (overrides = {}) => ({
  _id: 'bien-1',
  title: 'Villa Les Manguiers',
  type: 'Villa',
  status: 'Disponible',
  price: 185000000,
  address: { city: 'Brazzaville' },
  images: ['https://res.cloudinary.com/altimmo/image/upload/villa.jpg'],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  searchAltimmo.mockResolvedValue({ properties: [property()], total: 1 });
});

describe('WEB-05 — découverte Altimmo sur la homepage', () => {
  test('WEB05-01 : conserve les trois parcours Altimmo certifiés pendant le chargement', () => {
    searchAltimmo.mockReturnValue(new Promise(() => {}));
    render(<AltimmoDiscovery />);

    expect(screen.getByRole('link', { name: /Acheter/i })).toHaveAttribute('href', '/immobilier/annonces?offerType=vente');
    expect(screen.getByRole('link', { name: /Louer/i })).toHaveAttribute('href', '/immobilier/annonces?offerType=location');
    expect(screen.getByRole('link', { name: /Séjourner/i })).toHaveAttribute('href', '/immobilier/sejourner');
    expect(screen.getByText(/Chargement des opportunités Altimmo/i)).toBeInTheDocument();
  });

  test('WEB05-02 : demande au service trois biens au maximum et n’en affiche jamais davantage', async () => {
    searchAltimmo.mockResolvedValue({
      properties: Array.from({ length: 5 }, (_, index) => property({ _id: `bien-${index + 1}`, title: `Bien ${index + 1}` })),
      total: 5,
    });
    render(<AltimmoDiscovery />);

    expect(await screen.findAllByTestId('altimmo-property')).toHaveLength(3);
    expect(searchAltimmo).toHaveBeenCalledWith({ limit: 3 });
    expect(screen.queryByText('Bien 4')).not.toBeInTheDocument();
  });

  test('WEB05-03 : affiche réellement images[0] lorsqu’elle est utilisable', async () => {
    render(<AltimmoDiscovery />);

    const image = await screen.findByRole('img', { name: 'Villa Les Manguiers' });
    expect(image).toHaveAttribute('src', 'https://res.cloudinary.com/altimmo/image/upload/villa.jpg');
  });

  test('HOTFIX-01 : affiche les images valides des trois biens, y compris le troisième', async () => {
    searchAltimmo.mockResolvedValue({
      properties: [
        property({ _id: 'bien-1', title: 'Villa', images: ['https://cdn.example.com/villa.jpg'] }),
        property({ _id: 'bien-2', title: 'Appartement', images: ['https://cdn.example.com/appartement.jpg'] }),
        property({ _id: 'bien-3', title: 'Bureau à louer', images: ['https://cdn.example.com/bureau.jpg'] }),
      ],
      total: 3,
    });
    render(<AltimmoDiscovery />);

    expect(await screen.findByRole('img', { name: 'Villa' })).toHaveAttribute('src', 'https://cdn.example.com/villa.jpg');
    expect(screen.getByRole('img', { name: 'Appartement' })).toHaveAttribute('src', 'https://cdn.example.com/appartement.jpg');
    expect(screen.getByRole('img', { name: 'Bureau à louer' })).toHaveAttribute('src', 'https://cdn.example.com/bureau.jpg');
    expect(within(screen.getByText('Bureau à louer').closest('[data-testid="altimmo-property"]')).queryByText('Sélection Altimmo')).not.toBeInTheDocument();
  });

  test.each([
    ['aucune image', []],
    ['une valeur vide', ['']],
    ['un protocole non affichable', ['javascript:alert(1)']],
  ])('WEB05-04 : rend un fallback éditorial pour %s', async (_label, images) => {
    searchAltimmo.mockResolvedValue({ properties: [property({ images })], total: 1 });
    render(<AltimmoDiscovery />);

    const card = await screen.findByTestId('altimmo-property');
    expect(within(card).queryByRole('img')).not.toBeInTheDocument();
    expect(within(card).getByText(/Sélection Altimmo/i)).toBeInTheDocument();
  });

  test('WEB05-05 : lie le bien à son détail seulement lorsqu’un _id existe', async () => {
    searchAltimmo.mockResolvedValue({
      properties: [property(), property({ _id: undefined, title: 'Maison sans identifiant' })],
      total: 2,
    });
    render(<AltimmoDiscovery />);

    expect(await screen.findByRole('link', { name: /Villa Les Manguiers/i })).toHaveAttribute('href', '/immobilier/property/bien-1');
    const unlinkedCard = screen.getByText('Maison sans identifiant').closest('[data-testid="altimmo-property"]');
    expect(unlinkedCard).not.toBeNull();
    expect(unlinkedCard.closest('a')).toBeNull();
    expect(document.querySelector('a[href="#"]')).toBeNull();
  });

  test('HOTFIX-02 : expose le catalogue comme CTA principal et conserve les deux actions existantes', async () => {
    render(<AltimmoDiscovery />);

    expect(await screen.findByRole('link', { name: /Voir nos annonces/i })).toHaveAttribute('href', '/immobilier/annonces');
    expect(screen.getByRole('link', { name: /Découvrir Altimmo/i })).toHaveAttribute('href', '/immobilier');
    expect(screen.getByRole('link', { name: /Confier mon bien/i })).toHaveAttribute('href', '/properties/submit');
  });

  test.each([
    ['vide', () => Promise.resolve({ properties: [], total: 0 })],
    ['erreur', () => Promise.reject(new Error('indisponible'))],
  ])('WEB05-06 : garde les parcours et rend un état %s sans donnée inventée', async (_label, response) => {
    searchAltimmo.mockImplementation(response);
    render(<AltimmoDiscovery />);

    expect(await screen.findByText(/Découvrez les biens proposés par Altimmo/i)).toBeInTheDocument();
    expect(screen.getByText(/Explorez nos opportunités immobilières/i)).toBeInTheDocument();
    expect(screen.queryByText(/Une sélection disponible/i)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Découvrir Altimmo' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('altimmo-property')).not.toBeInTheDocument());
  });
});
