import React from 'react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1 — caractérise puis prouve la parité
// entre le contrat backend réel (voir server/docs/HOTFIX_RBAC_GESTION_LOCATIVE_ACCESS1_CONTRACT.md)
// et l'UI de GestionLocativePage.jsx. Le backend applique TROIS populations
// distinctes selon l'action :
//   1. Onboarding/désactivation mandat : {Admin, GestionnaireImmobilier}
//   2. Création/édition Contrat, CRUD Propriétaire+biens, CRUD Locataire :
//      {Admin, GestionnaireImmobilier, Collaborateur}
//   3. Suppression Contrat : {Admin} seul
// L'ancienne variable unique `canManage` ({Admin, GestionnaireImmobilier})
// correspondait exactement à (1), excluait à tort Collaborateur de (2), et
// incluait à tort GestionnaireImmobilier dans (3).

let currentUser = null;
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    isAdmin: currentUser?.role === 'Admin',
    isCollaborateur: currentUser?.role === 'Collaborateur',
    canAdd: true,
  }),
}));

const contratFixture = { _id: 'c1', type: 'location', adresseBien: 'Bien Test', statut: 'actif', montantLoyer: 100000 };
const proprietaireFixture = { _id: 'p1', nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000001', biensPropres: [] };
const locataireFixture = { _id: 'l1', nom: 'Moke', prenom: 'Paul', telephone: '+242060000002' };

vi.mock('../services/gestionLocativeService', () => ({
  getProprietaires: vi.fn().mockResolvedValue([proprietaireFixture]),
  createProprietaire: vi.fn(),
  updateProprietaire: vi.fn(),
  deleteProprietaire: vi.fn(),
  getLocataires: vi.fn().mockResolvedValue([locataireFixture]),
  createLocataire: vi.fn(),
  updateLocataire: vi.fn(),
  deleteLocataire: vi.fn(),
  getContrats: vi.fn().mockResolvedValue([contratFixture]),
  createContrat: vi.fn(),
  updateContrat: vi.fn(),
  deleteContrat: vi.fn(),
  getPaiements: vi.fn().mockResolvedValue([]),
  updatePaiement: vi.fn(),
  marquerPaiementPaye: vi.fn(),
  calculerPenalites: vi.fn(),
  addBienPhotos: vi.fn(),
  getRentalManagement: vi.fn().mockResolvedValue({ rentals: [] }),
  getRentalManagementStats: vi.fn().mockResolvedValue({ total: 0, vacant: 0, occupied: 0, published: 0, maintenance: 0, readyToRepublish: 0 }),
  getRentalManagementDetail: vi.fn(),
  runRentalAction: vi.fn(),
  deactivateRentalManagement: vi.fn(),
  getRentalOnboardingOptions: vi.fn().mockResolvedValue({}),
  onboardRentalProperty: vi.fn(),
  getLocataireDossiers: vi.fn().mockResolvedValue({ total: 0 }),
  getPaiementsStats: vi.fn().mockResolvedValue(null),
  previewRentalDocument: vi.fn(),
  downloadRentalDocument: vi.fn(),
}));

vi.mock('../services/documentService', () => ({
  getContratDocuments: vi.fn().mockResolvedValue([]),
  generateBail: vi.fn(),
  generateQuittance: vi.fn(),
  generateMiseEnDemeure: vi.fn(),
  generatePreavis: vi.fn(),
  generateEtatDesLieux: vi.fn(),
  envoyerDocument: vi.fn(),
  getAllDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/rentalMaintenanceService', () => ({
  getRentalMaintenanceTickets: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/propertyService', () => ({
  getAllProperties: vi.fn().mockResolvedValue([]),
}));

const { default: GestionLocativePage } = await import('../pages/dashboard/GestionLocativePage');

const renderAsRole = async (role) => {
  currentUser = { _id: 'test-user', role };
  render(<GestionLocativePage />);
  // La liste d'onglets est statique et rendue pour tout rôle une fois le
  // chargement terminé — condition d'attente indépendante du contrat testé
  // (contrairement à "Nouveau Contrat"/"Aucun contrat", absents tous les
  // deux pour un rôle sans droit de mutation alors qu'un contrat existe).
  await waitFor(() => expect(screen.getByRole('button', { name: 'Contrats' })).toBeInTheDocument());
};

describe('GestionLocativePage — parité du contrat Contrat/Propriétaire/Locataire (Admin, GestionnaireImmobilier, Collaborateur)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each(['Admin', 'GestionnaireImmobilier', 'Collaborateur'])(
    '%s voit "Nouveau Contrat" et les actions éditer/supprimer sur les Propriétaires/Locataires (contrat backend STAFF_IMMO/tenants.manage/leases.manage)',
    async (role) => {
      await renderAsRole(role);
      expect(screen.getByText('Nouveau Contrat')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Propriétaires' }));
      await waitFor(() => expect(screen.getByText('Nouveau Propriétaire')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Locataires' }));
      await waitFor(() => expect(screen.getByText('Nouveau Locataire')).toBeInTheDocument());
    }
  );

  test.each(['Secretaire', 'CommunityManager', 'Communicant'])(
    '%s ne voit ni "Nouveau Contrat" ni "Nouveau Propriétaire" ni "Nouveau Locataire" (aucun droit de mutation GL)',
    async (role) => {
      await renderAsRole(role);
      expect(screen.queryByText('Nouveau Contrat')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Propriétaires' }));
      await waitFor(() => expect(screen.queryByText('Nouveau Propriétaire')).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Locataires' }));
      await waitFor(() => expect(screen.queryByText('Nouveau Locataire')).not.toBeInTheDocument());
    }
  );
});

describe('GestionLocativePage — suppression de Contrat (contrat backend adminOnly)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Admin voit le bouton de suppression du contrat', async () => {
    await renderAsRole('Admin');
    expect(screen.getByTitle('Supprimer')).toBeInTheDocument();
  });

  test.each(['GestionnaireImmobilier', 'Collaborateur'])(
    '%s ne voit jamais le bouton de suppression du contrat (backend adminOnly, jamais un bouton qui échouerait en 403)',
    async (role) => {
      await renderAsRole(role);
      expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
    }
  );
});

describe('GestionLocativePage — onboarding/désactivation de mandat (contrat backend {Admin, GestionnaireImmobilier} exclusivement)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each(['Admin', 'GestionnaireImmobilier'])(
    '%s voit "Ajouter un bien à la gestion locative"',
    async (role) => {
      await renderAsRole(role);
      fireEvent.click(screen.getByRole('button', { name: 'Biens gérés' }));
      // Aucun bien géré dans la fixture → le bouton apparaît deux fois
      // (en-tête + état vide), c'est le rendu attendu de la page elle-même.
      await waitFor(() => expect(screen.getAllByText('Ajouter un bien à la gestion locative').length).toBeGreaterThan(0));
    }
  );

  test('Collaborateur ne voit PAS "Ajouter un bien à la gestion locative" (contrat inchangé, exclusion volontaire préservée)', async () => {
    await renderAsRole('Collaborateur');
    fireEvent.click(screen.getByRole('button', { name: 'Biens gérés' }));
    await waitFor(() => expect(screen.queryAllByText('Ajouter un bien à la gestion locative').length).toBe(0));
  });
});
