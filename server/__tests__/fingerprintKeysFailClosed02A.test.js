// GIT-INTEGRATION-02A — clés d'empreinte financière et d'identité : échec fermé.
// Valeurs de clé synthétiques, propres à ce test (jamais une clé réelle).

jest.mock('../models/FinancialBeneficiary', () => ({ create: jest.fn(async (doc) => ({ _id: 'b1', ...doc })) }));
jest.mock('../services/finance/contractual/contractualFinanceAuthorizationService', () => ({
  CONTRACTUAL_CAPABILITIES: { BENEFICIARY_REGISTER: 'contractual.beneficiary.register' },
  assertContractualCapability: jest.fn(async () => ({ plane: 'PLATFORM', userId: 'u1', tenantId: null })),
}));

const FinancialBeneficiary = require('../models/FinancialBeneficiary');
const beneficiaries = require('../services/finance/contractual/financialBeneficiaryService');
const { computeIdentityFingerprint } = require('../services/finance/contractual/humanIdentityService');

const KEYS = ['FINANCIAL_BENEFICIARY_FINGERPRINT_KEY', 'HUMAN_IDENTITY_FINGERPRINT_KEY', 'HUMAN_IDENTITY_FINGERPRINT_KEY_VERSION'];
const saved = Object.fromEntries(KEYS.map((name) => [name, process.env[name]]));
const SYNTHETIC_A = 'synthetic-02a-key-A-0123456789abcdef';
const SYNTHETIC_B = 'synthetic-02a-key-B-0123456789abcdef';
const OWNER = '64b000000000000000000001';
const register = () => beneficiaries.registerBeneficiary({ actor: { _id: 'u1' }, ownerId: OWNER, kind: 'MOBILE_MONEY', holderName: 'Titulaire fictif', institution: 'Opérateur fictif', accountIdentifier: '06 123 45 67' });

beforeEach(() => { KEYS.forEach((name) => delete process.env[name]); jest.clearAllMocks(); });
afterAll(() => { KEYS.forEach((name) => { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }); });

describe('FINANCIAL_BENEFICIARY_FINGERPRINT_KEY', () => {
  test.each([['absente', undefined], ['vide', ''], ['trop courte (31 caractères)', 'x'.repeat(31)]])('clé %s → refus BENEFICIARY_FINGERPRINT_KEY_MISSING, aucune écriture', async (_label, value) => {
    if (value !== undefined) process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = value;
    const error = await register().catch((e) => e);
    expect(error).toMatchObject({ code: 'BENEFICIARY_FINGERPRINT_KEY_MISSING', statusCode: 500 });
    expect(FinancialBeneficiary.create).not.toHaveBeenCalled();
  });

  test('clé valide → empreinte HMAC-SHA256 (64 hex), identifiant jamais stocké en clair ; dépend de la clé', async () => {
    process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = SYNTHETIC_A;
    await register();
    const first = FinancialBeneficiary.create.mock.calls[0][0];
    expect(first.accountFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.maskedIdentifier).toBe('•••4567');
    expect(JSON.stringify(first)).not.toContain('061234567');
    process.env.FINANCIAL_BENEFICIARY_FINGERPRINT_KEY = SYNTHETIC_B;
    await register();
    expect(FinancialBeneficiary.create.mock.calls[1][0].accountFingerprint).not.toBe(first.accountFingerprint);
  });
});

describe('HUMAN_IDENTITY_FINGERPRINT_KEY', () => {
  const piece = { documentKind: 'NATIONAL_ID', documentNumber: 'AB 123 456' };

  test.each([['absente', undefined], ['trop courte', 'y'.repeat(31)]])('clé %s → refus IDENTITY_FINGERPRINT_KEY_MISSING, message sans secret', (_label, value) => {
    if (value !== undefined) process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = value;
    let error;
    try { computeIdentityFingerprint(piece); } catch (e) { error = e; }
    expect(error).toMatchObject({ code: 'IDENTITY_FINGERPRINT_KEY_MISSING', statusCode: 500 });
    if (value) expect(error.message).not.toContain(value);
  });

  test('clé valide → empreinte versionnée (v1 par défaut), numéro de pièce non restitué', () => {
    process.env.HUMAN_IDENTITY_FINGERPRINT_KEY = SYNTHETIC_A;
    const result = computeIdentityFingerprint(piece);
    expect(result).toMatchObject({ keyVersion: 'v1', hint: '456' });
    expect(result.identityKey).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result)).not.toContain('AB123456');
    process.env.HUMAN_IDENTITY_FINGERPRINT_KEY_VERSION = 'v2';
    expect(computeIdentityFingerprint(piece).keyVersion).toBe('v2');
  });
});

test('démarrage sans aucune des deux clés : les modules finance, facturation et loyers se chargent (pas de panne générale)', () => {
  jest.isolateModules(() => {
    expect(() => {
      require('../routes/contractualFinanceRoutes');
      require('../routes/billingRoutes');
      require('../services/alerteService');
      require('../services/scheduledJobs/jobRegistry');
    }).not.toThrow();
  });
});
