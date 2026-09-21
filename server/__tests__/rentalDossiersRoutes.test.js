// __tests__/rentalDossiersRoutes.test.js — Sprint GL-B2
// GET /api/locataires/dossiers, GET /api/locataires/:id/dossier,
// pagination/stats sur /api/paiements, et correctif de permission
// STAFF_DOC sur /api/documents (GestionnaireImmobilier).

jest.mock('../models/Locataire');
jest.mock('../models/Contrat');
jest.mock('../models/Paiement');
jest.mock('../models/RentalManagement');
jest.mock('../models/Document');
jest.mock('../models/User');
jest.mock('../models/Property');
jest.mock('../models/RentalPaymentReceipt', () => ({ create: jest.fn().mockResolvedValue({ _id: 'RECEIPT-1' }) }));
// GL-DEBT-1 (Phase 5-9) : marquerPaye passe par runFinancialOperation
// (session Mongo réelle) — sans DB (convention unit test), on simule le
// mode "fallback" (identique au comportement réel sans replica set).
jest.mock('../services/finance/financialTransactionService', () => ({
  runFinancialOperation: (meta, operation) => operation({ session: null, transactional: false }),
}));
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../scripts/sync-facebook', () => ({ syncFacebook: jest.fn() }));
jest.mock('../services/zohoImapService', () => ({ pollZohoInbox: jest.fn() }));
jest.mock('../services/alerteService', () => ({ verifierPaiementsEnRetard: jest.fn() }));
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveAvailableTenantsForUser: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439001' }]),
  resolveEffectiveTenantContext: jest.fn().mockResolvedValue({ tenant: { _id: '607f1f77bcf86cd799439001' }, source: 'membership' }),
  resolveTenantScope: jest.fn().mockResolvedValue({ scopeUserIds: new Set(['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439044']) }),
  // TENANT-CERT-2 — la couche transversale de correction (Property/GL,
  // voir __tests__/tenantCert2.adversarial.mongo.integration.test.js pour
  // la vérification réelle) appelle désormais aussi `resolveTenantForUser`
  // directement ; mocké ici pour ne jamais dépendre d'une vraie connexion
  // Mongo dans ce test unitaire (modèles déjà mockés ci-dessus).
  resolveTenantForUser: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439001', rootOrgUnit: '607f1f77bcf86cd799439001' }),
  resolveRootOrgUnitId: jest.fn().mockResolvedValue('607f1f77bcf86cd799439001'),
}));
jest.mock('../services/platformTenant/tenantResourceAttributionService', () => ({
  assertResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  assertResourceTenantOrUnattributed: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
  resolveResourceTenant: jest.fn().mockResolvedValue({ status: 'resolved', tenantId: '607f1f77bcf86cd799439001' }),
}));
// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV-3E — CONTRAT-CERTIFICATION-
// BASELINE-CLEANUP. `requireTenantMembershipRole` de la chaîne canonique
// (DELETE /api/contrats/:id, Phase 2/3) interroge `resolveTenantMembership`
// qui, sans DB (convention unit test), reste bloquant. Mock canonique
// aligné sur la même précédence que les autres services tenant déjà
// mockés ci-dessus — jamais un mock ad-hoc au niveau du test.
jest.mock('../services/tenantMembershipService', () => ({
  resolveTenantMembership: jest.fn().mockResolvedValue({ membership: { _id: 'MEMBERSHIP-1', businessRole: 'Admin', status: 'active' }, businessRole: 'Admin', status: 'active' }),
}));
jest.mock('../utils/generateSitemap', () => jest.fn().mockResolvedValue('<xml/>'));
jest.mock('../services/notificationService', () => ({
  notify: jest.fn().mockResolvedValue(), notifyStaff: jest.fn().mockResolvedValue(), notifyMany: jest.fn().mockResolvedValue(),
}));
jest.mock('../config/cloudinary', () => ({
  ...jest.requireActual('../config/cloudinary'),
  destroyFromCloudinary: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const Document = require('../models/Document');
const User = require('../models/User');
const Property = require('../models/Property');

// Property.find est utilisé par plusieurs chaînes (`.distinct(...)` pour
// les scopes propriétaire legacy, `.select(...).lean()` pour la résolution
// tenant canonique via `scopedContratIdsForTenant`). Le stub doit satisfaire
// les deux sans dépendre d'un ordre d'appel.
Property.find = jest.fn(() => {
  const chain = {};
  chain.distinct = jest.fn().mockResolvedValue([]);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue([]);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.equals = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.then = (resolve) => resolve([]);
  return chain;
});
// Contrat.find(...).distinct(...) est aussi appelé par scopedContratIdsForTenant.
// Le mock automatique de jest.mock('../models/Contrat') ne fournit pas la
// chaîne : on installe un stub minimal ici, à côté du reset par test.
const _origContratFind = Contrat.find;
Contrat.find = jest.fn(() => {
  const chain = {};
  chain.distinct = jest.fn().mockResolvedValue([]);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue([]);
  chain.then = (resolve) => resolve([]);
  return chain;
});
// Les tests individuels peuvent surcharger Contrat.find quand ils ont besoin
// d'un comportement précis ; on garde une référence au mock initial pour
// documentation seule.
void _origContratFind;

const ADMIN_ID = '507f1f77bcf86cd799439012';
const GESTIONNAIRE_ID = '507f1f77bcf86cd799439044';
const CLIENT_ID = '507f1f77bcf86cd799439033';
const COLLAB_ID = '507f1f77bcf86cd799439055';
const TENANT_ID = 'a07f1f77bcf86cd799439088';
const PAYMENT_ID = 'b07f1f77bcf86cd799439077';
const CONTRACT_ID = 'c07f1f77bcf86cd799439066';

const makeToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const fakeUser = (id, role) => ({ _id: id, id, name: 'Test User', email: 't@a.com', role, isActive: true, status: 'Actif', tokenVersion: 0 });
const mockUserAuth = (id, role) => {
  User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser(id, role)) });
  User.findByIdAndUpdate = jest.fn().mockReturnValue({ catch: jest.fn() });
};

