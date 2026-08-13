// PLATFORM-ADMIN-BOOTSTRAP-1 — certification du script CLI
// `scripts/bootstrapPlatformOperator.js`, exécuté comme un vrai utilisateur
// l'exécuterait (spawn en sous-processus, jamais un `require()` direct qui
// contournerait le CLI réel), contre un MongoMemoryReplSet dédié — jamais
// `server.js` (cron/Facebook/IMAP/Socket.IO), conformément à la mission
// §29-30 et à l'incident déjà documenté ailleurs dans ce dépôt où charger
// `server.js` pour un test avait déclenché des connexions/jobs réels.
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');

jest.setTimeout(180000);

let replSet;
let dbName;
let mongoUri;
let seq = 0;

const SCRIPT = path.resolve(__dirname, '../scripts/bootstrapPlatformOperator.js');

function runScript(args, envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      env: {
        ...process.env,
        MONGO_URI: mongoUri,
        NODE_ENV: envOverrides.NODE_ENV ?? 'test',
        ALLOW_PLATFORM_OPERATOR_BOOTSTRAP_APPLY: envOverrides.ALLOW_PLATFORM_OPERATOR_BOOTSTRAP_APPLY,
      },
      cwd: path.resolve(__dirname, '..'),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

// `connectDB()` (config/db.js) écrit "MongoDB Connected: ..." sur stdout
// avant que le script n'émette son propre JSON — on extrait uniquement le
// bloc JSON final (toujours le dernier `{...}` du flux) plutôt que de
// supposer que stdout ne contient QUE le JSON.
function parseOutput(stdout) {
  const start = stdout.indexOf('{');
  return JSON.parse(stdout.slice(start));
}

async function makeUser(overrides = {}) {
  seq += 1;
  return User.create({
    name: `Bootstrap Test ${seq}`, email: `bootstrap-${seq}-${Date.now()}@example.test`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Admin', isEmailVerified: true,
    ...overrides,
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  dbName = `bootstrap_cert1_${Date.now()}`;
  mongoUri = replSet.getUri(dbName);
  await mongoose.connect(mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 15000 });
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), PlatformOperator.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Validation des arguments (avant toute connexion Mongo)', () => {
  test('aucun argument → refus explicite, aucune écriture', async () => {
    const res = await runScript([]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_EMAIL_REQUIRED/);
  });

  test('capacité inconnue → refus, jamais un mode "tout"', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Test', '--capabilities=platform.god_mode',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_INVALID_CAPABILITY/);
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });
});

describe('Dry-run — jamais d\'écriture', () => {
  test('dry-run réussi affiche la base résolue, ne crée rien', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Test dry-run', '--capabilities=platform.tenants.read',
    ]);
    expect(res.code).toBe(0);
    const output = parseOutput(res.stdout);
    expect(output.mode).toBe('dry-run');
    expect(output.database).toBe(dbName);
    expect(output.result).toMatch(/DRY-RUN/);
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });

  test('utilisateur cible introuvable → refus', async () => {
    const granter = await makeUser();
    const res = await runScript([
      '--email=inexistant@example.test', `--grantedBy=${granter.email}`, '--reason=Test', '--capabilities=platform.tenants.read',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_USER_NOT_FOUND/);
  });

  test('grantedBy introuvable ou non-Admin → refus', async () => {
    const target = await makeUser();
    const nonAdmin = await makeUser({ role: 'Client' });
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${nonAdmin.email}`, '--reason=Test', '--capabilities=platform.tenants.read',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_GRANTED_BY_NOT_FOUND/);
  });

  test('auto-octroi interdit — grantedBy identique à la cible', async () => {
    const target = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${target.email}`, '--reason=Test', '--capabilities=platform.tenants.read',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_SELF_GRANT_FORBIDDEN/);
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });
});

describe('Garde de confirmation de base — --apply sans --confirm-database', () => {
  test('--apply sans --confirm-database → refusé, aucune écriture, quel que soit NODE_ENV', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Test', '--capabilities=platform.tenants.read', '--apply',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_DATABASE_NOT_CONFIRMED/);
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });

  test('--apply avec --confirm-database incorrect → refusé', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Test', '--capabilities=platform.tenants.read',
      '--confirm-database=une_autre_base', '--apply',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_DATABASE_NOT_CONFIRMED/);
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });

  test('NODE_ENV=production sans ALLOW_PLATFORM_OPERATOR_BOOTSTRAP_APPLY → refusé avant même la connexion', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Test', '--capabilities=platform.tenants.read',
      `--confirm-database=${dbName}`, '--apply',
    ], { NODE_ENV: 'production' });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/PLATFORM_OPERATOR_BOOTSTRAP_PRODUCTION_GUARD/);
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });
});

