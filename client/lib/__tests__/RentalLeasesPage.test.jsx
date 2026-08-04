import { render, screen, fireEvent } from '@testing-library/react';
import RentalLeasesPage from '../pages/dashboard/RentalLeasesPage';
import { getContrats } from '../services/gestionLocativeService';
import { getLeaseLifecycleDashboard, getAvailableTransitions } from '../services/rentalLeaseLifecycleService';

// GL-UX-1 — la page devient le point d'entrée du pilotage du cycle de vie
// (LeaseLifecycleDashboard + bouton "Piloter" → LeaseLifecycleDrawer) —
// STAFF_IMMO uniquement, d'où le mock d'AuthContext (rôle Admin par défaut).
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/gestionLocativeService', () => ({ getContrats: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Admin' } }) }));
vi.mock('../services/rentalLeaseLifecycleService', () => ({
  getLeaseLifecycleDashboard: vi.fn().mockResolvedValue({
    bauxAEcheance: [], renouvellementsAPreparer: [], preavisEnAttente: [],
    inspectionsAProgrammer: [], cautionsARestituer: [], dossiersBloques: [],
  }),
  getAvailableTransitions: vi.fn().mockResolvedValue({ cycleVie: 'actif', allowed: ['preavis', 'resilie'] }),
  transitionLease: vi.fn(), previewRenewal: vi.fn(), renewLease: vi.fn(), addLeaseAvenant: vi.fn(),
  encaisserCaution: vi.fn(), bloquerCaution: vi.fn(), appliquerRetenueCaution: vi.fn(), restituerCaution: vi.fn(),
}));

const bail = (overrides = {}) => ({
  _id: 'C1', type: 'location', statut: 'actif',
  bien: { title: 'Villa Bail Test' },
  proprietaire: { nom: 'Nkounkou', prenom: 'Alice' },
  locataire: { nom: 'Moke', prenom: 'Paul' },
  montantLoyer: 250000,
  dateFinBail: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
  montantCaution: 500000, cautionVersee: false,
  documents: [{ _id: 'D1', nom: 'Bail signé', type: 'bail', url: 'https://cdn.test/bail.pdf' }],
  ...overrides,
});

describe('RentalLeasesPage — Sprint GL-UX1 — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContrats.mockResolvedValue([bail()]);
  });

  test("interroge uniquement les contrats de type location et charge par défaut le statut actif", async () => {
    render(<RentalLeasesPage />);
    await screen.findByText('Villa Bail Test');
    expect(getContrats).toHaveBeenCalledWith({ type: 'location', statut: 'actif' });
  });

  test('affiche le bien, le propriétaire, le locataire et le loyer', async () => {
    render(<RentalLeasesPage />);
    expect(await screen.findByText('Villa Bail Test')).toBeInTheDocument();
    expect(screen.getByText(/Alice Nkounkou/)).toBeInTheDocument();
    expect(screen.getByText(/Paul Moke/)).toBeInTheDocument();
    expect(screen.getByText(/250 000 FCFA/)).toBeInTheDocument();
  });

  test('signale un dépôt de garantie non régularisé', async () => {
    render(<RentalLeasesPage />);
    expect(await screen.findByText('Non régularisé')).toBeInTheDocument();
  });

  test('signale une échéance proche (≤ 60 jours)', async () => {
    render(<RentalLeasesPage />);
    await screen.findByText('Villa Bail Test');
    expect(screen.getByText(/j restants/)).toBeInTheDocument();
  });

  test('le lien Documents pointe vers le centre documentaire filtré sur ce bail', async () => {
    render(<RentalLeasesPage />);
    const link = await screen.findByRole('link', { name: /1 document/ });
    expect(link).toHaveAttribute('href', '/dashboard/documents?pole=Altimmo&service=gestion_locative&contratId=C1');
  });

  test('changer le filtre de statut recharge avec le bon paramètre', async () => {
    render(<RentalLeasesPage />);
    await screen.findByText('Villa Bail Test');
    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
    expect(getContrats).toHaveBeenLastCalledWith({ type: 'location' });
  });

  test('état vide géré', async () => {
    getContrats.mockResolvedValue([]);
    render(<RentalLeasesPage />);
    expect(await screen.findByText('Aucun bail')).toBeInTheDocument();
  });

  test('GL-UX-1 : affiche le tableau de bord du cycle de vie pour un rôle STAFF_IMMO', async () => {
    render(<RentalLeasesPage />);
    await screen.findByText('Villa Bail Test');
    expect(getLeaseLifecycleDashboard).toHaveBeenCalled();
    expect(await screen.findByText('Baux à échéance')).toBeInTheDocument();
  });

  test('GL-UX-1 : le bouton "Piloter" ouvre le panneau de cycle de vie (machine d\'état affichée)', async () => {
    render(<RentalLeasesPage />);
    await screen.findByText('Villa Bail Test');
    fireEvent.click(screen.getByRole('button', { name: 'Piloter' }));
    expect(getAvailableTransitions).toHaveBeenCalledWith('C1');
    expect(await screen.findByText('Piloter le bail')).toBeInTheDocument();
  });
});
