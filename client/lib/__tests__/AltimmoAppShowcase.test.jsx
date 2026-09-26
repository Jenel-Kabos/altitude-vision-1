import React from 'react';
import { render, screen, within } from '@testing-library/react';
import AltimmoAppShowcase from '../components/public/AltimmoAppShowcase';

describe('ALTIMMO APP SHOWCASE — produit mobile réel', () => {
  test('présente les trois usages avec les captures réelles et des alternatives accessibles', () => {
    render(<AltimmoAppShowcase />);

    const section = screen.getByTestId('altimmo-app-showcase');
    expect(within(section).getByText('Altimmo — L’application')).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: /L’immobilier, désormais dans votre poche/i })).toBeInTheDocument();
    expect(within(section).getByText('Découvrir')).toBeInTheDocument();
    expect(within(section).getByText('Localiser')).toBeInTheDocument();
    expect(within(section).getByText('Gérer / Réserver')).toBeInTheDocument();

    expect(within(section).getByRole('img', { name: /accueil Altimmo avec la recherche et les biens recommandés/i }))
      .toHaveAttribute('src', '/images/altimmo-app/altimmo-home.webp');
    expect(within(section).getByRole('img', { name: /carte Altimmo des biens à Brazzaville/i }))
      .toHaveAttribute('src', '/images/altimmo-app/altimmo-map.webp');
    expect(within(section).getByRole('img', { name: /fiche Mila Hotel dans l’application Altimmo/i }))
      .toHaveAttribute('src', '/images/altimmo-app/altimmo-mila-hotel.webp');
  });

  test('utilise les routes réelles sans revendiquer une disponibilité sur les stores', () => {
    render(<AltimmoAppShowcase />);

    const section = screen.getByTestId('altimmo-app-showcase');
    expect(within(section).getByRole('link', { name: /Découvrir l’application/i }))
      .toHaveAttribute('href', '/altimmo/application');
    expect(within(section).getByRole('link', { name: /Voir les annonces/i }))
      .toHaveAttribute('href', '/immobilier/annonces');
    expect(section).not.toHaveTextContent(/App Store|Google Play/i);
  });
});