describe('GET /api/locataires/dossiers — liste enrichie (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — retourne les locataires avec bail/paiements/préavis joints, pagination incluse', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const tenant = { _id: TENANT_ID, nom: 'Dupont', prenom: 'Jean', toObject() { return { _id: TENANT_ID, nom: 'Dupont', prenom: 'Jean' }; } };
    Locataire.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([tenant]) });
    Locataire.countDocuments = jest.fn().mockResolvedValue(1);
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue([]) });
    Paiement.aggregate = jest.fn().mockResolvedValue([]);
    RentalManagement.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([]) });

    const res = await request(app).get('/api/locataires/dossiers').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.locataires[0]).toMatchObject({ nom: 'Dupont', lease: null, paymentSummary: null, activeNotice: null });
    expect(res.body.data.total).toBe(1);
  });

  test('200 — GestionnaireImmobilier a accès (STAFF_IMMO)', async () => {
    mockUserAuth(GESTIONNAIRE_ID, 'GestionnaireImmobilier');
    Locataire.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });
    Locataire.countDocuments = jest.fn().mockResolvedValue(0);
    Contrat.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue([]) });
    const res = await request(app).get('/api/locataires/dossiers').set('Authorization', `Bearer ${makeToken(GESTIONNAIRE_ID)}`);
    expect(res.statusCode).toBe(200);
  });

  test('403 — un client ne peut pas accéder aux dossiers locataires', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    const res = await request(app).get('/api/locataires/dossiers').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('401 sans jeton', async () => {
    const res = await request(app).get('/api/locataires/dossiers');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/paiements — pagination optionnelle + GET /api/paiements/stats (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — sans page/limit, comportement inchangé (pas de champ total)', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Paiement.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });
    const res = await request(app).get('/api/paiements').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBeUndefined();
  });

  test('200 — avec page/limit, réponse paginée', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Paiement.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]),
    });
    Paiement.countDocuments = jest.fn().mockResolvedValue(0);
    const res = await request(app).get('/api/paiements?page=1&limit=10').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.totalPages).toBe(0);
  });

  test('200 — stats d\'encaissement calculées côté serveur', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Paiement.aggregate = jest.fn().mockResolvedValue([{ totalAttendu: 100000, totalEncaisse: 60000, nbPayes: 3, nbPartiels: 1, nbImpayes: 2, nbTotal: 6 }]);
    const res = await request(app).get('/api/paiements/stats').set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.stats.totalImpaye).toBe(40000);
    expect(res.body.data.stats.tauxEncaissement).toBe(60);
  });

  test('403 — un client n\'a jamais accès aux paiements locatifs', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    const res = await request(app).get('/api/paiements/stats').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
  });
});

