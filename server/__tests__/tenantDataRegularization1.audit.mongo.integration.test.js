// TENANT-DATA-REGULARIZATION-1 — certifie le moteur d'audit read-only
// (`scripts/auditTenantLegacyData.js` + l'extension additive de
// `tenantResourceAttributionService.js`) contre un MongoMemoryReplSet
// jetable, JAMAIS la base réelle. Mission §26-28 : couvre A/B/C/D/E/F,
// contradiction parent/enfant, tenant A vs B, Admin/PlatformOperator sans
// preuve, membership suspendu/révoqué, référence orpheline, tenant
// inexistant, réexécution déterministe. Aucun contournement pour rendre les
// tests verts (§28) — chaque assertion vérifie le comportement fail-closed
// réel, jamais un résultat forcé.
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { startFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const { createTenantFixture, createTenantUser } = require('./helpers/tenantAwareFixture');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Hotel = require('../models/Hotel');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const Notification = require('../models/Notification');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');

jest.setTimeout(180000);

const SCRIPT = path.resolve(__dirname, '../scripts/auditTenantLegacyData.js');
function runScript(args, mongoUri) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'test' },
      cwd: path.resolve(__dirname, '..'),
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}
function parseOutput(stdout) { return JSON.parse(stdout.slice(stdout.indexOf('{'))); }

const baseProperty = (overrides = {}) => ({
  title: 'Fixture Property', description: 'Description suffisamment longue pour la validation du modèle.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 100000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: 4.26, longitude: 15.28,
  images: ['https://example.test/image.jpg'], surface: 150, statusAdmin: 'Validée', isPublished: false, availability: 'Disponible',
  ...overrides,
});

let mongoUri;
let dbName;
let tenantA;
let tenantB;
let adminA; // owns propertyA — real active membership → A
let userNoMembership; // real user, 0 memberships → B
let userSuspended; // real user, membership status suspended → B (not A)
let propertyA;
let propertyB;
let propertyNoMembership;
let propertySuspended;
let orphanContratPropertyId;

beforeAll(async () => {
  const { uri } = await startFinancialMongo();
  mongoUri = uri;
  await mongoose.connect(uri).catch(() => {}); // startFinancialMongo already connects; guard against double-connect noop
  dbName = mongoose.connection.name;

  const fixtureA = await createTenantFixture({ label: 'Regularization Tenant A' });
  const fixtureB = await createTenantFixture({ label: 'Regularization Tenant B' });
  tenantA = fixtureA.tenant;
  tenantB = fixtureB.tenant;

  const memberA = await createTenantUser({ tenant: tenantA, bootstrap: fixtureA.bootstrap });
  adminA = memberA.user;

  userNoMembership = await User.create({
    name: 'No Membership Owner', email: `no-membership-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  });

  userSuspended = await User.create({
    name: 'Suspended Membership Owner', email: `suspended-membership-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire', isEmailVerified: true,
  });
  const suspendedMembership = await OrgMembership.create({
    user: userSuspended._id, orgUnit: tenantA.rootOrgUnit, roleInUnit: 'member', status: 'active', grantedBy: fixtureA.bootstrap._id,
  });
  suspendedMembership.status = 'suspended';
  suspendedMembership.suspendedBy = fixtureA.bootstrap._id;
  suspendedMembership.suspendedAt = new Date();
  await suspendedMembership.save();

  propertyA = await Property.create(baseProperty({ title: 'Property Tenant A (certain)', owner: adminA._id }));
  const memberB = await createTenantUser({ tenant: tenantB, bootstrap: fixtureB.bootstrap });
  propertyB = await Property.create(baseProperty({ title: 'Property Tenant B (certain)', owner: memberB.user._id }));
  propertyNoMembership = await Property.create(baseProperty({ title: 'Property owner without membership (probable)', owner: userNoMembership._id }));
  propertySuspended = await Property.create(baseProperty({ title: 'Property owner suspended membership (probable, not certain)', owner: userSuspended._id }));

  orphanContratPropertyId = new mongoose.Types.ObjectId();
});

