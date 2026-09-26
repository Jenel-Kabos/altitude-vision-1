import React from 'react';
import fs from 'fs';
import path from 'path';
import { cleanup, render, screen, within } from '@testing-library/react';

import CtaCommission from '../components/CtaCommission';
import HomePageNext from '../pages/HomePageNext';

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
    useReducedMotion: () => true,
  };
});

vi.mock('../components/FacebookFeed', () => ({
  default: () => <section data-testid="web12-publications">En ce moment chez Altitude Vision.</section>,
}));
vi.mock('../components/Testimonials', () => ({
  default: () => <section data-testid="legacy-testimonials">Avis</section>,
}));
vi.mock('../services/propertyService', () => ({ searchAltimmo: vi.fn().mockResolvedValue({ properties: [] }) }));

describe('WEB-13 — apporteur d’affaires premium', () => {
  afterEach(() => cleanup());

  test('WEB13-01/02 : la homepage présente la nouvelle proposition commerciale', () => {
    render(<HomePageNext />);

    const section = screen.getByTestId('apporteur-premium');
    expect(within(section).getByRole('heading', {
      level: 2,
      name: /Vous connaissez un bien\s*\?\s*Faites-nous la mise en relation\./,
    })).toBeVisible();
    expect(section).toHaveTextContent('Altitude Vision — Apporteur d’affaires');
  });

  test('WEB13-03/04 : le pourcentage reste conditionnel et contextualisé', () => {
    render(<CtaCommission />);

    const section = screen.getByTestId('apporteur-premium');
    expect(section).toHaveTextContent(/Jusqu’à\s*30\s*%\s*de la commission Altitude Vision/i);
    expect(section).toHaveTextContent(/transaction éligible et finalisée/i);
    expect(section).not.toHaveTextContent(/30\s*% garanti|gagnez 30\s*%|automatiquement 30\s*%/i);
  });

  test('WEB13-05 : le CTA décrit le calculateur existant et conserve sa route', () => {
    render(<CtaCommission />);

    const section = screen.getByTestId('apporteur-premium');
    expect(within(section).getByRole('link', { name: /Estimer ma part/i })).toHaveAttribute(
      'href',
      '/trouve-ta-commission',
    );
    expect(within(section).getAllByRole('link')).toHaveLength(1);
  });

  test('WEB13-06/07 : aucune statistique ni preuve sociale invérifiable ne subsiste', () => {
    render(<CtaCommission />);

    const section = screen.getByTestId('apporteur-premium');
    expect(section).not.toHaveTextContent(/0 FCFA|24h|200\+|témoignage|sans délai|programme actif/i);
    expect(within(section).queryByRole('blockquote')).not.toBeInTheDocument();
  });

  test('WEB13-08/12 : la section reste un composant public sans route ni dépendance backend', () => {
    render(<CtaCommission />);

    const source = fs.readFileSync(path.resolve(__dirname, '../components/CtaCommission.jsx'), 'utf8');
    expect(screen.getByTestId('apporteur-premium')).toBeVisible();
    expect(source).not.toMatch(/axios|\/api\/|\.\.\/\.\.\/server|useAuth|useRouter/);
    expect(source).not.toMatch(/app\/|route\.(js|jsx)/);
  });

  test('WEB13-09/10 : WEB-12, le CTA final et l’ordre commercial restent inchangés', () => {
    render(<HomePageNext />);

    const publications = screen.getByTestId('web12-publications');
    const finalCta = screen.getByTestId('commercial-final-cta');
    const testimonials = screen.getByTestId('legacy-testimonials');
    const apporteur = screen.getByTestId('apporteur-premium');

    expect(publications).toHaveTextContent('En ce moment chez Altitude Vision.');
    expect(finalCta).toHaveTextContent(/Un projet en tête\s*\?\s*Parlons-en\./i);
    expect(finalCta.compareDocumentPosition(publications) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(publications.compareDocumentPosition(testimonials) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(testimonials.compareDocumentPosition(apporteur) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('WEB13-11 : la primitive motion reste visible en mode reduced motion', () => {
    render(<CtaCommission />);

    const motionRoot = screen.getByTestId('motion-apporteur');
    expect(motionRoot).toBeVisible();
    expect(motionRoot).toHaveAttribute('data-motion-kind', 'reveal');
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();
  });
});
