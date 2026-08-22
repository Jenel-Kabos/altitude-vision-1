import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssetLifecycleCard from '../components/dashboard/propertyAsset/AssetLifecycleCard';
import PropertyAlertsPanel from '../components/dashboard/propertyAsset/PropertyAlertsPanel';
import MaintenanceLogbookTimeline from '../components/dashboard/propertyAsset/MaintenanceLogbookTimeline';
import PropertyPortfolioDashboard from '../components/dashboard/propertyAsset/PropertyPortfolioDashboard';
import * as propertyAssetService from '../services/propertyAssetService';

// GL-ASSET-UX-1 — chaque composant n'est qu'un orchestrateur des services
// GL-ASSET-1 : aucune règle métier ne doit être vérifiée ici, seulement que
// le bon appel est fait et que le résultat serveur est affiché tel quel.
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Admin' } }) }));
vi.mock('../services/propertyAssetService');

describe('AssetLifecycleCard', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche l\'étape actuelle et un bouton par transition autorisée, jamais une règle codée en dur', async () => {
    propertyAssetService.getPropertyLifecycle.mockResolvedValue({ assetCycle: 'disponible', allowed: ['reserve', 'en_location'] });
    render(<AssetLifecycleCard propertyId="P1" />);
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réserver le bien' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mettre en location' })).toBeInTheDocument();
  });

  test('cliquer une transition appelle transitionPropertyAsset avec la cible exacte', async () => {
    propertyAssetService.getPropertyLifecycle.mockResolvedValue({ assetCycle: 'disponible', allowed: ['reserve'] });
    propertyAssetService.transitionPropertyAsset.mockResolvedValue({});
    render(<AssetLifecycleCard propertyId="P1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Réserver le bien' }));
    await waitFor(() => expect(propertyAssetService.transitionPropertyAsset).toHaveBeenCalledWith('P1', 'reserve'));
  });

  test('aucune transition disponible : message informatif, aucun bouton', async () => {
    propertyAssetService.getPropertyLifecycle.mockResolvedValue({ assetCycle: 'archive', allowed: [] });
    render(<AssetLifecycleCard propertyId="P1" />);
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(screen.getByText('Aucune transition disponible depuis cette étape.')).toBeInTheDocument();
  });
});

describe('PropertyAlertsPanel', () => {
  test('affiche le niveau et le détail des alertes renvoyées par le serveur', () => {
    render(<PropertyAlertsPanel alerts={{ level: 'critique', checks: [{ key: 'vacance_prolongee', level: 'critique', label: 'Bien vacant depuis 120 jours' }] }} />);
    expect(screen.getByText(/Critique/)).toBeInTheDocument();
    expect(screen.getByText(/Bien vacant depuis 120 jours/)).toBeInTheDocument();
  });

  test('aucune alerte : message informatif', () => {
    render(<PropertyAlertsPanel alerts={{ level: 'conforme', checks: [] }} />);
    expect(screen.getByText('Aucune alerte.')).toBeInTheDocument();
  });
});

describe('MaintenanceLogbookTimeline', () => {
  test('affiche le coût total, les entreprises et chaque intervention', () => {
    render(<MaintenanceLogbookTimeline logbook={{
      coutTotal: 50000, interventionsOuvertes: 1, entreprises: ['Plomberie Congo'],
      tickets: [{ _id: 'T1', category: 'plomberie', priority: 'normale', status: 'resolu', actualCost: 50000, entrepriseIntervenante: 'Plomberie Congo', createdAt: '2027-01-01' }],
    }} />);
    expect(screen.getAllByText(/50 000 FCFA/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Plomberie Congo/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Plomberie — normale/)).toBeInTheDocument();
  });

  test('carnet vide : message informatif', () => {
    render(<MaintenanceLogbookTimeline logbook={{ coutTotal: 0, interventionsOuvertes: 0, entreprises: [], tickets: [] }} />);
    expect(screen.getByText('Aucune intervention enregistrée.')).toBeInTheDocument();
  });
});

describe('PropertyPortfolioDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche les indicateurs de portefeuille renvoyés par le serveur', async () => {
    propertyAssetService.getPortfolioDashboard.mockResolvedValue({
      totalBiens: 3, valeurTotale: 900000, valeurParType: { Villa: 900000 }, rentabiliteMoyenne: 5.2,
      biensVacants: 1, biensOccupes: 2, coutEntretienTotal: 20000,
      alertesCritiques: 1, alertesAttention: 0,
      topRentabilite: [{ propertyId: 'P1', title: 'Villa Test', rentabiliteNette: 6.1 }],
      historiqueRecent: [],
    });
    render(<PropertyPortfolioDashboard />);
    // "900 000 FCFA" apparaît deux fois (valeur totale + valeur par type,
    // un seul type dans ce jeu de test) — les deux affichages sont attendus.
    expect((await screen.findAllByText('900 000 FCFA')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('5.2%')).toBeInTheDocument();
    expect(screen.getByText('Villa Test')).toBeInTheDocument();
  });

  // HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 — sans `status`, le composant ne
  // doit rien changer à son appel historique (patrimoine global) ; avec
  // `status`, il doit le relayer tel quel au service, sans jamais le
  // recalculer ou le transformer côté composant.
  test('sans prop status : appelle le service sans argument (comportement historique inchangé)', async () => {
    propertyAssetService.getPortfolioDashboard.mockResolvedValue({ totalBiens: 0, valeurTotale: 0, valeurParType: {} });
    render(<PropertyPortfolioDashboard />);
    await waitFor(() => expect(propertyAssetService.getPortfolioDashboard).toHaveBeenCalledWith(undefined));
  });

  test('prop status="vente" : relayée telle quelle au service', async () => {
    propertyAssetService.getPortfolioDashboard.mockResolvedValue({
      totalBiens: 1, valeurTotale: 80000000, valeurParType: { Parcelle: 80000000 },
    });
    render(<PropertyPortfolioDashboard status="vente" />);
    await waitFor(() => expect(propertyAssetService.getPortfolioDashboard).toHaveBeenCalledWith('vente'));
    // "80 000 000 FCFA" apparaît deux fois (valeur totale + valeur par type,
    // un seul type dans ce jeu de test) — même remarque que le test ci-dessus.
    expect((await screen.findAllByText('80 000 000 FCFA')).length).toBeGreaterThanOrEqual(2);
  });

  test('prop status="location" : relayée telle quelle au service, jamais mélangée avec "vente"', async () => {
    propertyAssetService.getPortfolioDashboard.mockResolvedValue({
      totalBiens: 1, valeurTotale: 20000000, valeurParType: { Maison: 20000000 },
    });
    render(<PropertyPortfolioDashboard status="location" />);
    await waitFor(() => expect(propertyAssetService.getPortfolioDashboard).toHaveBeenCalledWith('location'));
    expect((await screen.findAllByText('20 000 000 FCFA')).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('80 000 000 FCFA')).not.toBeInTheDocument();
  });
});
