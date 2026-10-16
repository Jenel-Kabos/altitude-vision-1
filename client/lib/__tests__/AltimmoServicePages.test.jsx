import { render, screen } from '@testing-library/react';
import React from 'react';
import VenteDeBiensPage from '../pages/services/VenteDeBiensPage';
import LocationGestionPage from '../pages/services/LocationGestionPage';
import ConseilInvestissementPage from '../pages/services/ConseilInvestissementPage';

vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, transition, whileInView, viewport, whileHover, whileTap, children, ...props }) => ({ children, props });
  const make = Tag => props => {
    const clean = strip(props);
    return React.createElement(Tag, clean.props, clean.children);
  };
  return { motion: new Proxy({}, { get: (_target, tag) => make(tag) }) };
});
vi.mock('next/image', () => ({ default: ({ alt }) => <div role="img" aria-label={alt} /> }));

describe('Pages de services Altimmo', () => {
  test('reprend les textes et la preuve de la vente depuis la page Immobilier', () => {
    render(<VenteDeBiensPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Vente de Biens' })).toBeInTheDocument();
    expect(screen.getByText('Nous vous accompagnons à chaque étape pour vendre votre propriété au meilleur prix.')).toBeInTheDocument();
    expect(screen.getByText('+120 ventes')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Estimation/i })[0]).toHaveAttribute('href', '/altimmo/estimation');
  });

  test('reprend le texte et la preuve de Location & Gestion', () => {
    render(<LocationGestionPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Location & Gestion' })).toBeInTheDocument();
    expect(screen.getByText("Confiez-nous la gestion de vos biens pour une tranquillité d'esprit optimale.")).toBeInTheDocument();
    expect(screen.getByText('+80 biens gérés')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir les tarifs/i })).toHaveAttribute('href', '#tarifs');
  });

  test('F-U2.9 : gestion déléguée à 10 %, aucune mention à 7 %, quatre formules autonomes transparentes', () => {
    const { container } = render(<LocationGestionPage />);
    expect(container.textContent).not.toMatch(/\b7 ?%/);
    expect(screen.getByText('Gestion déléguée')).toBeInTheDocument();
    expect(screen.getByText('10 %')).toBeInTheDocument();
    const formulas = screen.getByTestId('autonomous-formulas');
    ['Gratuit', 'Standard', 'Entreprise', 'Grand portefeuille'].forEach((label) => expect(formulas).toHaveTextContent(label));
    ['0 FCFA / mois', '5 000 FCFA / mois', '10 000 FCFA / mois', 'Sur devis'].forEach((price) => expect(formulas).toHaveTextContent(price));
    expect(screen.getByText('Abonnement gratuit pour un bien. Frais de service de 1 % sur les loyers effectivement encaissés et confirmés.')).toBeInTheDocument();
  });

  test('connecte les CTA Conseil aux stratégies et au contact immobilier', () => {
    render(<ConseilInvestissementPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Conseil en Investissement' })).toBeInTheDocument();
    expect(screen.getByText('Bénéficiez de notre expertise pour des investissements judicieux et performants.')).toBeInTheDocument();
    expect(screen.getAllByText('+50 projets').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Nos stratégies/i })).toHaveAttribute('href', '#strategies');
    screen.getAllByRole('link', { name: /Consultation/i }).forEach(link => {
      expect(link).toHaveAttribute('href', '/immobilier#contact-altimmo');
    });
  });
});
