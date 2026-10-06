jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  connection: { name: 'altitudevision', host: 'cluster0.atigmso.mongodb.net' },
}));
jest.mock('../services/platformTenant/assetProjectionConsistencyApplyService', () => ({
  REASON: 'C2_8M_LEGACY_ORGANIZATION_ASSET_REGULARIZATION',
  regularizeAssetProjectionBatch: jest.fn(),
}));

const mongoose = require('mongoose');
const {
  regularizeAssetProjectionBatch,
} = require('../services/platformTenant/assetProjectionConsistencyApplyService');
const {
  C2_8M_BATCH,
  describeMongoTarget,
  main,
  parseAndValidateArgs,
} = require('../scripts/applyAssetProjectionConsistency');

const ACTOR_ID = '507f191e810c19729de860ea';
const OPERATION_ID = 'C2_8M_MILA_EVENTS_2026_10_04';
const ENV = { MONGO_URI: 'mongodb+srv://user:top-secret@cluster0.atigmso.mongodb.net/altitudevision?retryWrites=true' };
const validArgs = () => [
  '--confirm-database=altitudevision',
  `--confirm-target-tenant=${C2_8M_BATCH.targetTenantId}`,
  `--confirm-owner=${C2_8M_BATCH.expectedOwnerId}`,
  `--actor=${ACTOR_ID}`,
  `--operation=${OPERATION_ID}`,
  ...C2_8M_BATCH.propertyIds.map((id) => `--property=${id}`),
];

describe('C2.8M — CLI preview/apply spécialisé Mila Events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    regularizeAssetProjectionBatch.mockResolvedValue({ mode: 'preview', status: 'READY_TO_APPLY', items: [] });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => process.stdout.write.mockRestore());

  test('sans --apply, exécute uniquement le preview avec autoIndex/autoCreate désactivés', async () => {
    await main(validArgs(), ENV);

    expect(mongoose.connect).toHaveBeenCalledWith(ENV.MONGO_URI, expect.objectContaining({ autoIndex: false, autoCreate: false }));
    expect(regularizeAssetProjectionBatch).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'preview',
      targetTenantId: C2_8M_BATCH.targetTenantId,
      expectedOwnerId: C2_8M_BATCH.expectedOwnerId,
      propertyIds: C2_8M_BATCH.propertyIds,
      actorId: ACTOR_ID,
      operationId: OPERATION_ID,
    }));
  });

  test('la description pré-connexion expose seulement host et database', () => {
    const target = describeMongoTarget(ENV.MONGO_URI);
    expect(target).toEqual({ host: 'cluster0.atigmso.mongodb.net', database: 'altitudevision' });
    expect(JSON.stringify(target)).not.toContain('top-secret');
    expect(JSON.stringify(target)).not.toContain('user');
  });

  test.each([
    ['database incorrecte', (args) => args.map((arg) => arg.startsWith('--confirm-database=') ? '--confirm-database=wrong' : arg), 'DATABASE_CONFIRMATION_MISMATCH'],
    ['tenant incorrect', (args) => args.map((arg) => arg.startsWith('--confirm-target-tenant=') ? '--confirm-target-tenant=507f191e810c19729de860ff' : arg), 'TARGET_TENANT_CONFIRMATION_MISMATCH'],
    ['owner incorrect', (args) => args.map((arg) => arg.startsWith('--confirm-owner=') ? '--confirm-owner=507f191e810c19729de860ff' : arg), 'OWNER_CONFIRMATION_MISMATCH'],
    ['Property manquante', (args) => args.filter((arg) => arg !== `--property=${C2_8M_BATCH.propertyIds[1]}`), 'PROPERTY_ALLOWLIST_MISMATCH'],
    ['Property supplémentaire', (args) => [...args, '--property=507f191e810c19729de860ff'], 'PROPERTY_ALLOWLIST_MISMATCH'],
    ['Property dupliquée', (args) => [...args, `--property=${C2_8M_BATCH.propertyIds[0]}`], 'PROPERTY_ALLOWLIST_MISMATCH'],
    ['actor absent', (args) => args.filter((arg) => !arg.startsWith('--actor=')), 'ACTOR_REQUIRED'],
    ['operation absente', (args) => args.filter((arg) => !arg.startsWith('--operation=')), 'OPERATION_REQUIRED'],
  ])('%s est refusé avant connexion', async (_label, mutate, code) => {
    await expect(main(mutate(validArgs()), ENV)).rejects.toMatchObject({ code });
    expect(mongoose.connect).not.toHaveBeenCalled();
    expect(regularizeAssetProjectionBatch).not.toHaveBeenCalled();
  });

  test('apply sans confirmation production est refusé avant connexion', async () => {
    await expect(main([...validArgs(), '--apply'], { ...ENV, ALLOW_C2_8M_ASSET_REGULARIZATION_APPLY: 'true' }))
      .rejects.toMatchObject({ code: 'PRODUCTION_CONFIRMATION_REQUIRED' });
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test('apply sans garde environnement est refusé avant connexion', async () => {
    await expect(main([...validArgs(), '--apply', '--confirm-production'], ENV))
      .rejects.toMatchObject({ code: 'PRODUCTION_ENV_GUARD_REQUIRED' });
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test('apply n’atteint le service en mode écriture qu’après toutes les confirmations exactes', async () => {
    regularizeAssetProjectionBatch.mockResolvedValue({ mode: 'apply', status: 'APPLIED', migratedCount: 2 });

    await main(
      [...validArgs(), '--apply', '--confirm-production'],
      { ...ENV, ALLOW_C2_8M_ASSET_REGULARIZATION_APPLY: 'true' },
    );

    expect(regularizeAssetProjectionBatch).toHaveBeenCalledWith(expect.objectContaining({ mode: 'apply' }));
  });

  test('la base réellement résolue est revérifiée après connexion avant le service', async () => {
    mongoose.connection.name = 'unexpected';
    await expect(main(validArgs(), ENV)).rejects.toMatchObject({ code: 'CONNECTED_DATABASE_MISMATCH' });
    expect(regularizeAssetProjectionBatch).not.toHaveBeenCalled();
    mongoose.connection.name = 'altitudevision';
  });

  test('parseAndValidateArgs refuse les options inconnues avant connexion', () => {
    expect(() => parseAndValidateArgs([...validArgs(), '--force'], ENV))
      .toThrow(expect.objectContaining({ code: 'UNKNOWN_OPTION' }));
  });
});
