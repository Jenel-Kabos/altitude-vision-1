import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — caractérise puis prouve la parité
// entre le contrat backend réel (voir server/docs/HOTFIX_RBAC_TRANSACTIONS_ACCESS1_CONTRACT.md)
// et l'UI de TransactionsPage.jsx. Le backend applique DEUX populations
// distinctes selon l'action :
//   1. Lecture liste/stats, finaliser, annuler : {Admin, Secretaire, Collaborateur} (STAFF_DOC)
//   2. Valider/rejeter un virement : {Admin} seul (adminOnly)
// L'ancienne variable unique `isAdmin` ({Admin, Collaborateur}) excluait à
// tort Secretaire de (1), et incluait à tort Collaborateur dans (2).

let currentUser = null;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: currentUser }),
}));

const txFixture = {
  _id: 'tx1',
  status: 'Paiement en attente',
  paymentStatus: 'en_attente',
  finalAmount: 50000000,
  transactionType: 'vente',
  transactionDate: '2027-01-01T00:00:00.000Z',
  commission: { taux: 10, total: 5000000, agencyNet: 4000000, ownerPayout: 45000000 },
  property: { title: 'Villa Test' },
};

const virementPaiementFixture = { _id: 'p1', methode: 'virement', statut: 'en_attente', montant: 50000000, createdAt: '2027-01-01T00:00:00.000Z' };

const getAllTransactions = vi.fn();
const getStats = vi.fn();
const getMyTransactions = vi.fn();
const getPaiements = vi.fn();
const finalizeTransaction = vi.fn();
const cancelTransaction = vi.fn();
const validerVirement = vi.fn();
const previewTransactionPaymentProof = vi.fn();

vi.mock('../services/transactionService', () => ({
  getAllTransactions: (...args) => getAllTransactions(...args),
  getStats: (...args) => getStats(...args),
  getMyTransactions: (...args) => getMyTransactions(...args),
  getPaiements: (...args) => getPaiements(...args),
  finalizeTransaction: (...args) => finalizeTransaction(...args),
  cancelTransaction: (...args) => cancelTransaction(...args),
  validerVirement: (...args) => validerVirement(...args),
  previewTransactionPaymentProof: (...args) => previewTransactionPaymentProof(...args),
}));

const { default: TransactionsPage } = await import('../pages/dashboard/TransactionsPage');

const renderAsRole = async (role) => {
  currentUser = { _id: 'test-user', role };
  render(<TransactionsPage />);
  await waitFor(() => expect(screen.queryByText(/Chargement|Loader/)).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('Villa Test')).toBeInTheDocument());
};

describe('TransactionsPage — lecture liste complète/stats (contrat backend STAFF_DOC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllTransactions.mockResolvedValue([txFixture]);
    getMyTransactions.mockResolvedValue([txFixture]);
    getStats.mockResolvedValue({ byStatus: {}, totaux: {} });
    getPaiements.mockResolvedValue([]);
  });

  test.each(['Admin', 'Collaborateur', 'Secretaire'])(
    '%s voit "Gestion des transactions" et appelle getAllTransactions/getStats (contrat STAFF_DOC)',
    async (role) => {
      await renderAsRole(role);
      expect(screen.getByText('Gestion des transactions')).toBeInTheDocument();
      expect(getAllTransactions).toHaveBeenCalled();
      expect(getStats).toHaveBeenCalled();
      expect(getMyTransactions).not.toHaveBeenCalled();
    }
  );

  test.each(['GestionnaireImmobilier', 'CommunityManager', 'Communicant'])(
    '%s voit "Mes transactions" et appelle getMyTransactions, jamais la liste complète (exclu de STAFF_DOC, inchangé)',
    async (role) => {
      await renderAsRole(role);
      expect(screen.getByText('Mes transactions')).toBeInTheDocument();
      expect(getMyTransactions).toHaveBeenCalled();
      expect(getAllTransactions).not.toHaveBeenCalled();
      expect(getStats).not.toHaveBeenCalled();
    }
  );
});

describe('TransactionsPage — Finaliser/Annuler (contrat backend STAFF_DOC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllTransactions.mockResolvedValue([txFixture]);
    getMyTransactions.mockResolvedValue([txFixture]);
    getStats.mockResolvedValue({ byStatus: {}, totaux: {} });
    getPaiements.mockResolvedValue([]);
  });

  test.each(['Admin', 'Collaborateur', 'Secretaire'])(
    '%s voit les actions Finaliser/Annuler dans le détail de la transaction (STAFF_DOC autorise finalize/cancel)',
    async (role) => {
      await renderAsRole(role);
      fireEvent.click(screen.getByText('Villa Test'));
      await waitFor(() => expect(screen.getByText('Finaliser')).toBeInTheDocument());
      expect(screen.getByText('Annuler le dossier')).toBeInTheDocument();
    }
  );

  test.each(['GestionnaireImmobilier', 'CommunityManager', 'Communicant'])(
    '%s ne voit jamais Finaliser/Annuler (exclu de STAFF_DOC, inchangé)',
    async (role) => {
      await renderAsRole(role);
      fireEvent.click(screen.getByText('Villa Test'));
      await waitFor(() => expect(screen.getByText('Historique des paiements')).toBeInTheDocument());
      expect(screen.queryByText('Finaliser')).not.toBeInTheDocument();
      expect(screen.queryByText('Annuler le dossier')).not.toBeInTheDocument();
    }
  );
});

describe('TransactionsPage — Valider/Rejeter virement (contrat backend adminOnly)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllTransactions.mockResolvedValue([txFixture]);
    getMyTransactions.mockResolvedValue([txFixture]);
    getStats.mockResolvedValue({ byStatus: {}, totaux: {} });
    getPaiements.mockResolvedValue([virementPaiementFixture]);
  });

  test('Admin voit Valider/Rejeter sur un virement en attente', async () => {
    await renderAsRole('Admin');
    fireEvent.click(screen.getByText('Villa Test'));
    await waitFor(() => expect(screen.getByText('Valider')).toBeInTheDocument());
    expect(screen.getByText('Rejeter')).toBeInTheDocument();
  });

  test('Collaborateur ne voit jamais Valider/Rejeter (backend adminOnly, jamais un bouton qui échouerait en 403)', async () => {
    await renderAsRole('Collaborateur');
    fireEvent.click(screen.getByText('Villa Test'));
    await waitFor(() => expect(screen.getByText('Historique des paiements')).toBeInTheDocument());
    expect(screen.queryByText('Valider')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejeter')).not.toBeInTheDocument();
  });

  test('Secretaire ne voit jamais Valider/Rejeter (exclu de adminOnly, inchangé)', async () => {
    await renderAsRole('Secretaire');
    fireEvent.click(screen.getByText('Villa Test'));
    await waitFor(() => expect(screen.getByText('Historique des paiements')).toBeInTheDocument());
    expect(screen.queryByText('Valider')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejeter')).not.toBeInTheDocument();
  });
});
