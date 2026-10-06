import api from '../services/api';
import { INDIVIDUAL_RENTAL_CONTEXT } from '../services/rentalRequestContext';
import {
  calculerPenalites,
  createContrat,
  createLocataire,
  encaisserPaiementsMultiples,
  getIndividualSubscription,
  getLocataireDossiers,
  getPaiementsPage,
  getRentalContracts,
  getRentalManagement,
  marquerPaiementPaye,
} from '../services/gestionLocativeService';
import { getLeaseLifecycleDashboard, transitionLease } from '../services/rentalLeaseLifecycleService';
import { createRentalMaintenanceTicket, getRentalMaintenanceTickets } from '../services/rentalMaintenanceService';
import { generateQuittance, getContratDocuments } from '../services/documentService';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: { rentals: [], contrats: [], locataires: [], paiements: [], tickets: [], dashboard: {}, subscription: {} } } });
  api.post.mockResolvedValue({ data: { data: { paiement: {}, receipts: [], contrat: {}, ticket: {} } } });
});

const individualConfig = (params = {}) => expect.objectContaining({ params: { ...params, scope: 'individual' }, platformScoped: true });

test('les lectures GL individuelles utilisent les routes canoniques et suppriment le contexte tenant', async () => {
  await getRentalManagement({ page: 1 }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/rental-management', individualConfig({ page: 1 }));

  await getRentalContracts({ statut: 'actif' }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/contrats/location', individualConfig({ statut: 'actif' }));

  await getLocataireDossiers({ page: 2 }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/locataires/dossiers', individualConfig({ page: 2 }));

  await getPaiementsPage({ statut: 'impayé' }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/paiements/location', individualConfig({ statut: 'impayé' }));
});

test('paiement unitaire, batch et pénalités propagent tous le contexte individuel', async () => {
  await marquerPaiementPaye('PAY1', { montantRecu: 10 }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/paiements/location/PAY1/marquer-paye', { montantRecu: 10 }, individualConfig());

  await encaisserPaiementsMultiples({ contrat: 'C1', allocations: [] }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/paiements/location/encaisser-multiple', { contrat: 'C1', allocations: [] }, individualConfig());

  await calculerPenalites(INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/paiements/location/calculer-penalites', {}, individualConfig());
});

test('la création de bail utilise la surface location et non le contrat polymorphique', async () => {
  await createContrat({ bien: 'P1', type: 'location' }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/contrats/location', { bien: 'P1', type: 'location' }, individualConfig());
});

test('la création du locataire pré-bail porte la provenance individuelle explicite', async () => {
  await createLocataire({ nom: 'Moke', prenom: 'Paul', telephone: '0600111222' }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/locataires', expect.any(FormData), individualConfig());
});

test('lifecycle et maintenance partagent le même contexte explicite', async () => {
  await getLeaseLifecycleDashboard(INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/rental-lease-lifecycle/dashboard', individualConfig());
  await transitionLease('C1', 'actif', 'ok', INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/rental-lease-lifecycle/C1/transition', { target: 'actif', comment: 'ok' }, individualConfig());

  await getRentalMaintenanceTickets({ status: 'ouvert' }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/rental-maintenance', individualConfig({ status: 'ouvert' }));
  await createRentalMaintenanceTicket({ propertyId: 'P1' }, INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/rental-maintenance', { propertyId: 'P1' }, individualConfig());
});

test('le statut d’abonnement individuel est lu sur la surface self', async () => {
  await getIndividualSubscription();
  expect(api.get).toHaveBeenCalledWith('/individual-subscriptions/me', { platformScoped: true });
});

test('documents et quittances utilisent eux aussi la frontière individuelle', async () => {
  await getContratDocuments('C1', INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.get).toHaveBeenLastCalledWith('/gestion-docs/contrat/C1', individualConfig());
  await generateQuittance('PAY1', INDIVIDUAL_RENTAL_CONTEXT);
  expect(api.post).toHaveBeenLastCalledWith('/gestion-docs/quittance/PAY1', {}, individualConfig());
});