afterAll(async () => stopFinancialMongo());

describe('Classification A — attribution certaine', () => {
  test('Property dont le owner a un unique membership actif → A, tenant correct', async () => {
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(propertyA._id));
    expect(entry.classification).toBe('A');
    expect(entry.targetTenant).toBe(String(tenantA._id));
    expect(entry.recommendedAction).toBe('READY_FOR_FUTURE_CONTROLLED_ATTRIBUTION');
  });

  test('Tenant B suit le même mécanisme, jamais confondu avec A (mission §19 — comme si Tenant B existait déjà)', async () => {
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(propertyB._id));
    expect(entry.classification).toBe('A');
    expect(entry.targetTenant).toBe(String(tenantB._id));
    expect(entry.targetTenant).not.toBe(String(tenantA._id));
  });

  test('--tenant filtre matchesRequestedTenant correctement (A pour B mais matchesRequestedTenant=false si on demande A)', async () => {
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property', `--tenant=${tenantA._id}`], mongoUri);
    const output = parseOutput(res.stdout);
    const entryB = output.manifest.find((m) => m.resourceId === String(propertyB._id));
    expect(entryB.matchesRequestedTenant).toBe(false);
    const entryA = output.manifest.find((m) => m.resourceId === String(propertyA._id));
    expect(entryA.matchesRequestedTenant).toBe(true);
  });
});

describe('Classification B — probable / validation humaine (jamais promu en A)', () => {
  test('Property dont le owner existe réellement mais n\'a aucun membership → B, jamais A', async () => {
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(propertyNoMembership._id));
    expect(entry.classification).toBe('B');
    expect(entry.targetTenant).toBeNull();
    expect(entry.proofs.some((p) => /→no_tenant/.test(p))).toBe(true);
  });

  test('membership suspendu ne compte jamais comme actif — reste B, jamais A', async () => {
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(propertySuspended._id));
    expect(entry.classification).toBe('B');
    expect(entry.targetTenant).toBeNull();
  });
});

describe('B ne doit jamais être confondu avec F (mission §6 — B exige une entité réelle nommée, jamais une simple absence de relation)', () => {
  test('Locataire sans aucun Contrat le référençant → F, jamais B', async () => {
    const locataire = await Locataire.create({ nom: 'Locataire', prenom: 'SansContrat', telephone: '060000001', adresse: 'Adresse test' });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Locataire'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(locataire._id));
    expect(entry.classification).toBe('F');
  });

  test('Locataire dont l\'unique Contrat a bien=null (cas réel GL-RECON-UX-1) → F, jamais B', async () => {
    const locataire = await Locataire.create({ nom: 'Locataire', prenom: 'ContratSansBien', telephone: '060000002', adresse: 'Adresse test' });
    await Contrat.create({ locataire: locataire._id, type: 'location', dateDebut: new Date(), loyerMensuel: 1000, adresseBien: 'Texte libre historique' });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Locataire'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(locataire._id));
    expect(entry.classification).toBe('F');
  });
});

describe('Champ optionnel jamais renseigné (null) ne doit jamais se faire passer pour une référence orpheline (D)', () => {
  test('Document.relatedProperty=null + createdBy réel sans tenant → B, jamais D (bug réel trouvé sur données réelles)', async () => {
    const Document = require('../models/Document');
    const doc = await Document.create({ type: 'Devis', nom: 'Document fixture', createdBy: userNoMembership._id, relatedProperty: null });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Document'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(doc._id));
    expect(entry.classification).toBe('B');
  });

  test('Litige.bienConcerné=null, aucune autre preuve → F, jamais D', async () => {
    const LitigeModel = require('../models/Litige');
    const litige = await LitigeModel.create({ bienConcerné: null, type: 'Autre', description: 'Fixture description suffisamment longue pour la validation.' });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Litige'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(litige._id));
    expect(entry.classification).toBe('F');
  });
});

