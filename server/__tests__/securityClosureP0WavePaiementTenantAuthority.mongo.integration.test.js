// SECURITY-CLOSURE-P0-WAVE-1 (P0-B + P0-C, findings RA-02/RA-03, source
// TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md) — reproduction
// rouge->verte PERMANENTE, même fichier/domaine (paiementController.js) :
// - RA-02 : GET /api/paiements, /stats, /alertes n'appliquaient aucun
//   filtre tenant (filter construit uniquement à partir de req.query).
// - RA-03 : POST /api/paiements/encaisser-multiple prenait `contrat`/
//   `paiementId` directement du corps de la requête, contournant le
//   `router.param('id', …)` (TENANT-CERT-2) qui protège les autres routes
//   de ce même fichier.
// Contrat cible : dérivation relationnelle Paiement→Contrat→Property.tenant
// (Property a un champ `tenant` direct), fail-closed pour tout staff sans
// tenant résolu via `requireTenantScopeForStaffOrPlatformOperator`
// (même garde canonique que HF-FINAL-01/Messaging).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const paiementRoutes = require('../routes/paiementRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');
const organizationService = require('../services/organizationService');
const platformTenantService = require('../services/platformTenant/platformTenantService');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/paiements', paiementRoutes);
app.use(errorHandler);

