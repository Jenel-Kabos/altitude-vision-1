import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import {
  DashboardPage, DashboardPageHeader, DashboardPagination, DashboardState,
  DashboardActionMenu, DashboardContextSwitcher, DashboardKpiCard, DashboardKpiGrid, DashboardTableContainer,
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

  it('affiche les indicateurs dans la grille partagée', () => {
    render(<DashboardKpiGrid><DashboardKpiCard label="Biens actifs" value="12" icon={Home} detail="Projection serveur" /></DashboardKpiGrid>);
    expect(screen.getByText('Biens actifs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Projection serveur')).toBeInTheDocument();
  });

  it('change explicitement de contexte métier', () => {
    const onChange = vi.fn();
    render(<DashboardContextSwitcher value="patrimoine" onChange={onChange} options={[
      { value: 'patrimoine', label: 'Patrimoine immobilier' },
      { value: 'etablissement', label: 'Exploitation d’établissement' },
    ]} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Espace de travail' }), { target: { value: 'etablissement' } });
    expect(onChange).toHaveBeenCalledWith('etablissement');
  });

  it('regroupe les actions secondaires dans un menu accessible', () => {
    const onArchive = vi.fn();
    render(<DashboardActionMenu label="Actions de l’établissement" items={[{ label: 'Archiver', onSelect: onArchive, danger: true }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions de l’établissement' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archiver' }));
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
