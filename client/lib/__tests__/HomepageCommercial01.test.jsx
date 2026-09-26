import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, within } from '@testing-library/react';

import HomePageNext from '../pages/HomePageNext';

vi.mock('../components/FacebookFeed', () => ({ default: () => <section data-testid="legacy-publications">Publications</section> }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/CtaCommission', () => ({ default: () => null }));
vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn().mockResolvedValue({ properties: [] }) }));

describe('WEB-COMMERCIAL-01 — désir et conversion homepage', () => {
  test('COMM-01/02/03 : un H1 unique exprime les trois besoins clients', () => {
    render(<HomePageNext />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/Un bien à trouver/);
    expect(headings[0]).toHaveTextContent(/Une entreprise à faire connaître/);
    expect(headings[0]).toHaveTextContent(/Un événement à organiser/);
  });

  test('COMM-07/08/09 : les deux CTA Hero utilisent des destinations sûres', () => {
    render(<HomePageNext />);
    const hero = screen.getByTestId('hero-commercial');
    expect(within(hero).getByRole('link', { name: /Découvrir nos solutions/i })).toHaveAttribute('href', '#solutions');
    expect(within(hero).getByRole('link', { name: /Parler de mon projet/i })).toHaveAttribute('href', '/contact');
  });

  test('COMM-04/05/06 : les trois métiers sont commercialement compréhensibles', () => {
    render(<HomePageNext />);
    expect(screen.getByTestId('altimmo-discovery')).toHaveTextContent(/trouver|confier|acheter|louer/i);
    expect(screen.getByTestId('altcom-discovery')).toHaveTextContent(/communication|branding|studio/i);
    expect(screen.getByTestId('mila-events-discovery')).toHaveTextContent(/Mariages|Conférences|Galas/i);
  });

  test('COMM-16 à COMM-20 : réalisations, devis et conversion pointent vers les flux existants', () => {
    render(<HomePageNext />);
    const altcom = screen.getByTestId('altcom-discovery');
    const mila = screen.getByTestId('mila-events-discovery');
    expect(within(altcom).getByRole('link', { name: /Voir nos réalisations/i })).toHaveAttribute('href', '/communication#portfolio');
    expect(within(altcom).getByRole('link', { name: /Demander un devis/i })).toHaveAttribute('href', '/communication?openQuoteModal=true');
    expect(within(mila).getByRole('link', { name: /Voir nos réalisations/i })).toHaveAttribute('href', '/evenementiel#realisations');
    expect(within(mila).getByRole('link', { name: /Imaginer mon événement/i })).toHaveAttribute('href', '/evenementiel?openQuoteModal=true');
    expect(within(screen.getByTestId('commercial-final-cta')).getByRole('link', { name: /Parler de mon projet/i })).toHaveAttribute('href', '/contact');
  });

  test('COMM-10 à COMM-13 : aucune preuve ou attribution fictive', () => {
    render(<HomePageNext />);
    const root = screen.getByTestId('commercial-homepage');
    const commercialText = [
      'hero-commercial', 'intent-router', 'altimmo-discovery', 'altcom-discovery',
      'mila-events-discovery', 'realisations-editorial', 'commercial-final-cta',
    ].map((id) => screen.getByTestId(id).textContent).join(' ');
    expect(commercialText).not.toMatch(/\d+\+|\d+\s?%|leader|n°\s?1|projet client|réalisé par/i);
    expect(within(root).queryByRole('blockquote')).not.toBeInTheDocument();
  });

  test('COMM-21 à COMM-25 : motion et médias existants, sans carousel ni dépendance', () => {
    render(<HomePageNext />);
    expect(screen.getByTestId('motion-hero')).toBeInTheDocument();
    expect(screen.getAllByRole('img').some((image) => image.getAttribute('src')?.startsWith('/images/editorial-temp/'))).toBe(true);
    expect(screen.queryByRole('button', { name: /suivant|précédent|pause/i })).not.toBeInTheDocument();
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.dependencies).not.toHaveProperty('swiper');
    expect(pkg.dependencies).not.toHaveProperty('slick-carousel');
  });

  test('COMM-26/29/30 : ordre commercial avant réassurance et legacy', () => {
    render(<HomePageNext />);
    const order = [
      'hero-commercial', 'intent-router', 'altimmo-discovery', 'altcom-discovery',
      'mila-events-discovery', 'realisations-editorial', 'web07-about',
      'web08-credibility', 'web11-trust', 'commercial-final-cta', 'legacy-publications',
    ].map((id) => screen.getByTestId(id));
    order.slice(0, -1).forEach((node, index) => {
      expect(node.compareDocumentPosition(order[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
