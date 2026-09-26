import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import ClientLayout, { isPublicSitePath } from '../../app/ClientLayout';
import PublicFoundationSpecimen from '../components/public/PublicFoundationSpecimen';
import { PublicButton, PublicContainer, PublicSectionHeading, PublicSite } from '../components/public/PublicPrimitives';

const usePathnameMock = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => usePathnameMock() }));
vi.mock('../components/layout/Header', () => ({ default: () => <header>Header</header> }));
vi.mock('../components/layout/Footer', () => ({ default: () => <footer>Footer</footer> }));
vi.mock('../components/CookieBanner', () => ({ default: () => null }));

const stylesheet = resolve('lib/components/public/PublicFoundation.module.css');

describe('WEB-02 — fondation visuelle publique isolée', () => {
  test.each([
    ['/', true], ['/immobilier', true], ['/immobilier/hotels/hotel-1', true], ['/properties/list', true],
    ['/communication', true], ['/evenementiel', true], ['/contact', true],
    ['/login', false], ['/register', false], ['/dashboard', false],
    ['/admin', false], ['/mes-biens', false], ['/immobilier/dossiers', false],
  ])('WEB02-01/02 : %s reçoit le scope public = %s', (pathname, expected) => {
    expect(isPublicSitePath(pathname)).toBe(expected);
    usePathnameMock.mockReturnValue(pathname);
    const { container } = render(<ClientLayout><div>contenu</div></ClientLayout>);
    expect(Boolean(container.querySelector('[data-public-site="true"]'))).toBe(expected);
  });

  test('WEB02-03 : le bouton principal en lien garde une sémantique de navigation', () => {
    render(<PublicSite><PublicButton href="/immobilier">Explorer</PublicButton></PublicSite>);
    const link = screen.getByRole('link', { name: 'Explorer' });
    expect(link).toHaveAttribute('href', '/immobilier');
    expect(link).toHaveAttribute('data-public-button', 'primary');
  });

  test('WEB02-04 : le bouton secondaire conserve une sémantique button et son état disabled', () => {
    render(<PublicSite><PublicButton variant="secondary" disabled>Découvrir</PublicButton></PublicSite>);
    const button = screen.getByRole('button', { name: 'Découvrir' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-public-button', 'secondary');
  });

  test('WEB02-05/07/08 : les tokens, accents et motion sont limités au scope public', () => {
    const css = readFileSync(stylesheet, 'utf8');
    expect(css).toContain('.publicSite');
    expect(css).toContain('--public-accent: #AE8540');
    expect(css).toContain('--altimmo-accent: #B85016');
    expect(css).toContain('--altcom-accent: #B62E36');
    expect(css).toContain('--mila-accent: #2459A6');
    expect(css).not.toMatch(/(^|\n)\s*:root\s*\{/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('WEB02-06 : les primitives se rendent sans auth ni contexte tenant', () => {
    render(<PublicSite><PublicContainer><PublicSectionHeading eyebrow="Fondation">Titre</PublicSectionHeading></PublicContainer></PublicSite>);
    expect(screen.getByText('Fondation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Titre' })).toBeInTheDocument();
  });

  test('WEB02-09 : le spécimen conserve une structure mobile sans éléments décoratifs requis', () => {
    render(<PublicFoundationSpecimen />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Des services de terrain.');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Une expression éditoriale');
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('public-foundation-specimen').closest('[data-public-site="true"]')).not.toBeNull();
  });

});
