import { render, screen, fireEvent } from '@testing-library/react';
import RentalLeasesPage from '../pages/dashboard/RentalLeasesPage';
import { getContrats } from '../services/gestionLocativeService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/gestionLocativeService', () => ({ getContrats: vi.fn() }));

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
});
