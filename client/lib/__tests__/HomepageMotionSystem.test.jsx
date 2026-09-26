import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, within } from '@testing-library/react';

import HomePageNext from '../pages/HomePageNext';

vi.mock('framer-motion', () => {
  const make = (tag) => ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileInView: _whileInView, viewport: _viewport, whileTap: _whileTap, whileHover: _whileHover, variants: _variants, ...props }) => React.createElement(tag, props, children);
  return {
    motion: new Proxy({}, { get: (_target, tag) => tag === 'create' ? (Component) => Component : make(tag) }),
    AnimatePresence: ({ children }) => children,
    useReducedMotion: () => false,
  };
});

vi.mock('../components/CtaCommission', () => ({ default: () => <section>Devenez apporteur d’affaires</section> }));
vi.mock('../components/Testimonials', () => ({ default: () => null }));
vi.mock('../components/FacebookFeed', () => ({ default: () => <section>Nos Dernières Publications</section> }));
vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn().mockResolvedValue({ properties: [] }) }));

describe('WEB-MOTION-01 — orchestration homepage', () => {
  test('M-03 à M-10 : conserve le H1, les CTA, les routes et la galerie éditoriale', async () => {
    render(<HomePageNext />);

    expect(screen.getByRole('heading', { level: 1, name: /Un bien à trouver/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /Découvrir nos solutions/i })).toHaveAttribute('href', '#solutions');
    expect(screen.getAllByRole('link', { name: /Parler de mon projet/i })[0]).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: /Confier un bien/i })).toHaveAttribute('href', '/properties/submit');
    expect(screen.getByRole('link', { name: /Acheter/i })).toHaveAttribute('href', '/immobilier/annonces?offerType=vente');
    const orientation = screen.getByTestId('intent-router');
    expect(within(orientation).getByRole('link', { name: /Découvrir Altcom/i })).toHaveAttribute('href', '/communication');
    expect(within(orientation).getByRole('link', { name: /Découvrir Mila Events/i })).toHaveAttribute('href', '/evenementiel');
    expect(screen.getByRole('heading', { level: 2, name: 'Nos univers en images' })).toBeVisible();
  });

  test('chaque moment éditorial approuvé reçoit une orchestration motion bornée', () => {
    render(<HomePageNext />);

    ['hero', 'intent', 'altimmo', 'altcom', 'approach', 'method', 'mila', 'realisations', 'trust', 'commercial-final']
      .forEach((region) => expect(screen.getByTestId(`motion-${region}`)).toBeInTheDocument());
  });

  test('M-17/M-18 : les sept photographies et le manifeste de remplacement restent inchangés', () => {
    render(<HomePageNext />);
    const srcs = screen.getAllByRole('img').map((image) => image.getAttribute('src'));

    expect(srcs).toEqual(expect.arrayContaining([
      '/images/editorial-temp/altcom-studio-editorial.webp',
      '/images/editorial-temp/mila-scenography-editorial.webp',
      '/images/editorial-temp/realisations-altimmo.webp',
      '/images/editorial-temp/realisations-altcom.webp',
      '/images/editorial-temp/realisations-mila.webp',
    ]));
    expect(fs.existsSync(path.resolve(__dirname, '../../docs/editorial-temp-media.md'))).toBe(true);
  });

  test('M-13 à M-16 : n’ajoute ni carousel, ni scroll-jacking, ni smooth-scroll', () => {
    render(<HomePageNext />);
    expect(screen.queryByRole('button', { name: /suivant|précédent|pause/i })).not.toBeInTheDocument();

    const homepage = fs.readFileSync(path.resolve(__dirname, '../pages/HomePageNext.jsx'), 'utf8');
    expect(homepage).not.toMatch(/scroll-behavior\s*:\s*smooth|scroll-snap|setInterval\(/);
  });

  test('M-23/M-24 : liens et focus restent natifs dans les sections animées', () => {
    render(<HomePageNext />);
    const intent = screen.getByTestId('motion-intent');
    const links = within(intent).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link.tagName).toBe('A'));
  });
});
