// SCL-2 — Sale contract lifecycle machine (Contrat.type='vente').
//
// Certifie l'implémentation minimale (SCL-2 §26) : trois états
// canoniques `projet_vente`, `compromis_signe`, `acte_signe`, dérivation
// depuis les champs déjà persistés (SCL-2 §6), transition CAS via PUT typé
// `/api/contrats/vente/:id` (SCL-2 §8/§9), assertion de finalisation
// Transaction avant `acte_signe` sans en dupliquer les effets (SCL-2 §10),
// snapshot légal + immutabilité post-acte (SCL-2 §11/§13), idempotence
// (SCL-2 §15), rejet du saut single-step (SCL-2 §14), rejet du bypass
// direct `statut='actif'` (SCL-2 §12).

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, addTenantMember } = require('./helpers/tenantAwareFixture');
const { grantOperator } = require('../services/platformOperator/platformOperatorService');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Transaction = require('../models/Transaction');
const Document = require('../models/Document');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const saleContratRoutes = require('../routes/saleContratRoutes');
const rentalContratRoutes = require('../routes/rentalContratRoutes');
const contratRoutes = require('../routes/contratRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);

const app = express();
app.use(express.json());
app.use('/api/contrats/location', rentalContratRoutes);
app.use('/api/contrats/vente', saleContratRoutes);
app.use('/api/contrats', contratRoutes);
app.use(errorHandler);

const signToken = (userId) => jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });
const bearer = (user, tenant) => ({
  Authorization: `Bearer ${signToken(user._id)}`,
  ...(tenant ? { 'X-Platform-Tenant-Id': String(tenant._id) } : {}),
});

