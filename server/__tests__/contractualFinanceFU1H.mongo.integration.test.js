// F-U1.H — gouvernance des habilitations financières sensibles (vrai replica
// set) : double contrôle, périmètres TENANT/PLATFORM, invalidation immédiate,
// identité humaine et indépendance, bootstrap contrôlé, surface HTTP.
process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = 'f-u1-test-fingerprint-key-0123456789abcdef';
process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = 'f-u1h-test-identity-key-0123456789abcdef';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser, tenantActor } = require('./helpers/tenantAwareFixture');
const { activeGrantFixture } = require('./helpers/contractualGrantFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const ContractualFinanceGrant = require('../models/ContractualFinanceGrant');
const ContractualGrantBootstrap = require('../models/ContractualGrantBootstrap');
const HumanIdentityAttestation = require('../models/HumanIdentityAttestation');
const ManagementMandate = require('../models/ManagementMandate');
const ManagementMandateVersion = require('../models/ManagementMandateVersion');
const MandateExpense = require('../models/MandateExpense');
const ExpenseAuthorization = require('../models/ExpenseAuthorization');
const { PLATFORM_WIDE_CONTEXT_SOURCE } = require('../constants/platformOperatorConstants');
const grants = require('../services/finance/contractual/contractualFinanceGrantService');
const mandates = require('../services/finance/contractual/managementMandateService');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const expenses = require('../services/finance/contractual/mandateExpenseService');
const { resolveContractualAuthority, CONTRACTUAL_CAPABILITIES: CAP, SENSITIVE_CAPABILITIES } = require('../services/finance/contractual/contractualFinanceAuthorizationService');
const { errorHandler } = require('../middleware/errorMiddleware');
const routes = require('../routes/contractualFinanceRoutes');

const app = express(); app.use(express.json()); app.use('/v1', routes); app.use(errorHandler);
jest.setTimeout(180000);
const oid = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
const future = () => new Date(Date.now() + 90 * DAY);
let seq = 0;
let A; let B; let gov1; let gov2; let gov3; let plainAdmin; let gestionnaire; let secretaire; let adminB; let govB;

beforeAll(async () => {
  await startFinancialMongo();
  await Promise.all([ContractualFinanceGrant, ContractualGrantBootstrap, HumanIdentityAttestation, ManagementMandate, ManagementMandateVersion, MandateExpense, ExpenseAuthorization].map((model) => model.syncIndexes()));
});
afterAll(stopFinancialMongo);

async function member(fixture, businessRole, overrides = {}) {
  const { user } = await createTenantUser({ ...fixture, businessRole, overrides: { role: 'Client', ...overrides } });
  return { user, actor: tenantActor(user, fixture.tenant) };
}
async function plainUser(role = 'Client') {
  seq += 1;
  return User.create({ name: `U ${seq}`, email: `fu1h-${Date.now()}-${seq}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
}
async function operator(capabilities) {
  const user = await plainUser();
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities, grantedBy: oid(), grantReason: 'Test F-U1.H' });
  return { user, actor: { _id: user._id, tenantContextSource: PLATFORM_WIDE_CONTEXT_SOURCE } };
}
// Attestation de fixture : identité distincte par défaut, ou partagée via `key`.
const attest = (user, key = `id-${user._id}`) => HumanIdentityAttestation.create({ user: user._id || user, identityKey: key, documentKind: 'NATIONAL_ID', evidenceRef: 'doc://cni', verifiedBy: oid(), verifiedAt: new Date() });
const caps = async (actor) => (await resolveContractualAuthority(actor)).capabilities;
const token = (user) => `Bearer ${jwt.sign({ id: user._id, tokenVersion: 0 }, process.env.JWT_SECRET)}`;
const propose = (actor, userId, capability = CAP.FINANCIAL_APPROVE, extra = {}) => grants.proposeGrant({ actor, userId, capability, justification: 'Besoin métier', validUntil: future(), idempotencyKey: `k-${oid()}`, ...extra });

beforeEach(async () => {
  await clearFinancialMongo();
  delete process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED;
  A = await createTenantFixture({ label: 'FU1H A' }); B = await createTenantFixture({ label: 'FU1H B' });
  gov1 = await member(A, 'Admin'); gov2 = await member(A, 'Admin'); gov3 = await member(A, 'Admin'); plainAdmin = await member(A, 'Admin');
  gestionnaire = await member(A, 'GestionnaireImmobilier'); secretaire = await member(A, 'Secretaire');
  adminB = await member(B, 'Admin'); govB = await member(B, 'Admin');
  for (const g of [gov1, gov2, gov3]) await activeGrantFixture({ user: g.user, capability: CAP.GRANTS_GOVERN, tenant: A.tenant });
  await activeGrantFixture({ user: govB.user, capability: CAP.GRANTS_GOVERN, tenant: B.tenant });
});

describe('F-U1.H — double contrôle (niveau organisation)', () => {
  test('1/3. proposition puis approbation par un second gouverneur ; indépendance prouvée → active et utilisable', async () => {
    for (const u of [gov1, gov2, plainAdmin]) await attest(u.user);
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    expect(grant).toMatchObject({ status: 'proposed', scopeType: 'TENANT' });
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(false);
    const { grant: approved } = await grants.approveGrant({ actor: gov2.actor, grantId: grant._id });
    expect(approved.status).toBe('active');
    expect(approved.history.map((h) => h.action)).toEqual(['propose', 'approve']);
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(true);
  });

  test('2/19. Admin sans habilitation de gouvernance : ni proposition ni capacité sensible implicite', async () => {
    await expect(propose(plainAdmin.actor, gestionnaire.user._id, CAP.WRITTEN_AUTHORIZATION_VERIFY)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const held = await caps(plainAdmin.actor);
    SENSITIVE_CAPABILITIES.forEach((cap) => expect(held.has(cap)).toBe(false));
  });

  test('4/5. auto-approbation et approbation par le bénéficiaire refusées', async () => {
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    await expect(grants.approveGrant({ actor: gov1.actor, grantId: grant._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    const { grant: forGov3 } = await propose(gov1.actor, gov3.user._id, CAP.COLLECTION_RECONCILE);
    await expect(grants.approveGrant({ actor: gov3.actor, grantId: forGov3._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await expect(propose(gov1.actor, gov1.user._id, CAP.COLLECTION_RECONCILE)).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });

  test('6. bénéficiaire non éligible', async () => {
    await expect(propose(gov1.actor, gestionnaire.user._id, CAP.FINANCIAL_APPROVE)).rejects.toMatchObject({ code: 'GRANT_GRANTEE_NOT_ELIGIBLE' });
    await expect(propose(gov1.actor, secretaire.user._id, CAP.REPRESENTATION_VERIFY)).rejects.toMatchObject({ code: 'GRANT_GRANTEE_NOT_ELIGIBLE' });
    await expect(propose(gov1.actor, (await plainUser('Admin'))._id)).rejects.toMatchObject({ code: 'GRANT_GRANTEE_NOT_ELIGIBLE' });
    await expect(propose(gov1.actor, gestionnaire.user._id, CAP.WRITTEN_AUTHORIZATION_VERIFY)).resolves.toBeDefined();
  });

  test('7/8/9. inter-tenant, portée plateforme depuis un tenant, organisation étrangère', async () => {
    await expect(propose(gov1.actor, adminB.user._id)).rejects.toMatchObject({ code: 'GRANT_GRANTEE_NOT_ELIGIBLE' });
    await expect(propose(gov1.actor, plainAdmin.user._id, CAP.FINANCIAL_APPROVE, { scopeType: 'PLATFORM' })).rejects.toMatchObject({ code: 'GRANT_SCOPE_MISMATCH' });
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    await expect(grants.approveGrant({ actor: govB.actor, grantId: grant._id })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await expect(grants.suspendGrant({ actor: govB.actor, grantId: grant._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_RESOURCE_OUT_OF_SCOPE' });
    await expect(propose(govB.actor, plainAdmin.user._id)).rejects.toMatchObject({ code: 'GRANT_GRANTEE_NOT_ELIGIBLE' });
  });

  test('15. approbations simultanées : une seule réussit', async () => {
    for (const u of [gov1, gov2, gov3, plainAdmin]) await attest(u.user);
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    const results = await Promise.allSettled([grants.approveGrant({ actor: gov2.actor, grantId: grant._id }), grants.approveGrant({ actor: gov3.actor, grantId: grant._id })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ code: 'GRANT_INVALID_TRANSITION' });
  });

  test('16. propositions identiques simultanées : une seule subsiste ; rejeu idempotent', async () => {
    const results = await Promise.allSettled([propose(gov1.actor, plainAdmin.user._id), propose(gov2.actor, plainAdmin.user._id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ code: 'GRANT_ALREADY_PENDING_OR_ACTIVE' });
    const first = await propose(gov3.actor, gestionnaire.user._id, CAP.WRITTEN_AUTHORIZATION_VERIFY, { idempotencyKey: 'stable' });
    const replay = await propose(gov3.actor, gestionnaire.user._id, CAP.WRITTEN_AUTHORIZATION_VERIFY, { idempotencyKey: 'stable' });
    expect(replay.replayed).toBe(true);
    expect(String(replay.grant._id)).toBe(String(first.grant._id));
  });
});

describe('F-U1.H — identité humaine et indépendance', () => {
  test('17. comptes liés par une identité attestée ou par le même téléphone : refusés', async () => {
    await attest(gov1.user); await attest(gov2.user, 'shared'); await attest(plainAdmin.user, 'shared');
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    await expect(grants.approveGrant({ actor: gov2.actor, grantId: grant._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await User.updateOne({ _id: gov3.user._id }, { phone: '+242 06 444 55 66' });
    await User.updateOne({ _id: gov1.user._id }, { phone: '242064445566' });
    await expect(grants.approveGrant({ actor: gov3.actor, grantId: grant._id })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
  });

  test('18. indépendance non prouvée (téléphones différents ou absents) → en attente, inutilisable, puis activée après attestation', async () => {
    await User.updateOne({ _id: gov1.user._id }, { phone: '+242 06 111 11 11' });
    await User.updateOne({ _id: gov2.user._id }, { phone: '+242 05 222 22 22' });
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    const { grant: pending, independence } = await grants.approveGrant({ actor: gov2.actor, grantId: grant._id });
    expect(pending.status).toBe('pending_independence');
    expect(independence.unverified).toHaveLength(3);
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(false);
    for (const u of [gov1, gov2]) await attest(u.user);
    expect((await grants.reevaluateIndependence({ actor: gov3.actor, grantId: grant._id })).grant.status).toBe('pending_independence');
    await attest(plainAdmin.user);
    expect((await grants.reevaluateIndependence({ actor: gov3.actor, grantId: grant._id })).grant.status).toBe('active');
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(true);
  });

  test('F-U1.I : un gouverneur d’organisation ne peut plus délivrer d’attestation d’identité', () => {
    expect(grants.attestHumanIdentity).toBeUndefined();
  });
});

describe('F-U1.H — invalidation immédiate', () => {
  test('10. expiration : inutilisable dès l’échéance, puis marquée expirée', async () => {
    await activeGrantFixture({ user: plainAdmin.user, capability: CAP.FINANCIAL_APPROVE, tenant: A.tenant, validUntil: new Date(Date.now() - 1000) });
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(false);
    expect((await grants.expireDueGrants()).expired).toBe(1);
  });

  test('11. révocation immédiate ; renonciation du bénéficiaire', async () => {
    const grant = await activeGrantFixture({ user: plainAdmin.user, capability: CAP.FINANCIAL_APPROVE, tenant: A.tenant });
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(true);
    await expect(grants.revokeGrant({ actor: gestionnaire.actor, grantId: grant._id, reason: 'x' })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await grants.revokeGrant({ actor: gov2.actor, grantId: grant._id, reason: 'Incident' });
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(false);
    const own = await activeGrantFixture({ user: secretaire.user, capability: CAP.COLLECTION_RECONCILE, tenant: A.tenant });
    expect((await grants.revokeGrant({ actor: secretaire.actor, grantId: own._id, reason: 'Je renonce' })).history.at(-1).action).toBe('renounce');
  });

  test('suspension d’urgence unilatérale ; levée par une autre personne que l’auteur', async () => {
    for (const u of [gov1, gov2, gov3, plainAdmin]) await attest(u.user);
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    await grants.approveGrant({ actor: gov2.actor, grantId: grant._id });
    await grants.suspendGrant({ actor: gov2.actor, grantId: grant._id, reason: 'Incident' });
    expect((await caps(plainAdmin.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(false);
    await expect(grants.reinstateGrant({ actor: gov2.actor, grantId: grant._id, reason: 'Clos' })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    expect((await grants.reinstateGrant({ actor: gov3.actor, grantId: grant._id, reason: 'Incident clos' })).status).toBe('active');
  });

  test('12/14. membre suspendu ou rôle devenu inéligible : droit perdu immédiatement, y compris pour gouverner', async () => {
    await activeGrantFixture({ user: secretaire.user, capability: CAP.COLLECTION_RECONCILE, tenant: A.tenant });
    expect((await caps(secretaire.actor)).has(CAP.COLLECTION_RECONCILE)).toBe(true);
    await OrgMembership.updateMany({ user: secretaire.user._id }, { businessRole: 'Communicant' });
    expect((await caps(secretaire.actor)).has(CAP.COLLECTION_RECONCILE)).toBe(false);
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    await OrgMembership.updateMany({ user: gov2.user._id }, { status: 'suspended' });
    await expect(grants.approveGrant({ actor: gov2.actor, grantId: grant._id })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
  });
});

describe('F-U1.H — niveau plateforme', () => {
  test('13/20. gouvernance plateforme à deux opérateurs ; finance.manage ne suffit pas ; suspension d’opérateur', async () => {
    const opGov1 = await operator(['platform.operators.manage']); const opGov2 = await operator(['platform.operators.manage']);
    const finance = await operator(['platform.finance.manage']);
    for (const op of [opGov1, opGov2]) await activeGrantFixture({ user: op.user, capability: CAP.GRANTS_GOVERN });
    for (const op of [opGov1, opGov2, finance]) await attest(op.user);
    const held = await caps(finance.actor);
    SENSITIVE_CAPABILITIES.forEach((cap) => expect(held.has(cap)).toBe(false));
    await expect(propose(finance.actor, opGov1.user._id, CAP.FINANCIAL_APPROVE)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    const { grant } = await propose(opGov1.actor, finance.user._id, CAP.FINANCIAL_APPROVE);
    expect(grant).toMatchObject({ scopeType: 'PLATFORM', tenant: null });
    expect((await grants.approveGrant({ actor: opGov2.actor, grantId: grant._id })).grant.status).toBe('active');
    expect((await caps(finance.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(true);
    // Un gouverneur plateforme qui sélectionne un tenant ne gouverne pas ce tenant.
    await expect(propose({ _id: opGov1.user._id, platformTenant: A.tenant }, plainAdmin.user._id)).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await PlatformOperator.updateOne({ user: finance.user._id }, { status: 'suspended' });
    expect((await caps(finance.actor)).has(CAP.FINANCIAL_APPROVE)).toBe(false);
  });

  test('contexte non résolu : aucune gouvernance', async () => {
    await expect(propose({ _id: gov1.user._id }, plainAdmin.user._id)).rejects.toMatchObject({ code: 'ADMINISTRATION_SCOPE_REQUIRED' });
  });
});

describe('F-U1.H / F-U1.I — bootstrap contrôlé', () => {
  test('TENANT : désactivé par défaut ; autorisant distinct ; deux gouverneurs attestés ; non réutilisable', async () => {
    const authorizer = await operator(['platform.operators.manage']);
    const C2 = await createTenantFixture({ label: 'FU1H C' });
    const a1 = await member(C2, 'Admin'); const a2 = await member(C2, 'Admin');
    const input = { scopeType: 'TENANT', tenantId: C2.tenant._id, governorUserIds: [a1.user._id, a2.user._id], authorizedByUserId: authorizer.user._id, decisionReference: 'Décision test', validUntil: future() };
    await expect(grants.bootstrapGrantGovernors(input)).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_DISABLED' });
    process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED = 'true';
    await expect(grants.bootstrapGrantGovernors({ ...input, governorUserIds: [a1.user._id] })).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_TWO_GOVERNORS_REQUIRED' });
    await expect(grants.bootstrapGrantGovernors({ ...input, authorizedByUserId: a1.user._id })).rejects.toMatchObject({ code: 'FINANCIAL_UNAUTHORIZED' });
    await expect(grants.bootstrapGrantGovernors(input)).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_IDENTITY_NOT_ATTESTED' });
    for (const u of [authorizer.user, a1.user, a2.user]) await attest(u);
    const { grants: created } = await grants.bootstrapGrantGovernors(input);
    expect(created.map((g) => g.capability)).toEqual([CAP.GRANTS_GOVERN, CAP.GRANTS_GOVERN]);
    expect(created[0].identityBasis).toHaveLength(2);
    await expect(grants.bootstrapGrantGovernors(input)).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_NOT_NEEDED' });
    await ContractualFinanceGrant.updateMany({ tenant: C2.tenant._id }, { status: 'revoked' });
    await expect(grants.bootstrapGrantGovernors(input)).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_ALREADY_EXECUTED' });
    await expect(grants.bootstrapGrantGovernors({ ...input, scopeType: 'PLATFORM', tenantId: null })).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_PLATFORM_ROOT_REQUIRED' });
    delete process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED;
  });

  test('racine PLATFORM : identités hors ligne distinctes, autorisant sans habilitation, une seule fois', async () => {
    const authorizer = await operator(['platform.operators.manage']);
    const op1 = await operator(['platform.operators.manage', 'platform.users.manage']);
    const op2 = await operator(['platform.operators.manage', 'platform.users.manage']);
    const person = (op, number) => ({ userId: op.user._id, documentKind: 'PASSPORT', documentNumber: number, evidenceRef: 'doc://pv-verification' });
    const input = { authorizedBy: person(authorizer, 'PA0000001'), governors: [person(op1, 'PA0000002'), person(op2, 'PA0000003')], decisionReference: 'Décision racine', validUntil: future() };
    await expect(grants.bootstrapPlatformRoot(input)).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_DISABLED' });
    process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED = 'true';
    await expect(grants.bootstrapPlatformRoot({ ...input, governors: [person(op1, 'PA0000002'), person(op2, 'PA0000002')] })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    await expect(grants.bootstrapPlatformRoot({ ...input, governors: [person(op1, 'PA0000002'), person(authorizer, 'PA0000009')] })).rejects.toMatchObject({ code: 'FINANCIAL_SEGREGATION_OF_DUTIES' });
    const { grants: created } = await grants.bootstrapPlatformRoot(input);
    expect(created.map((g) => g.capability).sort()).toEqual([CAP.GRANTS_GOVERN, CAP.GRANTS_GOVERN, CAP.KYC_ATTEST, CAP.KYC_ATTEST].sort());
    expect(await ContractualFinanceGrant.countDocuments({ user: authorizer.user._id })).toBe(0);
    expect((await caps(op1.actor)).has(CAP.KYC_ATTEST)).toBe(true);
    await expect(grants.bootstrapPlatformRoot(input)).rejects.toMatchObject({ code: 'GRANT_BOOTSTRAP_NOT_NEEDED' });
    delete process.env.CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED;
  });
});

describe('F-U1.H — consentement propriétaire indépendant (21)', () => {
  test('un gouverneur porteur de toutes les habilitations ne décide jamais à la place du propriétaire', async () => {
    for (const capability of SENSITIVE_CAPABILITIES.filter((cap) => cap !== CAP.GRANTS_GOVERN)) await activeGrantFixture({ user: gov1.user, capability, tenant: A.tenant });
    const owner = await plainUser('Proprietaire');
    const b = await beneficiaries.registerBeneficiary({ actor: secretaire.actor, ownerId: owner._id, kind: 'MOBILE_MONEY', holderName: 'O', institution: 'MTN', accountIdentifier: '242069990001' });
    await beneficiaries.verifyBeneficiary({ actor: gov1.actor, beneficiaryId: b._id, method: 'Appel', evidence: [{ documentRef: 'doc://rib' }] });
    const propertyId = oid();
    await Property.collection.insertOne({ _id: propertyId, title: 'Bien', owner: owner._id, tenant: A.tenant._id });
    const terms = { offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: new Date(Date.now() - DAY), legalReference: 'M-1', commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' }, collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY', payoutBeneficiary: b._id, feeRules: [], expenseCaps: { perInterventionMinor: 1000, monthlyCumulativeMinor: 5000, period: 'CALENDAR_MONTH' } };
    const { mandate } = await mandates.createMandate({ actor: gov2.actor, propertyId, ownerId: owner._id, reference: 'R', terms, idempotencyKey: 'm' });
    await mandates.activateMandate({ actor: gov2.actor, mandateId: mandate._id });
    const ticket = await RentalMaintenanceTicket.create({ property: propertyId, category: 'plomberie', description: 'x' });
    const { expense } = await expenses.requestExpense({ actor: gestionnaire.actor, mandateId: mandate._id, interventionId: ticket._id, category: 'p', description: 'x', amountMinor: 2000, idempotencyKey: 'e' });
    await expect(expenses.decideExpenseInApp({ actor: gov1.actor, expenseId: expense._id, decision: 'approve', maxAmountMinor: 2000 })).rejects.toMatchObject({ code: 'FINANCIAL_OWNER_REQUIRED' });
    expect((await expenses.decideExpenseInApp({ actor: { _id: owner._id }, expenseId: expense._id, decision: 'approve', maxAmountMinor: 2000 })).expense.status).toBe('authorized');
  });
});

describe('F-U1.H — HTTP (22/23/24)', () => {
  const header = (fixture) => ({ 'X-Platform-Tenant-Id': String(fixture.tenant._id) });

  test('gouverneurs : proposition puis approbation via HTTP dans leur périmètre', async () => {
    for (const u of [gov1, gov2, plainAdmin]) await attest(u.user);
    const proposed = await request(app).post('/v1/grants').set('Authorization', token(gov1.user)).set(header(A)).set('Idempotency-Key', 'h1')
      .send({ userId: String(plainAdmin.user._id), capability: CAP.FINANCIAL_APPROVE, justification: 'Besoin', validUntil: future(), tenant: String(B.tenant._id) });
    expect(proposed.status).toBe(201);
    expect(proposed.body.data.grant).toMatchObject({ status: 'proposed', scopeType: 'TENANT', tenant: String(A.tenant._id) });
    const approved = await request(app).post(`/v1/grants/${proposed.body.data.grant.id}/approve`).set('Authorization', token(gov2.user)).set(header(A));
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ independenceEstablished: true, grant: expect.objectContaining({ status: 'active' }) });
    const listed = await request(app).get('/v1/grants').set('Authorization', token(gov3.user)).set(header(A));
    expect(listed.body.data.some((g) => g.id === proposed.body.data.grant.id)).toBe(true);
    const ownList = await request(app).get('/v1/grants').set('Authorization', token(plainAdmin.user)).set(header(A));
    expect(ownList.body.data.every((g) => g.user === String(plainAdmin.user._id))).toBe(true);
  });

  test('accès non autorisés : sans jeton, sans habilitation, autre tenant', async () => {
    expect((await request(app).get('/v1/grants')).status).toBe(401);
    const denied = await request(app).post('/v1/grants').set('Authorization', token(plainAdmin.user)).set(header(A)).set('Idempotency-Key', 'h2').send({ userId: String(gestionnaire.user._id), capability: CAP.WRITTEN_AUTHORIZATION_VERIFY, justification: 'x', validUntil: future() });
    expect(denied.status).toBe(403);
    const { grant } = await propose(gov1.actor, plainAdmin.user._id);
    const cross = await request(app).post(`/v1/grants/${grant._id}/approve`).set('Authorization', token(govB.user)).set(header(B));
    expect(cross.status).toBe(404);
    expect(JSON.stringify(cross.body)).not.toContain(String(plainAdmin.user._id));
    const policy = await request(app).post('/v1/refund-policies').set('Authorization', token(gov1.user)).set(header(A)).send({ activity: 'HOSPITALITY', currency: 'XAF', ownerConsentRequired: false, standardApprovalMaxMinor: 50000 });
    expect(policy.status).toBe(422);
  });

  test.each([
    ['/v1/refunds/x/execute'], ['/v1/refunds/x/approve'], ['/v1/refunds/x/release'], ['/v1/payouts/x/execute'],
    ['/v1/refund-policies/x/activate'], ['/v1/grants/bootstrap'], ['/v1/identity-attestations'],
  ])('mouvement de fonds / procédure hors API non exposé : POST %s', async (path) => {
    const response = await request(app).post(path).set('Authorization', token(gov1.user)).set(header(A)).send({});
    expect(response.status).toBe(404);
  });
});
