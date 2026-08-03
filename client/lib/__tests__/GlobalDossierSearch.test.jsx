import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GlobalDossierSearch from '../components/dashboard/GlobalDossierSearch';
import { searchDossiers, getDossier } from '../services/dossierService';

// DOC-EVO-1 — recherche globale intelligente : un seul champ, résultats
// débounced, ouvre un DossierPanel pour les résultats de type "dossier",
// jamais de lien mort pour les autres (documents/factures informatifs).
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/dossierService', () => ({ searchDossiers: vi.fn(), getDossier: vi.fn() }));
vi.mock('../services/gestionLocativeService', () => ({ previewRentalDocument: vi.fn(), downloadRentalDocument: vi.fn() }));

describe('GlobalDossierSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => { vi.useRealTimers(); });

  test('ne recherche rien tant que le champ est vide', () => {
    render(<GlobalDossierSearch />);
    expect(searchDossiers).not.toHaveBeenCalled();
  });

  test('recherche après un court délai (debounce) et affiche les résultats', async () => {
    searchDossiers.mockResolvedValue([
      { label: 'Bail — Villa Test (Paul Moke)', kind: 'dossier', domain: 'gestion_locative', entityId: 'C1' },
      { label: 'Facture #12 — Client X', kind: 'document', documentId: 'D1' },
    ]);
    render(<GlobalDossierSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un propriétaire/), { target: { value: 'Moke' } });
    await vi.advanceTimersByTimeAsync(350);
    expect(searchDossiers).toHaveBeenCalledWith('Moke');
    expect(await screen.findByText('Bail — Villa Test (Paul Moke)')).toBeInTheDocument();
    expect(screen.getByText('Facture #12 — Client X')).toBeInTheDocument();
  });

  test('cliquer un résultat "dossier" ouvre le DossierPanel', async () => {
    searchDossiers.mockResolvedValue([{ label: 'Bail — Villa Test', kind: 'dossier', domain: 'gestion_locative', entityId: 'C1' }]);
    getDossier.mockResolvedValue({
      domain: 'gestion_locative', entityId: 'C1', status: 'Actif',
      summary: { title: 'Bail — Villa Test', badges: [] }, relatedLinks: [], sections: [], timeline: [], actions: [],
    });
    render(<GlobalDossierSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un propriétaire/), { target: { value: 'Villa' } });
    await vi.advanceTimersByTimeAsync(350);
    fireEvent.click(await screen.findByText('Bail — Villa Test'));
    await waitFor(() => expect(getDossier).toHaveBeenCalledWith('gestion_locative', 'C1'));
  });

  test('un résultat "document" n’est jamais cliquable (pas de lien cassé)', async () => {
    searchDossiers.mockResolvedValue([{ label: 'Facture #12 — Client X', kind: 'document', documentId: 'D1' }]);
    render(<GlobalDossierSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un propriétaire/), { target: { value: 'Client' } });
    await vi.advanceTimersByTimeAsync(350);
    const button = await screen.findByText('Facture #12 — Client X');
    expect(button.closest('button')).toBeDisabled();
  });

  test('effacer la recherche ferme les résultats', async () => {
    searchDossiers.mockResolvedValue([{ label: 'Bail — Villa Test', kind: 'dossier', domain: 'gestion_locative', entityId: 'C1' }]);
    render(<GlobalDossierSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher un propriétaire/), { target: { value: 'Villa' } });
    await vi.advanceTimersByTimeAsync(350);
    await screen.findByText('Bail — Villa Test');
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(screen.queryByText('Bail — Villa Test')).not.toBeInTheDocument();
  });
});
