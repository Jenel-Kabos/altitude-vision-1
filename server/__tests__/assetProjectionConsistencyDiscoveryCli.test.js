// C2.8M — garanties CLI du dry-run : aucun drapeau de mutation n'atteint la
// connexion, et la connexion n'autorise aucune écriture implicite Mongoose
// (création d'index ou de collection au démarrage des modèles).
jest.mock('../config/db', () => jest.fn());
jest.mock('../services/platformTenant/assetProjectionConsistencyDiscoveryService', () => ({
  discoverAssetProjectionConsistency: jest.fn(),
}));

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { discoverAssetProjectionConsistency } = require('../services/platformTenant/assetProjectionConsistencyDiscoveryService');
const { main } = require('../scripts/discoverAssetProjectionConsistency');

const VALID = ['--owner-id=owner-a', '--target-tenant-id=tenant-a', '--confirm-database=expected-db'];

describe('C2.8M — CLI read-only du dry-run patrimonial', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(['--apply', '--write', '--force', '--backfill', '--migrate', '--repair', '--commit', '--execute', '--live', '--fix', '--update', '--delete', '--mutate', '--apply=true'])(
    '%s est refusé avant toute connexion',
    async (flag) => {
      await expect(main([...VALID, flag])).rejects.toMatchObject({ exitCode: 2 });
      expect(connectDB).not.toHaveBeenCalled();
      expect(discoverAssetProjectionConsistency).not.toHaveBeenCalled();
    },
  );

  test('sans confirmation explicite de la base, aucune connexion', async () => {
    await expect(main(['--owner-id=owner-a', '--target-tenant-id=tenant-a'])).rejects.toThrow('ASSET_PROJECTION_DISCOVERY_DATABASE_NOT_CONFIRMED');
    expect(connectDB).not.toHaveBeenCalled();
  });

  test('la connexion est ouverte avec autoIndex et autoCreate désactivés, et une base inattendue arrête tout avant lecture', async () => {
    let optionsAtConnect = null;
    connectDB.mockImplementation(async () => {
      optionsAtConnect = { autoIndex: mongoose.get('autoIndex'), autoCreate: mongoose.get('autoCreate') };
    });
    await expect(main(VALID)).rejects.toThrow('ASSET_PROJECTION_DISCOVERY_DATABASE_MISMATCH');
    expect(optionsAtConnect).toEqual({ autoIndex: false, autoCreate: false });
    expect(discoverAssetProjectionConsistency).not.toHaveBeenCalled();
  });
});