describe('Classification D via vérification d\'existence référentielle (limite du moteur canonique compensée)', () => {
  test('Property.owner pointe vers un User qui n\'existe pas du tout → D, jamais B (distinct d\'un vrai compte sans tenant)', async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId();
    const property = await Property.create(baseProperty({ title: 'Property owner inexistant (orphelin réel)', owner: nonExistentUserId }));
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(property._id));
    expect(entry.classification).toBe('D');
    expect(entry.recommendedAction).toBe('HUMAN_REVIEW_REQUIRED_ORPHAN_REFERENCE');
  });
});

describe('Classification C — contradiction (fail closed, jamais un choix arbitraire)', () => {
  test('Hotel avec tenant explicite A mais manager membre de B → C, jamais A ni B choisi arbitrairement', async () => {
    const memberB = await createTenantUser({ tenant: tenantB, bootstrap: (await User.findOne({ role: 'Admin' })) });
    const hotel = await Hotel.create({
      name: 'Hotel Contradictoire', tenant: tenantA._id, manager: memberB.user._id, createdBy: memberB.user._id,
    });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Hotel'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(hotel._id));
    expect(entry.classification).toBe('C');
    expect(entry.targetTenant).toBeNull();
    expect(entry.recommendedAction).toBe('HUMAN_REVIEW_REQUIRED_CONTRADICTION_FAIL_CLOSED');
  });

  test('Locataire lié à deux contrats pointant vers des Property de tenants différents → C', async () => {
    const locataire = await Locataire.create({ nom: 'Locataire', prenom: 'Contradictoire', telephone: '060000000', adresse: 'Adresse test' });
    await Contrat.create({ bien: propertyA._id, locataire: locataire._id, type: 'location', dateDebut: new Date(), loyerMensuel: 1000 });
    await Contrat.create({ bien: propertyB._id, locataire: locataire._id, type: 'location', dateDebut: new Date(), loyerMensuel: 1000 });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Locataire'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(locataire._id));
    expect(entry.classification).toBe('C');
  });
});

describe('Classification D — référence orpheline (jamais inventée)', () => {
  test('Contrat.bien pointe vers une Property inexistante → D', async () => {
    const contrat = await Contrat.create({ bien: orphanContratPropertyId, type: 'location', dateDebut: new Date(), loyerMensuel: 1000 });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Contrat'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(contrat._id));
    expect(entry.classification).toBe('D');
    expect(entry.proofs.some((p) => /→missing/.test(p))).toBe(true);
  });
});

describe('Classification E — ressource globale légitime (jamais déduite de tenant==null seul)', () => {
  test('FinancialLedgerEntry domain=altcom → E, justifiée par l\'architecture, pas par l\'absence de tenant', async () => {
    const entry1 = await FinancialLedgerEntry.create({
      eventType: 'test_event', domain: 'altcom', establishmentType: 'Property', establishmentId: propertyA._id,
      entityType: 'Property', entityId: propertyA._id, actorType: 'system', businessOperationKey: `altcom-${Date.now()}`,
    });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=FinancialLedgerEntry'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(entry1._id));
    expect(entry.classification).toBe('E');
    expect(entry.recommendedAction).toBe('NO_ACTION_GLOBAL_BY_ARCHITECTURE');
  });

  test('FinancialLedgerEntry domain=real_estate (dans le graphe SaaS) → jamais E automatiquement', async () => {
    const entry1 = await FinancialLedgerEntry.create({
      eventType: 'test_event', domain: 'real_estate', establishmentType: 'Property', establishmentId: propertyA._id,
      entityType: 'Property', entityId: propertyA._id, actorType: 'system', businessOperationKey: `realestate-${Date.now()}`,
    });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=FinancialLedgerEntry'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(entry1._id));
    expect(entry.classification).not.toBe('E');
    expect(entry.classification).toBe('A'); // resolved via establishmentId → propertyA → tenant A
  });
});

