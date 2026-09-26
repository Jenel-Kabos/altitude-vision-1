import React from 'react';
import { render, screen, within } from '@testing-library/react';
import HomePageNext from '../pages/HomePageNext';
import AltitudeContinuation from '../components/public/AltitudeContinuation';

vi.mock('../components/CtaCommission', () => ({ default: () => null }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/FacebookFeed', () => ({ default: () => null }));
vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn().mockResolvedValue({ properties: [] }) }));

describe('WEB-10 — continuation éditoriale', () => {
  test('reste disponible dans le code mais est retirée de la homepage devenue redondante', () => {
    render(<HomePageNext />);
    expect(screen.queryByTestId('web10-continuation')).not.toBeInTheDocument();
  });

  test('se rend sans auth ni contexte avec ses routes canoniques', () => {
    render(<AltitudeContinuation />);
    const section = screen.getByTestId('web10-continuation');
    expect(within(section).getByRole('heading', { level: 2 })).toBeVisible();
    expect(within(section).getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual(expect.arrayContaining(['/immobilier', '/evenementiel', '/communication']));
  });

  test('ne contient ni preuve inventée, ni erreur technique, ni média', () => {
    render(<AltitudeContinuation />);
    const section = screen.getByTestId('web10-continuation');
    expect(section).not.toHaveTextContent(/\d+\+|\d+\s?%|témoignage|Impossible de charger|tenantId|ownerId/i);
    expect(within(section).queryAllByRole('img')).toHaveLength(0);
  });
});