const signToken = (id) => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenantId) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenantId ? { 'X-Platform-Tenant-Id': String(tenantId) } : {}),
});

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let seq = 0;
async function buildTenantWithPaiement(label, montant) {
  seq += 1;
  const admin = await User.create({ name: `Admin ${label}`, email: `p0bc-admin-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true });
  const secretaire = await User.create({ name: `Secretaire ${label}`, email: `p0bc-sec-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Secretaire', isEmailVerified: true });
  const owner = await User.create({ name: `Owner ${label}`, email: `p0bc-owner-${label}-${seq}-${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true });
  const tenant = await platformTenantService.createTenant({ name: `P0BC-${label}-${seq}-${Date.now()}`, actor: admin });
  await Promise.all([
    organizationService.grantMembership({ userId: admin._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    organizationService.grantMembership({ userId: secretaire._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
    // La frontière tenant canonique (tenantResourceAttributionService) résout
    // le tenant d'un Property via l'appartenance (OrgMembership) de son
    // `owner` — indispensable ici pour que le fixture reflète une attribution
    // réellement résolue, pas juste un champ `tenant` dénormalisé.
    organizationService.grantMembership({ userId: owner._id, orgUnitId: tenant.rootOrgUnit, actor: admin }),
  ]);
  const property = await Property.create({
    title: `Villa P0BC ${label}`, description: 'Description suffisamment longue pour la validation du modele Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id, tenant: tenant._id,
  });
  const proprietaire = await Proprietaire.create({ nom: `Prop${label}${seq}`, prenom: 'Test', telephone: `+2420600${seq}0001` });
  const locataire = await Locataire.create({ nom: `Loc${label}${seq}`, prenom: 'Test', telephone: `+2420600${seq}0002` });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: montant,
  });
  const paiement = await Paiement.create({ contrat: contrat._id, mois: 1, annee: 2027, montant, montantTotal: montant, montantRecu: 0, statut: 'impayé' });
  return { admin, secretaire, tenant, property, contrat, paiement };
}

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-B) — GET /api/paiements, /stats, /alertes', () => {
  test('1. Liste : un Secretaire du tenant A ne voit QUE les paiements du tenant A', async () => {
    const a = await buildTenantWithPaiement('A', 111111);
    const _b = await buildTenantWithPaiement('B', 222222);
    const res = await request(app).get('/api/paiements').set(bearer(a.secretaire, a.tenant._id));
    expect(res.status).toBe(200);
    const montants = res.body.data.paiements.map((p) => p.montant);
    expect(montants).toContain(111111);
    expect(montants).not.toContain(222222);
  });

  test('2. Stats : agrégation limitée au tenant A uniquement', async () => {
    const a = await buildTenantWithPaiement('C', 50000);
    const _b = await buildTenantWithPaiement('D', 70000);
    const res = await request(app).get('/api/paiements/stats').set(bearer(a.secretaire, a.tenant._id));
    expect(res.status).toBe(200);
    expect(res.body.data.stats.totalAttendu).toBe(50000);
  });

  test('3. Alertes : bailsExpiration/impayés limités au tenant A', async () => {
    const a = await buildTenantWithPaiement('E', 60000);
    await Paiement.updateOne({ _id: a.paiement._id }, { statut: 'en_retard', retardJours: 10 });
    const b = await buildTenantWithPaiement('F', 80000);
    await Paiement.updateOne({ _id: b.paiement._id }, { statut: 'en_retard', retardJours: 10 });
    const res = await request(app).get('/api/paiements/alertes').set(bearer(a.secretaire, a.tenant._id));
    expect(res.status).toBe(200);
    expect(res.body.data.nbImpayes).toBe(1);
  });

  test('4. Admin B ne voit pas les paiements du tenant A', async () => {
    const _a = await buildTenantWithPaiement('G', 10000);
    const b = await buildTenantWithPaiement('H', 20000);
    const res = await request(app).get('/api/paiements').set(bearer(b.admin, b.tenant._id));
    const montants = res.body.data.paiements.map((p) => p.montant);
    expect(montants).not.toContain(10000);
  });

  test('5. Staff multi-tenant sans en-tête → fail-closed (HF-FINAL-01 réutilisé)', async () => {
    const a = await buildTenantWithPaiement('I', 30000);
    await organizationService.grantMembership({ userId: a.secretaire._id, orgUnitId: (await buildTenantWithPaiement('J', 40000)).tenant.rootOrgUnit, actor: a.admin });
    const res = await request(app).get('/api/paiements').set(bearer(a.secretaire));
    expect(res.status).toBe(403);
  });
});

describe('SECURITY-CLOSURE-P0-WAVE-1 (P0-C) — POST /api/paiements/encaisser-multiple', () => {
  test('6. Secretaire du tenant A ne peut PAS encaisser une échéance du tenant B', async () => {
    const a = await buildTenantWithPaiement('K', 90000);
    const b = await buildTenantWithPaiement('L', 90000);
    const res = await request(app)
      .post('/api/paiements/encaisser-multiple')
      .set(bearer(a.secretaire, a.tenant._id))
      .send({ contrat: String(b.contrat._id), allocations: [{ paiementId: String(b.paiement._id), montant: 90000 }], modePaiement: 'espèces' });
    expect(res.status).not.toBe(200);
    const fresh = await Paiement.findById(b.paiement._id);
    expect(fresh.statut).toBe('impayé');
  });

  test('7. Secretaire du tenant A PEUT encaisser une échéance de son propre tenant (comportement historique préservé)', async () => {
    const a = await buildTenantWithPaiement('M', 90000);
    const res = await request(app)
      .post('/api/paiements/encaisser-multiple')
      .set(bearer(a.secretaire, a.tenant._id))
      .send({ contrat: String(a.contrat._id), allocations: [{ paiementId: String(a.paiement._id), montant: 90000 }], modePaiement: 'espèces' });
    expect(res.status).toBe(200);
    const fresh = await Paiement.findById(a.paiement._id);
    expect(fresh.statut).toBe('payé');
  });

  test('8. Contrat B mixé dans une liste sinon valide → aucune mutation, y compris sur A', async () => {
    const a = await buildTenantWithPaiement('N', 50000);
    const b = await buildTenantWithPaiement('O', 50000);
    const res = await request(app)
      .post('/api/paiements/encaisser-multiple')
      .set(bearer(a.secretaire, a.tenant._id))
      .send({ contrat: String(b.contrat._id), allocations: [{ paiementId: String(b.paiement._id), montant: 50000 }], modePaiement: 'espèces' });
    expect(res.status).not.toBe(200);
    expect(await Paiement.findById(a.paiement._id)).toMatchObject({ statut: 'impayé' });
    expect(await Paiement.findById(b.paiement._id)).toMatchObject({ statut: 'impayé' });
  });

  test('9. Effets de bord : aucun reçu (RentalPaymentReceipt) créé pour une tentative cross-tenant', async () => {
    const RentalPaymentReceipt = require('../models/RentalPaymentReceipt');
    const a = await buildTenantWithPaiement('P', 90000);
    const b = await buildTenantWithPaiement('Q', 90000);
    await request(app)
      .post('/api/paiements/encaisser-multiple')
      .set(bearer(a.secretaire, a.tenant._id))
      .send({ contrat: String(b.contrat._id), allocations: [{ paiementId: String(b.paiement._id), montant: 90000 }], modePaiement: 'espèces' });
    expect(await RentalPaymentReceipt.countDocuments({ paiement: b.paiement._id })).toBe(0);
  });
});
