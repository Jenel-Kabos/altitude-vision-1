import React from 'react';
import fs from 'fs';
import path from 'path';
import { cleanup, render, screen, within } from '@testing-library/react';

import FacebookFeed from '../components/FacebookFeed';
import HomePageNext from '../pages/HomePageNext';

vi.mock('next/image', () => ({
  default: ({ fill: _fill, sizes: _sizes, ...props }) => <img {...props} />,
}));

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

vi.mock('../components/Testimonials', () => ({ default: () => <section data-testid="legacy-testimonials">Avis</section> }));
vi.mock('../components/CtaCommission', () => ({ default: () => <section data-testid="legacy-cta">Devenez apporteur d’affaires</section> }));
vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn().mockResolvedValue({ properties: [] }) }));

const post = (overrides = {}) => ({
  _id: 'post-1',
  facebook_id: 'facebook-1',
  page_name: 'Altitude Vision',
  page_id: '267164619819268',
  message: 'Une publication réelle issue de la page officielle.',
  image: 'https://images.example.test/publication.jpg',
  permalink: 'https://www.facebook.com/267164619819268/posts/facebook-1',
  date_publication: '2026-09-20T10:00:00.000Z',
  date_sync: '2026-09-20T11:00:00.000Z',
  ...overrides,
});

const respond = (data, success = true) => vi.fn().mockResolvedValue({
  ok: success,
  json: vi.fn().mockResolvedValue({ success, data }),
});

describe('WEB-12 — publications et preuve sociale éditoriale', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', respond([]));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('PUB-01/02/09 : rend immédiatement une section publique avec une composition de chargement stable', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<FacebookFeed />);

    const section = screen.getByTestId('publications-editorial');
    expect(within(section).getByRole('heading', { level: 2, name: 'En ce moment chez Altitude Vision.' })).toBeVisible();
    expect(section).toHaveTextContent(/Projets, coulisses, conseils et actualités/i);
    expect(within(section).getByRole('status', { name: /Chargement des publications/i })).toBeVisible();
  });

  test('PUB-03/04/10 : affiche au plus trois publications et conserve leurs images et données réelles', async () => {
    global.fetch = respond(Array.from({ length: 5 }, (_, index) => post({
      _id: `post-${index + 1}`,
      facebook_id: `facebook-${index + 1}`,
      message: `Publication réelle ${index + 1}`,
      image: `https://images.example.test/post-${index + 1}.jpg`,
    })));
    render(<FacebookFeed />);

    const cards = await screen.findAllByTestId('publication-card');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByRole('img', { name: 'Publication réelle 1' })).toHaveAttribute(
      'src',
      'https://images.example.test/post-1.jpg',
    );
    expect(screen.queryByText('Publication réelle 4')).not.toBeInTheDocument();
  });

  test('PUB-11/12/13/14 : un post incomplet utilise un fallback neutre sans titre, date ou métrique inventés', async () => {
    global.fetch = respond([post({ message: '', image: '', date_publication: '', permalink: '' })]);
    render(<FacebookFeed />);

    const card = await screen.findByTestId('publication-card');
    expect(within(card).getByTestId('publication-image-fallback')).toBeVisible();
    expect(within(card).queryByRole('heading')).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/aujourd’hui|hier|j’aime|commentaire|partage|vue/i);
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  test.each([
    ['une réponse vide', respond([])],
    ['une erreur HTTP', respond([], false)],
    ['une panne réseau', vi.fn().mockRejectedValue(new Error('Failed to fetch: secret API detail'))],
  ])('PUB-06/07/08 : %s bascule vers le fallback sans erreur technique visible', async (_label, fetchImpl) => {
    global.fetch = fetchImpl;
    render(<FacebookFeed />);

    const fallback = await screen.findByTestId('publications-fallback');
    expect(fallback).toHaveTextContent(/Retrouvez nos actualités, nos coulisses/i);
    expect(fallback).toHaveTextContent(/Altimmo.*Altcom.*Mila Events/);
    expect(fallback).not.toHaveTextContent(/error|failed|fetch|API|indisponible/i);
    expect(within(fallback).getByRole('link', { name: /Découvrir nos actualités/i })).toHaveAttribute('href', '/actualites');
  });

  test('PUB-15/16 : utilise uniquement les destinations sociales vérifiées', async () => {
    render(<FacebookFeed />);

    const fallback = await screen.findByTestId('publications-fallback');
    expect(within(fallback).getByRole('link', { name: /Nous suivre sur Facebook/i })).toHaveAttribute(
      'href',
      'https://www.facebook.com/profile.php?id=61558493665509',
    );
    expect(within(fallback).getByRole('link', { name: /Nous suivre sur Instagram/i })).toHaveAttribute(
      'href',
      'https://www.instagram.com/immoaltitudevision/',
    );
    expect(fallback.querySelector('a[href*="tiktok"]')).toBeNull();
  });

  test('PUB-05 : ignore tout élément explicitement non public si une réponse malformée en contient', async () => {
    global.fetch = respond([
      post({ _id: 'public-post' }),
      post({ _id: 'private-post', message: 'Contenu privé interdit', visibility: 'private' }),
      post({ _id: 'draft-post', message: 'Brouillon interdit', status: 'draft' }),
    ]);
    render(<FacebookFeed />);

    expect(await screen.findByText(/Une publication réelle issue/i)).toBeVisible();
    expect(screen.queryByText('Contenu privé interdit')).not.toBeInTheDocument();
    expect(screen.queryByText('Brouillon interdit')).not.toBeInTheDocument();
  });

  test('PUB-17/18/19/20 : reste statique, sans dépendance sociale ni contrôle de carousel', async () => {
    render(<FacebookFeed />);
    await screen.findByTestId('publications-fallback');

    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.dependencies).not.toHaveProperty('swiper');
    expect(pkg.dependencies).not.toHaveProperty('slick-carousel');
    expect(Object.keys(pkg.dependencies)).not.toEqual(expect.arrayContaining([expect.stringMatching(/facebook|instagram|tiktok/i)]));
    expect(screen.queryByRole('button', { name: /suivant|précédent|pause/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('motion-publications')).toBeInTheDocument();
  });

  test('PUB-22 à PUB-35 : conserve la homepage certifiée et place Publications après le CTA final', async () => {
    render(<HomePageNext />);

    const publications = await screen.findByTestId('publications-editorial');
    const ids = [
      'hero-commercial', 'intent-router', 'altimmo-discovery', 'altcom-discovery',
      'mila-events-discovery', 'realisations-editorial', 'web07-about',
      'web08-credibility', 'web11-trust', 'commercial-final-cta',
      'publications-editorial', 'legacy-testimonials', 'legacy-cta',
    ];
    const nodes = ids.map((id) => screen.getByTestId(id));
    nodes.slice(1).forEach((node, index) => {
      expect(nodes[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getByTestId('hero-commercial')).toHaveTextContent(/Un bien à trouver/i);
    expect(screen.getByTestId('realisations-editorial')).toHaveTextContent('Nos univers en images');
    expect(screen.getByTestId('commercial-final-cta')).toHaveTextContent(/Un projet en tête.*Parlons-en/s);
    expect(publications).toHaveTextContent('En ce moment chez Altitude Vision.');
  });
});
