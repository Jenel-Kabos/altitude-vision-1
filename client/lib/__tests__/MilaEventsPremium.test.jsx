import React from 'react';
import { render, screen, within } from '@testing-library/react';
import MilaEventsDiscovery from '../components/public/MilaEventsDiscovery';

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_target, tag) => tag === 'create'
      ? (Component) => Component
      : ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileInView: _whileInView, viewport: _viewport, whileTap: _whileTap, whileHover: _whileHover, ...props }) => React.createElement(tag, props, children),
  });

  return {
    motion,
    AnimatePresence: ({ children }) => children,
    useInView: () => true,
    useReducedMotion: () => false,
  };
});

describe('MILA — premium homepage experience', () => {
  test('MILA-01/02/03/04 — presents the approved identity and concise editorial promise', () => {
    render(<MilaEventsDiscovery />);
    const section = screen.getByTestId('mila-events-discovery');

    expect(section).toHaveTextContent('Mila Events — Événementiel');
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Vos moments méritent une mise en scène inoubliable.',
    );
    expect(section).toHaveTextContent(
      'Mariages, galas, conférences et célébrations : nous imaginons des expériences où chaque détail participe à l’émotion.',
    );
    expect(section).not.toHaveTextContent(/parfait|garanti|meilleure agence|numéro 1|n°\s?1|\d+\s?%|\d+\+/i);
  });

  test('MILA-05/06/07 — exposes two live canonical continuations with the primary action first', () => {
    render(<MilaEventsDiscovery />);
    const section = screen.getByTestId('mila-events-discovery');
    const links = within(section).getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(/Imaginer mon événement/i);
    expect(links[0]).toHaveAttribute('href', '/evenementiel?openQuoteModal=true');
    expect(links[1]).toHaveAccessibleName(/Voir nos réalisations/i);
    expect(links[1]).toHaveAttribute('href', '/evenementiel#realisations');
    links.forEach((link) => expect(link.getAttribute('href')).toMatch(/^\/evenementiel/));
  });

  test('MILA-08/09/10 — uses editorial domains without fabricated proof', () => {
    render(<MilaEventsDiscovery />);
    const section = screen.getByTestId('mila-events-discovery');

    const domains = within(within(section).getByRole('list', { name: /expériences conçues/i })).getAllByRole('listitem');
    expect(domains).toHaveLength(3);
    expect(domains[0]).toHaveTextContent('Mariages & célébrations');
    expect(domains[1]).toHaveTextContent('Événements corporate');
    expect(domains[2]).toHaveTextContent('Scénographie & coordination');
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
    expect(section).not.toHaveTextContent(/client|témoignage|réalisé par|prix|award/i);
  });

  test('MILA-11 — the immersive temporary photograph is local, accessible and not presented as a realization', () => {
    render(<MilaEventsDiscovery />);
    const section = screen.getByTestId('mila-events-discovery');
    const image = within(section).getByRole('img');

    expect(within(section).getAllByRole('img')).toHaveLength(1);
    expect(image).toHaveAttribute('src', '/images/editorial-temp/mila-scenography-editorial.webp');
    expect(image).toHaveAccessibleName('Espace de réception scénographié entre lumière bleue et bougies');
    expect(within(section).getByText(/Photographie éditoriale temporaire/i)).toBeInTheDocument();
  });

  test('MILA-12 — essential content remains visible with reduced motion requested', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MilaEventsDiscovery />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();
    expect(screen.getByRole('img')).toBeVisible();
    expect(screen.getByRole('link', { name: /Imaginer mon événement/i })).toBeVisible();
  });
});