describe('Paiements locatifs — immutabilité et concurrence', () => {
  afterEach(() => jest.clearAllMocks());

  test('409 — un paiement intégralement encaissé ne peut pas être supprimé', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Paiement.findById = jest.fn().mockResolvedValue({ _id: PAYMENT_ID, statut: 'payé', montantRecu: 100000 });
    const res = await request(app).delete(`/api/paiements/${PAYMENT_ID}`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('PAYMENT_HISTORY_IMMUTABLE');
    expect(Paiement.findOneAndDelete).not.toHaveBeenCalled();
  });

  test('403 — un collaborateur ne peut pas supprimer une échéance', async () => {
    mockUserAuth(COLLAB_ID, 'Collaborateur');
    const res = await request(app).delete(`/api/paiements/${PAYMENT_ID}`).set('Authorization', `Bearer ${makeToken(COLLAB_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('un versement inférieur au loyer est enregistré comme partiel même sans pénalité', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    const current = { _id: PAYMENT_ID, contrat: CONTRACT_ID, statut: 'impayé', montant: 100000, montantRecu: 0, penaliteAppliquee: false, mois: 7, annee: 2026 };
    Paiement.findById = jest.fn().mockResolvedValue(current);
    Paiement.findOneAndUpdate = jest.fn().mockResolvedValue({ ...current, statut: 'partiel', montantRecu: 40000 });
    const res = await request(app).post(`/api/paiements/${PAYMENT_ID}/marquer-paye`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`).send({ montantRecu: 40000 });
    expect(res.statusCode).toBe(200);
    expect(Paiement.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: PAYMENT_ID, statut: 'impayé' }),
      expect.objectContaining({ statut: 'partiel', montantRecu: 40000 }),
      { new: true },
    );
  });

  test('409 — une écriture concurrente ne peut pas écraser un encaissement', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Paiement.findById = jest.fn().mockResolvedValue({ _id: PAYMENT_ID, contrat: CONTRACT_ID, statut: 'impayé', montant: 100000, montantRecu: 0 });
    Paiement.findOneAndUpdate = jest.fn().mockResolvedValue(null);
    const res = await request(app).post(`/api/paiements/${PAYMENT_ID}/marquer-paye`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`).send({ montantRecu: 100000 });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('PAYMENT_CONCURRENT_UPDATE');
  });
});

describe('Contrats — protection de l’historique financier', () => {
  afterEach(() => jest.clearAllMocks());

  // USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.2.XIV-3C — LEGACY-CONTRAT-
  // MUTATION-RETIREMENT. DELETE /api/contrats/:id est désormais retiré
  // uniformément (410 CONTRACT_LEGACY_MUTATION_RETIRED) — jamais aucune
  // évaluation métier (dont CONTRACT_HISTORY_IMMUTABLE) sur la surface
  // legacy. L'invariant `CONTRACT_HISTORY_IMMUTABLE` reste intégralement
  // couvert sur la surface typée par PCCTA-40 (paid payment blocks
  // DELETE /api/contrats/location/:id → 409). La suite LCR-07/08/09
  // certifie parallèlement le 410 legacy + zéro effet de bord.
  test('410 — legacy DELETE /api/contrats/:id est retiré uniformément', async () => {
    mockUserAuth(ADMIN_ID, 'Admin');
    Contrat.findById = jest.fn().mockResolvedValue({ _id: CONTRACT_ID, type: 'location', documents: [] });
    Paiement.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: PAYMENT_ID }) });
    const res = await request(app).delete(`/api/contrats/${CONTRACT_ID}`).set('Authorization', `Bearer ${makeToken(ADMIN_ID)}`);
    expect(res.statusCode).toBe(410);
    expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
    expect(Contrat.deleteOne).not.toHaveBeenCalled();
    expect(Paiement.deleteMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/documents — correctif permission GestionnaireImmobilier (Sprint GL-B2)', () => {
  afterEach(() => jest.clearAllMocks());

  test('403 — IAM-3 interdit le centre documentaire général au GestionnaireImmobilier', async () => {
    mockUserAuth(GESTIONNAIRE_ID, 'GestionnaireImmobilier');
    // Document.find(...).sort(...).populate(...).populate(...) doit résoudre un tableau.
    const chain = { sort: jest.fn(), populate: jest.fn() };
    chain.sort.mockReturnValueOnce(chain);
    chain.populate.mockReturnValueOnce(chain).mockResolvedValueOnce([]);
    Document.find = jest.fn().mockReturnValue(chain);
    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${makeToken(GESTIONNAIRE_ID)}`);
    expect(res.statusCode).toBe(403);
  });

  test('403 — un client n\'a toujours pas accès', async () => {
    mockUserAuth(CLIENT_ID, 'Client');
    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);
    expect(res.statusCode).toBe(403);
  });
});