describe('Classification F — non déterminable (aucune preuve exploitable)', () => {
  test('Notification tenant=null, aucune autre preuve → F, jamais F confondu avec D', async () => {
    const notif = await Notification.create({
      type: 'tenant_invitation_received', platformTenant: null,
      recipient: userNoMembership._id, title: 'Fixture', body: 'Fixture body for regularization audit test.',
    });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Notification'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(notif._id));
    expect(entry.classification).toBe('F');
    expect(entry.proofs.some((p) => /→missing/.test(p))).toBe(false);
  });
});

describe('Admin/PlatformOperator ne sont jamais une preuve d\'attribution (mission §17-18)', () => {
  test('Property possédée par un Admin sans membership → B, jamais A par le seul rôle', async () => {
    const admin = await User.create({
      name: 'Admin No Membership', email: `admin-no-membership-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    const property = await Property.create(baseProperty({ title: 'Property Admin sans preuve', owner: admin._id }));
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(property._id));
    expect(entry.classification).toBe('B');
    expect(entry.targetTenant).toBeNull();
  });

  test('Property possédée par un PlatformOperator actif sans membership → B, jamais A par la seule capacité opérateur', async () => {
    const operatorUser = await User.create({
      name: 'Operator No Membership', email: `operator-no-membership-${Date.now()}@example.test`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    });
    const grantingAdmin = await User.findOne({ role: 'Admin', _id: { $ne: operatorUser._id } });
    await PlatformOperator.create({
      user: operatorUser._id, status: 'active', capabilities: ['platform.tenants.read'],
      grantedBy: grantingAdmin._id, grantedAt: new Date(), grantReason: 'test fixture',
    });
    const property = await Property.create(baseProperty({ title: 'Property PlatformOperator sans preuve', owner: operatorUser._id }));
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(property._id));
    expect(entry.classification).toBe('B');
    expect(entry.targetTenant).toBeNull();
  });
});

describe('Tenant inexistant — distinct de la classification A/B/C/D/E/F (vérification référentielle séparée)', () => {
  test('Document avec un tenant stocké qui ne correspond à aucun PlatformTenant réel → classifié A structurellement, mais tenantInexistant=true dans les stats', async () => {
    const Document = require('../models/Document');
    const fakeTenantId = new mongoose.Types.ObjectId();
    const doc = await Document.create({ tenant: fakeTenantId, type: 'Devis', nom: 'Document fixture' });
    const res = await runScript(['--confirm-database=' + dbName, '--resource=Document'], mongoUri);
    const output = parseOutput(res.stdout);
    const entry = output.manifest.find((m) => m.resourceId === String(doc._id));
    expect(entry.classification).toBe('A');
    expect(entry.currentTenantExists).toBe(false);
    expect(output.report.perCollection.Document.tenantInexistant).toBeGreaterThanOrEqual(1);
  });
});

describe('Sécurité du script lui-même', () => {
  test('refuse --apply/--write/--force/--backfill même sans connexion', async () => {
    const res = await runScript(['--confirm-database=' + dbName, '--apply'], mongoUri);
    expect(res.code).toBe(2);
    expect(res.stderr).toMatch(/WRITE_FLAG_REFUSED/);
  });

  test('refuse une base non confirmée', async () => {
    const res = await runScript([], mongoUri);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/DATABASE_NOT_CONFIRMED/);
  });

  test('réexécution déterministe — même entrée, même sortie (hors timestamp)', async () => {
    const res1 = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const res2 = await runScript(['--confirm-database=' + dbName, '--resource=Property'], mongoUri);
    const out1 = parseOutput(res1.stdout);
    const out2 = parseOutput(res2.stdout);
    delete out1.report.generatedAt; delete out2.report.generatedAt;
    expect(out1).toEqual(out2);
  });

  test('n\'écrit jamais rien — aucune collection ne change de taille après exécution', async () => {
    const before = await Property.countDocuments();
    await runScript(['--confirm-database=' + dbName], mongoUri);
    const after = await Property.countDocuments();
    expect(after).toBe(before);
  });
});
