import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SejournerLandingPage from '../pages/SejournerLandingPage';
import AltimmoAnnonces from '../pages/AltimmoAnnonces';
import api from '../services/api';
import BuyPage from '../../app/immobilier/acheter/page';
import RentPage from '../../app/immobilier/louer/page';

let currentSearchParams = new URLSearchParams();
const redirect = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({ replace, push: vi.fn() }),
  redirect: (...args) => redirect(...args),
}));
// Run the real searchAltimmo serializer; no real HTTP requests.
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams();
  api.get.mockResolvedValue({ data: { status: 'success', data: { properties: [], total: 0 } } });
});

async function expectSearch(query, values) {
  currentSearchParams = new URLSearchParams(query);
  render(<AltimmoAnnonces />);
  await waitFor(() => {
    const urls = api.get.mock.calls.map(([url]) => new URL(url, 'http://local.test'));
    expect(urls.some(url => url.pathname === '/altimmo/search' &&
      Object.entries(values).every(([key, value]) => url.searchParams.get(key) === value))).toBe(true);
  });
}

describe('WEB-01 — navigation vers la recherche canonique', () => {
  test.each([
    ['STAY-01 acheter', BuyPage, 'vente'],
    ['STAY-02 louer', RentPage, 'location'],
  ])('%s conserve le filtre jusqu’à la requête publique', async (_name, Page, offerType) => {
    Page();
    const url = redirect.mock.calls[0][0];
    expect(url.split('?')[0]).toBe('/immobilier/annonces');
    await expectSearch(url.split('?')[1], { offerType, propertyType: null, accommodationType: null });
  });

  test.each([
    ['Appartements', 'appartement_meuble'], ['Villas', 'villa_meublee'], ['Studios', 'studio_meuble'],
  ])('STAY-03 : %s transmet sa catégorie jusqu’à l’API', async (label, category) => {
    const page = render(<SejournerLandingPage />);
    const href = screen.getByRole('link', { name: new RegExp(label) }).getAttribute('href');
    expect(href).toBe(`/immobilier/annonces?offerType=hebergement&accommodationType=${category}`);
    page.unmount();
    await expectSearch(href.split('?')[1], { offerType: 'hebergement', accommodationType: category, propertyType: null });
  });

  test('STAY-04 : Hôtels conserve sa destination dédiée', () => {
    render(<SejournerLandingPage />);
    expect(screen.getByRole('link', { name: /Hôtels/ })).toHaveAttribute('href', '/immobilier/hotels');
  });

  test('tous les hébergements utilise offerType sans imposer de catégorie', async () => {
    const page = render(<SejournerLandingPage />);
    const href = screen.getByRole('link', { name: 'tous les hébergements' }).getAttribute('href');
    expect(href).toBe('/immobilier/annonces?offerType=hebergement');
    page.unmount();
    await expectSearch(href.split('?')[1], { offerType: 'hebergement', accommodationType: null, propertyType: null });
  });

  test.each(['appartement_meuble', 'villa_meublee', 'studio_meuble'])(
    'STAY-05 : ancien lien status=hebergement&type=%s reste précis', async category => {
      await expectSearch(`status=hebergement&type=${category}`, {
        offerType: 'hebergement', accommodationType: category, propertyType: null,
      });
    },
  );

  test('la catégorie canonique explicite prime sur un ancien type contradictoire', async () => {
    await expectSearch('status=hebergement&type=villa_meublee&accommodationType=studio_meuble', {
      offerType: 'hebergement', accommodationType: 'studio_meuble', propertyType: null,
    });
  });

  test('un ancien type immobilier ne devient pas une catégorie hébergement', async () => {
    await expectSearch('status=hebergement&type=Bureau', {
      offerType: 'hebergement', accommodationType: null, propertyType: null,
    });
  });
});
