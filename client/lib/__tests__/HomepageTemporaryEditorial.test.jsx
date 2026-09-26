import React from 'react';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import { searchAltimmo } from '../services/propertyService';

vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn() }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));

const publicProperty = {
  _id: 'public-property',
  title: 'Bien public validé',
  images: ['https://res.cloudinary.com/altitude-vision/image/upload/public-property.jpg'],
};

beforeEach(() => {
  vi.clearAllMocks();
  searchAltimmo.mockResolvedValue({ properties: [publicProperty], total: 1 });
});

describe('WEB-VISUAL-02 — photographie éditoriale temporaire', () => {
  test('préserve le contenu durable et ajoute les moments photographiques structurants', async () => {
    render(<HomePageNext />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Un bien à trouver/);
    expect(screen.getByTestId('hero-editorial-media')).toBeInTheDocument();
    expect(screen.getByTestId('altcom-editorial-media')).toBeInTheDocument();
    expect(screen.getByTestId('mila-editorial-media')).toBeInTheDocument();
    expect(screen.getByTestId('realisations-editorial')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nos univers en images' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  test('emploie uniquement des médias temporaires locaux dans les nouveaux emplacements', async () => {
    render(<HomePageNext />);
    await screen.findByAltText('Bien public validé');

    const temporaryImages = screen.getAllByRole('img').filter((image) => image.getAttribute('src')?.includes('/images/editorial-temp/'));
    expect(temporaryImages).toHaveLength(8);
    temporaryImages.forEach((image) => {
      expect(image.getAttribute('src')).toMatch(/^\/images\/editorial-temp\/[a-z0-9-]+\.webp$/);
      expect(image).toHaveAttribute('width');
      expect(image).toHaveAttribute('height');
    });
    expect(screen.queryByText(/photo temporaire|stock photo|placeholder/i)).not.toBeInTheDocument();
  });

  test('préserve la priorité de la vraie image publique Altimmo et réserve le stock au fallback sans donnée', async () => {
    const { unmount } = render(<HomePageNext />);
    const realImage = await screen.findByAltText('Bien public validé');
    expect(realImage).toHaveAttribute('src', publicProperty.images[0]);
    expect(within(screen.getByTestId('altimmo-discovery')).queryByTestId('altimmo-editorial-fallback')).not.toBeInTheDocument();
    unmount();

    searchAltimmo.mockResolvedValue({ properties: [], total: 0 });
    render(<HomePageNext />);
    expect(await within(screen.getByTestId('altimmo-discovery')).findByTestId('altimmo-editorial-fallback')).toHaveAttribute(
      'src',
      '/images/editorial-temp/altimmo-editorial.webp',
    );
  });

  test('la section réalisations reste générique, éditoriale et sans fausse preuve nommée', () => {
    render(<HomePageNext />);
    const section = screen.getByTestId('realisations-editorial');

    expect(within(section).getByText('Altimmo')).toBeInTheDocument();
    expect(within(section).getByText('Altcom')).toBeInTheDocument();
    expect(within(section).getByText('Mila Events')).toBeInTheDocument();
    expect(within(section).getAllByRole('img')).toHaveLength(3);
    expect(section).not.toHaveTextContent(/client x|projet 0\d|réalisé par|villa vendue|mariage .+ & .+|\b2026\b/i);
  });

  test('ne transforme pas la narration éditoriale en carousel automatique', () => {
    render(<HomePageNext />);
    expect(screen.queryByRole('region', { name: /carousel|diaporama/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suivant|précédent|pause/i })).not.toBeInTheDocument();
  });
});