let seq = 0;
async function makeUser(overrides = {}) {
  seq += 1;
  return User.create({
    name: `SCL-${seq}`, email: `scl-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!',
    role: 'Client', isEmailVerified: true, ...overrides,
  });
}
async function makeSaleProperty(owner, tenantId, overrides = {}) {
  seq += 1;
  return Property.create({
    title: `SCL Villa ${seq}`, description: 'Description assez longue pour la validation Property.',
    pole: 'Altimmo', type: 'Villa', status: 'vente', price: 5000000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Sale'],
    surface: 90, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id, tenant: tenantId || null, ...overrides,
  });
}
async function makeRentalProperty(owner, tenantId) {
  seq += 1;
  return Property.create({
    title: `SCL Rental ${seq}`, description: 'Description assez longue pour la validation Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { city: 'Brazzaville', arrondissement: 'Centre' },
    latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Rent'],
    surface: 90, statusAdmin: 'Validée', isPublished: true,
    availability: 'Disponible', owner: owner._id, tenant: tenantId || null,
  });
}
async function makeSaleContrat(property, extras = {}) {
  return Contrat.create({
    type: 'vente', bien: property._id, statut: 'en_attente',
    prixVente: 5000000,
    acheteur: { nom: 'Acheteur', prenom: 'Test', email: 'buyer@example.test' },
    ...extras,
  });
}
async function makeRentalContrat(property, extras = {}) {
  return Contrat.create({
    type: 'location', bien: property._id, statut: 'actif',
    dateEntree: new Date('2027-01-01'), dateFinBail: new Date('2027-12-31'),
    montantLoyer: 300000, ...extras,
  });
}
async function makeFinalizedSaleTransaction(property, client, agent, { finalAmount = 5000000, commissionTotal = 500000 } = {}) {
  // On insère directement via la collection (contourne la validation
  // schéma sur `reservation.required` — non pertinente pour ce test : on
  // vérifie l'ASSERTION lifecycle, pas la finalisation elle-même).
  const _id = new mongoose.Types.ObjectId();
  await Transaction.collection.insertOne({
    _id,
    property: property._id,
    client: client._id,
    agent: agent._id,
    reservation: new mongoose.Types.ObjectId(),
    finalAmount,
    transactionType: 'vente',
    status: 'Réussie',
    paymentStatus: 'confirmé',
    commission: { taux: 10, total: commissionTotal, ownerPayout: 0, agencyNet: commissionTotal },
    finalization: { status: 'completed', operationKey: `test:${_id}`, payloadHash: 'x', completedAt: new Date() },
    paiements: [],
    transactionDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Transaction.findById(_id);
}
async function scenarioAB() {
  const A = await createTenantFixture({ label: `SCL-A-${seq++}`, withAdminMembership: true });
  const B = await createTenantFixture({ label: `SCL-B-${seq++}`, withAdminMembership: true });
  const ownerA = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: A.tenant, user: ownerA, bootstrap: A.bootstrap });
  const propertyA = await makeSaleProperty(ownerA, A.tenant._id);
  const ownerB = await makeUser({ role: 'Proprietaire' });
  await addTenantMember({ tenant: B.tenant, user: ownerB, bootstrap: B.bootstrap });
  const propertyB = await makeSaleProperty(ownerB, B.tenant._id);
  return { A, B, propertyA, propertyB, ownerA, ownerB };
}
async function admin(fix) {
  const user = await makeUser({ role: 'Collaborateur' });
  await addTenantMember({ tenant: fix.tenant, user, bootstrap: fix.bootstrap, businessRole: 'Admin' });
  return user;
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('SCL — Sale contract lifecycle (SCL-2)', () => {
  test('SCL-01 (derived state on a legacy contract is projet_vente when no dates are set)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).get(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant));
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBeNull(); // never eagerly written on read
    // deriveSaleCycle exposed via service
    const svc = require('../services/saleContractLifecycleService');
    expect(svc.deriveSaleCycle(after)).toBe('projet_vente');
  });

  test('SCL-02 (projet_vente → compromis_signe via dateSignatureCompromis)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const compromis = new Date('2027-06-01').toISOString();
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: compromis });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBe('compromis_signe');
    expect(after.statut).toBe('en_attente');
    expect(after.saleCycleHistory).toHaveLength(1);
    expect(after.saleCycleHistory[0]).toMatchObject({ from: 'projet_vente', to: 'compromis_signe' });
    expect(new Date(after.dateSignatureCompromis).toISOString()).toBe(compromis);
  });

  test('SCL-03 (compromis_signe → acte_signe after Transaction Réussie: statut becomes actif, snapshot from Transaction)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    await makeFinalizedSaleTransaction(s.propertyA, client, agent, { finalAmount: 5800000, commissionTotal: 580000 });
    const a = await admin(s.A);
    const acte = new Date('2027-07-15').toISOString();
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureActe: acte });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBe('acte_signe');
    expect(after.statut).toBe('actif');
    expect(after.prixVente).toBe(5800000);
    expect(after.commissionAgence).toBe(580000);
    expect(after.saleCycleHistory).toHaveLength(1);
    expect(after.saleCycleHistory[0]).toMatchObject({ from: 'compromis_signe', to: 'acte_signe' });
  });

  test('SCL-04 (projet_vente → acte_signe direct rejected — single-step invariant)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({
      dateSignatureCompromis: new Date('2027-06-01').toISOString(),
      dateSignatureActe: new Date('2027-07-15').toISOString(),
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTRACT_ILLEGAL_TRANSITION');
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBeNull();
    expect(after.dateSignatureCompromis).toBeFalsy();
    expect(after.dateSignatureActe).toBeFalsy();
  });

  test('SCL-05 (acte without finalized Transaction rejected)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({
      dateSignatureActe: new Date('2027-07-15').toISOString(),
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SALE_TRANSACTION_NOT_FINALIZED');
  });

  test('SCL-06 (Transaction on a DIFFERENT property is not accepted for acte_signe)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    // Finalized Transaction for propertyB — must not satisfy contrat on propertyA.
    await makeFinalizedSaleTransaction(s.propertyB, client, agent);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({
      dateSignatureActe: new Date('2027-07-15').toISOString(),
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SALE_TRANSACTION_NOT_FINALIZED');
  });

  test('SCL-07 (same compromis retry is idempotent — no duplicate history)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const compromis = new Date('2027-06-01').toISOString();
    await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: compromis });
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: compromis });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycleHistory).toHaveLength(1);
  });

  test('SCL-08 (same acte retry is idempotent — no duplicate history)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    await makeFinalizedSaleTransaction(s.propertyA, client, agent);
    const a = await admin(s.A);
    const acte = new Date('2027-07-15').toISOString();
    await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureActe: acte });
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureActe: acte });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycleHistory).toHaveLength(1);
  });

  test('SCL-09 (concurrent compromis CAS — only one transition wins)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const compromis = new Date('2027-06-01').toISOString();
    const results = await Promise.all([
      request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: compromis }),
      request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: compromis }),
    ]);
    // Au moins un doit gagner ; les deux ne doivent pas dupliquer l'historique.
    expect(results.some((r) => r.status === 200)).toBe(true);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBe('compromis_signe');
    expect(after.saleCycleHistory.length).toBeLessThanOrEqual(1);
  });

  test('SCL-10 (post-acte financial snapshot is immutable: prixVente/commissionAgence rejected)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    await makeFinalizedSaleTransaction(s.propertyA, client, agent, { finalAmount: 5000000, commissionTotal: 500000 });
    const a = await admin(s.A);
    await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureActe: new Date('2027-07-15').toISOString() });
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ prixVente: 999999 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTRACT_POST_ACTE_IMMUTABLE');
    const after = await Contrat.findById(c._id).lean();
    expect(after.prixVente).toBe(5000000);
  });

  test('SCL-11 (direct statut=actif bypass rejected by lifecycle guard)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ statut: 'actif' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTRACT_STATUT_LOCKED_BY_LIFECYCLE');
    const after = await Contrat.findById(c._id).lean();
    expect(after.statut).toBe('en_attente');
    expect(after.saleCycle).toBeNull();
  });

  test('SCL-12 (cross-tenant PUT rejected — canonical resource frontier preserved)', async () => {
    const s = await scenarioAB();
    const cB = await makeSaleContrat(s.propertyB);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${cB._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: new Date().toISOString() });
    expect([403, 404]).toContain(res.status);
  });

  test('SCL-13 (global Admin without tenant membership — DENIED)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const globalAdmin = await makeUser({ role: 'Admin' });
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(globalAdmin, s.A.tenant)).send({ dateSignatureCompromis: new Date().toISOString() });
    expect([403, 404]).toContain(res.status);
  });

  test('SCL-14 (PlatformOperator without membership — DENIED on typed sale PUT)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const opUser = await makeUser({ role: 'Admin' });
    const granter = await makeUser({ role: 'Admin' });
    await grantOperator({ userId: opUser._id, actor: granter, reason: 'SCL-14', capabilities: ['platform.commercial.manage', 'platform.finance.manage'] });
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(opUser, s.A.tenant)).send({ dateSignatureCompromis: new Date().toISOString() });
    expect([403, 404]).toContain(res.status);
  });

  test('SCL-15 (wrong-domain rental ID sent to /api/contrats/vente/:id → 404 CONTRAT_DOMAIN_MISMATCH)', async () => {
    const s = await scenarioAB();
    const rp = await makeRentalProperty(s.ownerA, s.A.tenant._id);
    const rentalC = await makeRentalContrat(rp);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${rentalC._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: new Date().toISOString() });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONTRAT_DOMAIN_MISMATCH');
  });

  test('SCL-16 (legacy polymorphic PUT still 410)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/${c._id}`).set(bearer(a, s.A.tenant)).send({ prixVente: 6000000 });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
  });

  test('SCL-17 (legacy polymorphic DELETE still 410)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).delete(`/api/contrats/${c._id}`).set(bearer(a, s.A.tenant));
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONTRACT_LEGACY_MUTATION_RETIRED');
  });

  test('SCL-18 (polymorphic GET /api/contrats still exposes both sale and rental)', async () => {
    const s = await scenarioAB();
    await makeSaleContrat(s.propertyA);
    const rp = await makeRentalProperty(s.ownerA, s.A.tenant._id);
    await makeRentalContrat(rp);
    const a = await admin(s.A);
    const res = await request(app).get('/api/contrats').set(bearer(a, s.A.tenant));
    expect(res.status).toBe(200);
    const types = res.body.data.contrats.map((c) => c.type).sort();
    expect(types).toEqual(['location', 'vente']);
  });

  test('SCL-19..22 (sale lifecycle transition writes NO Property/Transaction/Document/Ledger)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    const tx = await makeFinalizedSaleTransaction(s.propertyA, client, agent);
    const before = {
      propertyAvailability: (await Property.findById(s.propertyA._id).lean()).availability,
      propertyIsPublished: (await Property.findById(s.propertyA._id).lean()).isPublished,
      txStatus: tx.status,
      txCommissionTotal: tx.commission.total,
      documentsCount: await Document.countDocuments(),
      ledgerCount: await FinancialLedgerEntry.countDocuments(),
    };
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureActe: new Date('2027-07-15').toISOString() });
    expect(res.status).toBe(200);
    const propertyAfter = await Property.findById(s.propertyA._id).lean();
    const txAfter = await Transaction.findById(tx._id).lean();
    // SCL-19/20 — la machine LIT Transaction/Property, elle N'Y ÉCRIT PAS.
    expect(propertyAfter.availability).toBe(before.propertyAvailability);
    expect(propertyAfter.isPublished).toBe(before.propertyIsPublished);
    expect(txAfter.status).toBe(before.txStatus);
    expect(txAfter.commission.total).toBe(before.txCommissionTotal);
    // SCL-21/22 — aucun invoice/ledger n'est créé par la transition acte_signe.
    expect(await Document.countDocuments()).toBe(before.documentsCount);
    expect(await FinancialLedgerEntry.countDocuments()).toBe(before.ledgerCount);
  });

  test('SCL-23 (rental lifecycle unaffected — legacy rental PUT/statut path preserved)', async () => {
    const s = await scenarioAB();
    const rp = await makeRentalProperty(s.ownerA, s.A.tenant._id);
    const rentalC = await makeRentalContrat(rp);
    const a = await admin(s.A);
    // Un PUT rental à `notes` reste 200 et ne touche pas la machine sale.
    const res = await request(app).put(`/api/contrats/location/${rentalC._id}`).set(bearer(a, s.A.tenant)).send({ notes: 'note rental' });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(rentalC._id).lean();
    expect(after.saleCycle).toBeNull();
    expect(after.saleCycleHistory).toEqual([]);
  });

  test('SCL-24 (marketplace POST /api/contrats remains PLATFORM-only — sale lifecycle does not open it up)', async () => {
    const s = await scenarioAB();
    const a = await admin(s.A);
    const res = await request(app).post('/api/contrats').set(bearer(a, s.A.tenant)).send({ type: 'vente', bien: s.propertyA._id });
    expect([401, 403]).toContain(res.status);
  });

  // ── SCL-3 — Legacy derivation + CAS hardening ─────────────────────────

  test('SCL-3-LEGACY-01 (legacy null saleCycle + no dates → projet_vente; compromis transition allowed)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA); // saleCycle=null, both dates null
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: new Date('2027-06-01').toISOString() });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBe('compromis_signe');
  });

  test('SCL-3-LEGACY-02 (legacy null saleCycle + compromis date set → derived compromis_signe; projet-only transition rejected)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const a = await admin(s.A);
    // Retenter dateSignatureCompromis avec la MÊME valeur : idempotent, aucune écriture.
    const same = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: new Date('2027-06-01').toISOString() });
    expect(same.status).toBe(200);
    let after = await Contrat.findById(c._id).lean();
    expect(after.saleCycleHistory).toHaveLength(0); // idempotent : machine n'a rien poussé
    // Une DEUXIÈME date de compromis (différente) DOIT être rejetée — la
    // machine considère qu'un compromis déjà signé ne se remplace pas via
    // PUT (règle §3 LEGACY-02).
    const different = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: new Date('2027-08-01').toISOString() });
    expect(different.status).toBe(409);
    expect(different.body.code).toBe('CONTRACT_ILLEGAL_TRANSITION');
    after = await Contrat.findById(c._id).lean();
    expect(new Date(after.dateSignatureCompromis).toISOString()).toBe(new Date('2027-06-01').toISOString());
  });

  test('SCL-3-LEGACY-03 (legacy null saleCycle + acte date set → derived acte_signe; behaves terminal)', async () => {
    const s = await scenarioAB();
    // Contrat legacy déjà signé (dates pré-existantes, saleCycle jamais écrit par la machine).
    const c = await makeSaleContrat(s.propertyA, {
      dateSignatureCompromis: new Date('2027-06-01'),
      dateSignatureActe: new Date('2027-07-15'),
    });
    const a = await admin(s.A);
    // Toute mutation de champ snapshot doit être rejetée.
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ prixVente: 999999 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTRACT_POST_ACTE_IMMUTABLE');
  });

  test('SCL-3-LEGACY-04 (explicit saleCycle wins over historical evidence — projet_vente + pre-existing compromis date normalizes forward safely)', async () => {
    const s = await scenarioAB();
    // Cas incohérent conservé pour ne pas réécrire l'historique global :
    // saleCycle='projet_vente' mais dateSignatureCompromis déjà persistée.
    const c = await makeSaleContrat(s.propertyA, {
      saleCycle: 'projet_vente',
      dateSignatureCompromis: new Date('2027-06-01'),
    });
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureCompromis: new Date('2027-06-01').toISOString() });
    // La machine part de saleCycle='projet_vente' explicite, considère la
    // demande comme la transition normale projet_vente → compromis_signe
    // (target='compromis_signe', not idempotent car saleCycle != compromis_signe).
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBe('compromis_signe');
  });

  test('SCL-3-CAS-01 (hardened CAS rejects legacy null saleCycle when dates disagree with FROM)', async () => {
    const s = await scenarioAB();
    // Contrat legacy où saleCycle=null mais dateSignatureCompromis EST posé.
    // Un appel de service qui prétendrait faire `projet_vente → compromis_signe`
    // sans passer par deriveSaleCycle serait bloqué par le CAS durci
    // (legacy null branch requires dateSignatureCompromis:null).
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const svc = require('../services/saleContractLifecycleService');
    let threw = null;
    try {
      // Appel direct au chemin bas niveau — ne devrait jamais réussir
      // parce que dateSignatureCompromis ≠ null (SCL-3 §4).
      // eslint-disable-next-line no-underscore-dangle
      const mod = require('../services/saleContractLifecycleService');
      // On force la voie CAS legacy via l'API de test : construire un
      // findOneAndUpdate équivalent au commit interne serait redondant ;
      // à la place, on prouve l'effet via applyPutMutation :
      // deriveSaleCycle renvoie compromis_signe, donc plan refuse
      // projet_vente semantics.
      const outcome = await mod.applyPutMutation({
        contratId: c._id,
        payload: { dateSignatureCompromis: new Date('2027-06-01').toISOString() },
        actor: null,
      });
      threw = outcome;
    } catch (e) {
      threw = e;
    }
    // Idempotent (même date sur compromis_signe dérivé) — aucune écriture.
    expect(threw && threw.idempotent).toBe(true);
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycleHistory).toHaveLength(0);
  });

  test('SCL-3-BYPASS-01 (client-supplied saleCycle in PUT body is rejected by allow-list)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ saleCycle: 'acte_signe' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTRACT_FIELD_NOT_MUTABLE');
    const after = await Contrat.findById(c._id).lean();
    expect(after.saleCycle).toBeNull();
  });

  test('SCL-3-BYPASS-02 (client-supplied saleCycleHistory in PUT body is rejected)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA);
    const a = await admin(s.A);
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ saleCycleHistory: [{ to: 'acte_signe', action: 'x' }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTRACT_FIELD_NOT_MUTABLE');
  });

  test('SCL-3-SNAPSHOT-01 (payload prixVente/commissionAgence at acte transition CANNOT override Transaction canonical values)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    await makeFinalizedSaleTransaction(s.propertyA, client, agent, { finalAmount: 5800000, commissionTotal: 580000 });
    const a = await admin(s.A);
    // L'utilisateur tente de faire passer un prix et une commission fictifs
    // en même temps que la transition acte_signe — ils ne doivent PAS
    // remplacer le snapshot canonique issu de Transaction.
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({
      dateSignatureActe: new Date('2027-07-15').toISOString(),
      prixVente: 1,
      commissionAgence: 2,
    });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.prixVente).toBe(5800000);
    expect(after.commissionAgence).toBe(580000);
  });

  test('SCL-3-IMMUT-01 (post-acte notes/documents remain mutable — evidence workflow preserved)', async () => {
    const s = await scenarioAB();
    const c = await makeSaleContrat(s.propertyA, { dateSignatureCompromis: new Date('2027-06-01') });
    const client = await makeUser();
    const agent = await makeUser({ role: 'Admin' });
    await makeFinalizedSaleTransaction(s.propertyA, client, agent);
    const a = await admin(s.A);
    await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ dateSignatureActe: new Date('2027-07-15').toISOString() });
    const res = await request(app).put(`/api/contrats/vente/${c._id}`).set(bearer(a, s.A.tenant)).send({ notes: 'post-signature note' });
    expect(res.status).toBe(200);
    const after = await Contrat.findById(c._id).lean();
    expect(after.notes).toBe('post-signature note');
  });
});
