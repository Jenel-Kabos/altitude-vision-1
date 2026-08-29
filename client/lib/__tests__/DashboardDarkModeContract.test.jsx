import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import DevisPage from '../pages/dashboard/DevisPage';
import VisitesPage from '../pages/dashboard/VisitesPage';
import { getAllDevis } from '../services/devisService';
import { getAllVisites } from '../services/visiteService';

vi.mock('../services/devisService', () => ({ getAllDevis: vi.fn(), updateDevis: vi.fn() }));
vi.mock('../services/visiteService', () => ({ getAllVisites: vi.fn(), updateVisite: vi.fn() }));

const renderInTheme = (node, dark = false) => render(
  <div className={dark ? 'dark' : ''}>
    <div className="dashboard-shell">
      <main className="dashboard-content"><div className="dashboard-content-inner">{node}</div></main>
    </div>
  </div>,
);

describe('contrat Light/Dark du dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllDevis.mockResolvedValue([]);
    getAllVisites.mockResolvedValue([]);
  });

  test.each([
    [false, 'Light'],
    [true, 'Dark'],
  ])('Visites conserve titre, filtres et empty state en mode %s (%s)', async (dark) => {
    renderInTheme(<VisitesPage />, dark);
    expect(await screen.findByRole('heading', { name: 'Gestion des Rendez-vous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tous' })).toBeInTheDocument();
    expect(screen.getByText('Aucune visite')).toBeInTheDocument();
  });

  test.each([false, true])('Devis conserve ses actions de filtrage en Light/Dark (%s)', async (dark) => {
    renderInTheme(<DevisPage />, dark);
    expect(await screen.findByRole('heading', { name: 'Demandes de devis — Gestion locative' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /En attente/ }));
    expect(screen.getByText('Aucune demande "En attente"')).toBeInTheDocument();
  });

  test('le CSS expose une même hiérarchie de tokens pour préférence OS et classe dark', () => {
    const css = readFileSync(`${process.cwd()}/app/dashboard/dashboard.css`, 'utf8');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('.dark .dashboard-shell');
    for (const token of ['--db-bg', '--db-surface', '--db-surface-solid', '--db-surface-soft', '--db-text', '--db-muted', '--db-border', '--db-focus']) {
      expect(css.match(new RegExp(token, 'g'))?.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('les champs dashboard imposent le contrat de contraste et le schéma natif du thème', () => {
    const css = readFileSync(`${process.cwd()}/app/dashboard/dashboard.css`, 'utf8');
    expect(css).toContain('color: var(--db-text) !important');
    expect(css).toContain('background: var(--db-surface-input)');
    expect(css).toContain('color: var(--db-faint) !important');
    expect(css).toContain('color-scheme: dark');
    expect(css).toContain('color-scheme: light');
  });
});