describe('Application réelle sur base de test confirmée', () => {
  test('succès : PlatformOperator créé, actif, capacités exactes, grantedBy correct', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Bootstrap initial de test',
      '--capabilities=platform.tenants.read,platform.tenants.manage', `--confirm-database=${dbName}`, '--apply',
    ]);
    expect(res.code).toBe(0);
    const output = parseOutput(res.stdout);
    expect(output.mode).toBe('apply');
    expect(output.result.status).toBe('active');
    expect(output.result.capabilities.sort()).toEqual(['platform.tenants.manage', 'platform.tenants.read']);

    const doc = await PlatformOperator.findOne({ user: target._id });
    expect(doc.status).toBe('active');
    expect(String(doc.grantedBy)).toBe(String(granter._id));
    expect(doc.grantReason).toBe('Bootstrap initial de test');
  });

  test('idempotent : second appel sur un opérateur déjà actif → NOOP, aucun doublon', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const args = [
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Premier octroi',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply',
    ];
    const first = await runScript(args);
    expect(first.code).toBe(0);
    const second = await runScript(args);
    expect(second.code).toBe(0);
    const output = parseOutput(second.stdout);
    expect(output.result).toMatch(/NOOP/);
    expect(await PlatformOperator.countDocuments({ user: target._id })).toBe(1);
  });

  test('opérateur suspendu : --apply sans --reactivate → NOOP, reste suspendu', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Octroi initial',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply',
    ]);
    await PlatformOperator.updateOne({ user: target._id }, { status: 'suspended', suspendedBy: granter._id, suspendedAt: new Date(), suspensionReason: 'Test' });

    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Tentative sans reactivate',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply',
    ]);
    expect(res.code).toBe(0);
    const output = parseOutput(res.stdout);
    expect(output.result).toMatch(/NOOP/);
    expect((await PlatformOperator.findOne({ user: target._id })).status).toBe('suspended');
  });

  test('opérateur suspendu : --apply avec --reactivate → réactivé explicitement', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Octroi initial',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply',
    ]);
    await PlatformOperator.updateOne({ user: target._id }, { status: 'suspended', suspendedBy: granter._id, suspendedAt: new Date(), suspensionReason: 'Test' });

    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Réactivation explicite',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply', '--reactivate',
    ]);
    expect(res.code).toBe(0);
    expect((await PlatformOperator.findOne({ user: target._id })).status).toBe('active');
  });

  test('opérateur révoqué : --apply avec --reactivate crée un nouvel octroi explicite (jamais une résurrection silencieuse par simple bascule)', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Octroi initial',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply',
    ]);
    await PlatformOperator.updateOne({ user: target._id }, { status: 'revoked', revokedBy: granter._id, revokedAt: new Date(), revokeReason: 'Test révocation' });

    const res = await runScript([
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Nouvel octroi après révocation',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply', '--reactivate',
    ]);
    expect(res.code).toBe(0);
    const doc = await PlatformOperator.findOne({ user: target._id });
    expect(doc.status).toBe('active');
    expect(doc.grantReason).toBe('Nouvel octroi après révocation');
    expect(await PlatformOperator.countDocuments({ user: target._id })).toBe(1);
  });
});

describe('Concurrence — mission §19', () => {
  test('deux bootstraps simultanés pour le même utilisateur → au maximum 1 PlatformOperator', async () => {
    const target = await makeUser();
    const granter = await makeUser();
    const args = [
      `--email=${target.email}`, `--grantedBy=${granter.email}`, '--reason=Course concurrente',
      '--capabilities=platform.tenants.read', `--confirm-database=${dbName}`, '--apply',
    ];
    const [a, b] = await Promise.all([runScript(args), runScript(args)]);
    // Deux issues légitimes pour le perdant de la course : soit il a lu le
    // document déjà actif du gagnant (NOOP, exit 0), soit sa propre tentative
    // d'insertion a heurté la contrainte unique pendant que le gagnant
    // écrivait (E11000 → PLATFORM_OPERATOR_CONCURRENT_GRANT, exit 1) — jamais
    // un crash avec une erreur Mongo brute, et jamais deux documents créés.
    for (const result of [a, b]) {
      if (result.code !== 0) expect(result.stderr).toMatch(/octroi concurrent/);
    }
    expect(await PlatformOperator.countDocuments({ user: target._id })).toBe(1);
  });
});

describe('Absence de bootstrap implicite — mission §20', () => {
  test('un Admin existant en base, jamais invoqué explicitement, ne devient jamais PlatformOperator', async () => {
    await makeUser({ role: 'Admin' });
    await makeUser({ role: 'Admin' });
    await makeUser({ role: 'Client' });
    expect(await PlatformOperator.countDocuments()).toBe(0);
  });
});
