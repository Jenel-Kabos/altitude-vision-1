import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';

import Footer from '../components/layout/Footer';
import CtaCommission from '../components/CtaCommission';

describe('WEB-14 — footer public premium', () => {
  afterEach(() => cleanup());

  test('WEB14-01/02 : rend une conclusion publique sémantique avec un bloc de marque sobre', () => {
    render(<Footer />);

    const footer = screen.getByTestId('public-footer-premium');
    expect(footer.tagName).toBe('FOOTER');
    expect(within(footer).getByRole('link', { name: 'Accueil Altitude-Vision' })).toHaveAttribute('href', '/');
    expect(footer).toHaveTextContent(/Trois métiers, une même exigence/i);
  });

  test('WEB14-03/04/05/07 : expose clairement les trois métiers et leurs vraies routes', () => {
    render(<Footer />);

    const businessNav = screen.getByRole('navigation', { name: 'Les métiers Altitude Vision' });
    expect(within(businessNav).getByRole('link', { name: /Altimmo.*Immobilier/i })).toHaveAttribute('href', '/immobilier');
    expect(within(businessNav).getByRole('link', { name: /Altcom.*Communication/i })).toHaveAttribute('href', '/communication');
    expect(within(businessNav).getByRole('link', { name: /Mila Events.*Événementiel/i })).toHaveAttribute('href', '/evenementiel');
  });

  test('WEB14-06/07 : rend les coordonnées canoniques avec email et téléphone fonctionnels', () => {
    render(<Footer />);

    expect(screen.getByText(/Rue Mfoa n°24, Poto-Poto/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'contact@altitudevision.agency' })).toHaveAttribute('href', 'mailto:contact@altitudevision.agency');
    expect(screen.getByRole('link', { name: '+242 06 800 21 51' })).toHaveAttribute('href', 'tel:+242068002151');
  });

  test('WEB14-08/09/10 : ne contient ni route inventée, ni statistique, ni répétition de la promesse apporteur', () => {
    render(<Footer />);

    const footer = screen.getByTestId('public-footer-premium');
    const hrefs = within(footer).getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toEqual(expect.arrayContaining(['/entreprises', '/plateforme', '/a-propos', '#']));
    expect(footer).not.toHaveTextContent(/200\+|80\+|98\s*%|24h|30\s*%|jusqu’à 30|familles logées|transactions/i);
  });

  test('WEB14-11 : conserve uniquement les destinations sociales réelles et sécurisées', () => {
    render(<Footer />);

    const expected = [
      ['Facebook', 'https://www.facebook.com/profile.php?id=61558493665509'],
      ['Instagram', 'https://www.instagram.com/immoaltitudevision/'],
      ['WhatsApp', 'https://wa.me/242068002151'],
    ];
    expected.forEach(([label, href]) => {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
    expect(screen.queryByRole('link', { name: /TikTok|LinkedIn|YouTube|X\/Twitter/i })).not.toBeInTheDocument();
  });

  test('WEB14-12 : conserve les routes légales et utilitaires existantes', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/mentions-legales');
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/politique-confidentialite');
    expect(screen.getByRole('link', { name: 'Signaler un problème' })).toHaveAttribute('href', '/signaler-un-litige');
    expect(screen.getByRole('link', { name: /Apporteur d’affaires/ })).toHaveAttribute('href', '/trouve-ta-commission');
  });

  test('WEB14-14 : le contenu et le CTA WEB-13 restent inchangés', () => {
    render(<CtaCommission />);

    const section = screen.getByTestId('apporteur-premium');
    expect(section).toHaveTextContent(/Vous connaissez un bien\s*\?\s*Faites-nous la mise en relation/i);
    expect(section).toHaveTextContent(/jusqu’à 30\s*% de notre commission/i);
    expect(within(section).getByRole('link', { name: 'Estimer ma part' })).toHaveAttribute('href', '/trouve-ta-commission');
  });

  test('WEB14-16 : le contenu du footer est visible sans animation ni hydratation conditionnelle', () => {
    render(<Footer />);

    const footer = screen.getByTestId('public-footer-premium');
    expect(footer).toBeVisible();
    expect(footer.querySelector('[data-motion-kind]')).toBeNull();
    expect(screen.getByText(/© \d{4} Altitude Vision/)).toBeVisible();
  });
});
