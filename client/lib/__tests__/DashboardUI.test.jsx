import React from 'react';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import {
  DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState,
  DashboardTableContainer,
} from '../components/dashboard/DashboardUI';

describe('DashboardUI', () => {
  it('rend une structure de page et un en-tête accessibles', () => {
    render(<DashboardPage><DashboardPageHeader icon={Home} title="Toutes les annonces" description="Description" /></DashboardPage>);
    expect(screen.getByRole('heading', { level: 1, name: 'Toutes les annonces' })).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it.each([['loading', 'Chargement'], ['error', 'Erreur'], ['empty', 'Vide']])('annonce correctement l’état %s', (type, title) => {
    render(<DashboardState type={type} title={title} />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('expose le tableau défilant et la pagination', () => {
    render(<><DashboardTableContainer label="Résultats"><table><tbody><tr><td>Item</td></tr></tbody></table></DashboardTableContainer><DashboardPagination page={1} totalPages={2} /></>);
    expect(screen.getByRole('region', { name: 'Résultats' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
    expect(screen.getByText('Page 1 sur 2')).toBeInTheDocument();
  });
});
