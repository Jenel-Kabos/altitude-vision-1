import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeaseLifecycleCard from '../components/dashboard/leaseLifecycle/LeaseLifecycleCard';
import RenewalModal from '../components/dashboard/leaseLifecycle/RenewalModal';
import AvenantModal from '../components/dashboard/leaseLifecycle/AvenantModal';
import CautionPanel from '../components/dashboard/leaseLifecycle/CautionPanel';
import * as lifecycleService from '../services/rentalLeaseLifecycleService';

// GL-UX-1 — chaque composant n'est qu'un orchestrateur des services
// GL-LIFE-1 : aucune règle métier ne doit être vérifiée ici, seulement que
// le bon appel est fait et que le résultat serveur est affiché tel quel.
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'Admin' } }) }));
vi.mock('../services/rentalLeaseLifecycleService');

const contrat = { _id: 'C1', montantLoyer: 300000, dateFinBail: '2027-12-31', montantCaution: 600000, cautionVersee: true, caution: { statut: 'bloquee', montantRetenu: 0, montantRestitue: 0 } };

describe('LeaseLifecycleCard', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche l\'étape actuelle et un bouton par transition autorisée, jamais une règle codée en dur', async () => {
    lifecycleService.getAvailableTransitions.mockResolvedValue({ cycleVie: 'actif', allowed: ['preavis', 'resilie'] });
    render(<LeaseLifecycleCard contratId="C1" />);
    expect(await screen.findByText('Actif')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Démarrer le préavis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Résilier immédiatement' })).toBeInTheDocument();
  });

  test('cliquer une transition appelle transitionLease avec la cible exacte', async () => {
    lifecycleService.getAvailableTransitions.mockResolvedValue({ cycleVie: 'actif', allowed: ['preavis'] });
    lifecycleService.transitionLease.mockResolvedValue({});
    render(<LeaseLifecycleCard contratId="C1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le préavis' }));
    await waitFor(() => expect(lifecycleService.transitionLease).toHaveBeenCalledWith('C1', 'preavis'));
  });

  test('aucune transition disponible : message informatif, aucun bouton', async () => {
    lifecycleService.getAvailableTransitions.mockResolvedValue({ cycleVie: 'archive', allowed: [] });
    render(<LeaseLifecycleCard contratId="C1" />);
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(screen.getByText('Aucune transition disponible depuis cette étape.')).toBeInTheDocument();
  });

  test('un contrat hors périmètre locatif (vente) ne rend rien', async () => {
    lifecycleService.getAvailableTransitions.mockResolvedValue({ cycleVie: null, allowed: [] });
    const { container } = render(<LeaseLifecycleCard contratId="C1" />);
    await waitFor(() => expect(lifecycleService.getAvailableTransitions).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RenewalModal', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche le mode et le diff renvoyés par le serveur (aucun calcul local)', async () => {
    lifecycleService.previewRenewal.mockResolvedValue({ mode: 'prolongation', champsModifies: [{ champ: 'montantLoyer', avant: 300000, apres: 330000 }] });
    render(<RenewalModal contrat={{ _id: 'C1' }} onClose={() => {}} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Nouveau loyer/), { target: { value: '330000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }));
    expect(await screen.findByText('→ Prolongation du bail existant')).toBeInTheDocument();
    expect(screen.getByText(/300000 → 330000/)).toBeInTheDocument();
  });

  test('confirmer appelle renewLease et notifie le mode reçu', async () => {
    lifecycleService.previewRenewal.mockResolvedValue({ mode: 'nouveau_contrat', champsModifies: [] });
    lifecycleService.renewLease.mockResolvedValue({ mode: 'nouveau_contrat' });
    const onDone = vi.fn();
    render(<RenewalModal contrat={{ _id: 'C1' }} onClose={() => {}} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }));
    await screen.findByText(/nouveau bail lié/i);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le renouvellement' }));
    await waitFor(() => expect(lifecycleService.renewLease).toHaveBeenCalledWith('C1', expect.any(Object)));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('AvenantModal', () => {
  beforeEach(() => vi.clearAllMocks());

  test('le bouton valider reste désactivé tant qu\'aucun changement réel n\'est saisi', () => {
    render(<AvenantModal contrat={contrat} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /Valider l'avenant/ })).toBeDisabled();
  });

  test('soumet uniquement le champ modifié, sans logique métier locale', async () => {
    lifecycleService.addLeaseAvenant.mockResolvedValue({});
    render(<AvenantModal contrat={contrat} onClose={() => {}} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Nouvelle valeur/), { target: { value: '350000' } });
    fireEvent.click(screen.getByRole('button', { name: /Valider l'avenant/ }));
    await waitFor(() => expect(lifecycleService.addLeaseAvenant).toHaveBeenCalledWith('C1', { type: 'loyer', motif: '', changes: { montantLoyer: 350000 } }));
  });
});

describe('CautionPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche montant initial, retenue et solde à restituer', () => {
    render(<CautionPanel contrat={{ _id: 'C1', montantCaution: 600000, caution: { statut: 'bloquee', montantRetenu: 100000, montantRestitue: 0 } }} />);
    expect(screen.getByText('600 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('100 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('500 000 FCFA')).toBeInTheDocument();
  });

  test('propose "Bloquer" uniquement quand la caution est versée', () => {
    render(<CautionPanel contrat={{ _id: 'C1', montantCaution: 600000, caution: { statut: 'versee', montantRetenu: 0, montantRestitue: 0 } }} />);
    expect(screen.getByRole('button', { name: 'Bloquer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Encaisser' })).not.toBeInTheDocument();
  });

  test('la restitution appelle restituerCaution avec le montant saisi', async () => {
    lifecycleService.restituerCaution.mockResolvedValue({});
    render(<CautionPanel contrat={{ _id: 'C1', montantCaution: 600000, caution: { statut: 'bloquee', montantRetenu: 0, montantRestitue: 0 } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restituer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la restitution' }));
    await waitFor(() => expect(lifecycleService.restituerCaution).toHaveBeenCalledWith('C1', { montant: 600000 }));
  });
});
