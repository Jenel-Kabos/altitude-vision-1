// F-U1 — tests purs (sans base) : clauses de mandat, commission, frais,
// périodes de reversement, classification des remboursements, dérivation des
// capacités contractuelles.
const mongoose = require('mongoose');
const C = require('../constants/contractualFinanceConstants');
const terms = require('../services/finance/contractual/mandateTermsService');
const { classifyRefund } = require('../services/finance/contractual/refundGovernanceService');
const { tenantContractualCapabilities, platformContractualCapabilities, SENSITIVE_CAPABILITIES, CONTRACTUAL_CAPABILITIES: CAP } = require('../services/finance/contractual/contractualFinanceAuthorizationService');

const id = () => new mongoose.Types.ObjectId();
// Valeurs de frais fictives, propres aux tests : aucun tarif prestataire réel.
const delegated = (overrides = {}) => ({
  offer: 'DELEGATED_MANAGEMENT', currency: 'XAF', effectiveFrom: '2026-01-01T00:00:00Z', legalReference: 'MANDAT-TEST-1',
  commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT' },
  collectionMode: 'AGENCY_COLLECTION', payoutFrequency: 'MONTHLY', payoutBeneficiary: id(),
  feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'mobile_money', bearer: 'SPLIT', split: [{ party: 'OWNER', basisPoints: 5000 }, { party: 'ALTITUDE_VISION', basisPoints: 5000 }], pricing: { fixedMinor: 100, basisPoints: 100, tariffSourceReference: 'FIXTURE-TEST' } }],
  expenseCaps: { perInterventionMinor: 60000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' },
  ...overrides,
});

describe('F-U1.B — clauses de mandat', () => {
  test('mandat délégué complet : normalisé, figé, haché de façon stable', () => {
    const a = terms.normalizeMandateTerms(delegated());
    const b = terms.normalizeMandateTerms({ ...delegated(), payoutBeneficiary: a.payoutBeneficiary });
    expect(Object.isFrozen(a)).toBe(true);
    expect(a.commission).toEqual({ basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT', expensesReduceBase: false });
    expect(terms.hashTerms(a)).toBe(terms.hashTerms(b));
  });

  test.each([
    ['périodicité absente en encaissement agence', { payoutFrequency: undefined }],
    ['commission différente de 10 %', { commission: { basisPoints: 1200, base: 'CONFIRMED_COLLECTED_RENT' } }],
    ['réduction d’assiette par les dépenses', { commission: { basisPoints: 1000, base: 'CONFIRMED_COLLECTED_RENT', expensesReduceBase: true } }],
    ['plafonds absents', { expenseCaps: undefined }],
    ['plafond intervention > mensuel', { expenseCaps: { perInterventionMinor: 200000, monthlyCumulativeMinor: 100000, period: 'CALENDAR_MONTH' } }],
    ['plafond en virgule flottante', { expenseCaps: { perInterventionMinor: 100.5, monthlyCumulativeMinor: 1000, period: 'CALENDAR_MONTH' } }],
    ['tarif sans source', { feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'OWNER', pricing: { fixedMinor: 0, basisPoints: 0 } }] }],
    ['répartition ≠ 100 %', { feeRules: [{ feeKind: 'COLLECTION', paymentMethod: 'cash', bearer: 'SPLIT', split: [{ party: 'OWNER', basisPoints: 5000 }, { party: 'TENANT_PAYER', basisPoints: 4000 }], pricing: { fixedMinor: 0, basisPoints: 0, tariffSourceReference: 'X' } }] }],
    ['mode d’encaissement absent', { collectionMode: undefined }],
    ['périodicité en paiement direct', { collectionMode: 'OWNER_DIRECT', ownerDirectAccount: id(), payoutBeneficiary: undefined }],
  ])('refus fermé : %s', (_label, overrides) => {
    expect(() => terms.normalizeMandateTerms(delegated(overrides))).toThrow(expect.objectContaining({ code: 'MANDATE_TERMS_INVALID' }));
  });

  test('OWNER_DIRECT : compte propriétaire vérifiable requis, pas de périodicité', () => {
    const normalized = terms.normalizeMandateTerms(delegated({ collectionMode: 'OWNER_DIRECT', payoutFrequency: undefined, payoutBeneficiary: undefined, ownerDirectAccount: id() }));
    expect(normalized.payoutFrequency).toBeNull();
    expect(normalized.ownerDirectAccount).toBeTruthy();
  });

  test('gestion autonome : aucune clause de commission/dépense permise', () => {
    const autonomous = { offer: 'AUTONOMOUS_SUBSCRIPTION', currency: 'XAF', effectiveFrom: '2026-01-01', legalReference: 'ABO-1', subscriptionReference: { type: 'IndividualSubscription', id: id() } };
    expect(terms.normalizeMandateTerms(autonomous).commission).toBeNull();
    expect(() => terms.normalizeMandateTerms({ ...autonomous, commission: { basisPoints: 1000 } })).toThrow(expect.objectContaining({ code: 'MANDATE_TERMS_INVALID' }));
  });

  test('la suggestion de rédaction (mensuelle) n’est jamais une valeur par défaut', () => {
    expect(C.SUGGESTED_DRAFT_PAYOUT_FREQUENCY).toBe('MONTHLY');
    expect(() => terms.normalizeMandateTerms(delegated({ payoutFrequency: null }))).toThrow(expect.objectContaining({ code: 'MANDATE_TERMS_INVALID' }));
  });
});

describe('F-U1 — commission et frais', () => {
  const normalized = terms.normalizeMandateTerms(delegated());
  test('commission = 10 % entier du loyer confirmé', () => {
    expect(terms.computeManagementCommission({ terms: normalized, confirmedRentMinor: 150000 }).commissionMinor).toBe(15000);
    expect(terms.computeManagementCommission({ terms: normalized, confirmedRentMinor: 125005 }).commissionMinor).toBe(12501);
    expect(() => terms.computeManagementCommission({ terms: normalized, confirmedRentMinor: 10.5 })).toThrow(expect.objectContaining({ code: 'FINANCIAL_INVALID_AMOUNT' }));
  });
  test('gestion autonome : aucune commission déléguée', () => {
    const result = terms.computeManagementCommission({ terms: { offer: 'AUTONOMOUS_SUBSCRIPTION' }, confirmedRentMinor: 150000 });
    expect(result).toMatchObject({ applicable: false, commissionMinor: 0 });
  });
  test('frais répartis selon le snapshot, base et règle figées', () => {
    const fees = terms.determineTransactionFees({ terms: normalized, feeKind: 'COLLECTION', paymentMethod: 'mobile_money', provider: 'mtn_direct', amountMinor: 150000 });
    expect(fees.totalMinor).toBe(1600);
    expect(fees.byParty).toEqual({ TENANT_PAYER: 0, OWNER: 800, ALTITUDE_VISION: 800 });
    expect(fees.rule.pricing.tariffSourceReference).toBe('FIXTURE-TEST');
  });
  test('aucune règle → FEE_RULE_NOT_CONFIGURED (jamais un tarif supposé)', () => {
    expect(() => terms.determineTransactionFees({ terms: normalized, feeKind: 'PAYOUT', paymentMethod: 'mobile_money', amountMinor: 1000 }))
      .toThrow(expect.objectContaining({ code: 'FEE_RULE_NOT_CONFIGURED' }));
  });
});

describe('F-U1 — périodes de reversement (fuseau WAT)', () => {
  test('mensuel / bimensuel / hebdomadaire / par encaissement', () => {
    // 31/01 23:30 UTC = 01/02 00:30 à Brazzaville.
    expect(terms.computePayoutPeriod({ frequency: 'MONTHLY', at: '2026-01-31T23:30:00Z' }).periodKey).toBe('month:2026-02');
    expect(terms.computePayoutPeriod({ frequency: 'SEMI_MONTHLY', at: '2026-03-15T22:59:00Z' }).periodKey).toBe('semimonth:2026-03-H1');
    expect(terms.computePayoutPeriod({ frequency: 'SEMI_MONTHLY', at: '2026-03-15T23:00:00Z' }).periodKey).toBe('semimonth:2026-03-H2');
    const week = terms.computePayoutPeriod({ frequency: 'WEEKLY', at: '2026-10-11T12:00:00Z' });
    expect(week.periodKey).toBe('week:2026-W41');
    expect(week.start.toISOString()).toBe('2026-10-04T23:00:00.000Z');
    expect(terms.computePayoutPeriod({ frequency: 'PER_CONFIRMED_COLLECTION', at: new Date(), sourceId: 'abc' }).periodKey).toBe('collection:abc');
    expect(() => terms.computePayoutPeriod({ frequency: undefined, at: new Date() })).toThrow(expect.objectContaining({ code: 'PAYOUT_FREQUENCY_NOT_CONFIGURED' }));
  });
});

describe('F-U1.E — classification des remboursements', () => {
  const active = { status: 'active', standardApprovalMaxMinor: 50000, additionalDualApprovalSignals: [] };
  test('sous seuil, faible risque → validation simple', () => {
    expect(classifyRefund({ policySnapshot: active, amountMinor: 30000, beneficiarySameAsPayer: true })).toMatchObject({ classification: 'STANDARD', requiredApprovals: 1 });
  });
  test('au-dessus du seuil → double validation', () => {
    expect(classifyRefund({ policySnapshot: active, amountMinor: 50001, beneficiarySameAsPayer: true })).toMatchObject({ classification: 'DUAL_APPROVAL', requiredApprovals: 2 });
  });
  test.each(['HIGH_RISK', 'CROSS_BORDER'])('signal %s → double validation quel que soit le montant', (signal) => {
    expect(classifyRefund({ policySnapshot: active, amountMinor: 1, beneficiarySameAsPayer: true, declaredSignals: [signal] }).requiredApprovals).toBe(2);
  });
  test('bénéficiaire différent du payeur → double validation', () => {
    expect(classifyRefund({ policySnapshot: active, amountMinor: 1, beneficiarySameAsPayer: false }).signals).toContain('BENEFICIARY_DIFFERS_FROM_PAYER');
  });
  test('politique non configurée (aucun seuil validé) → double validation', () => {
    expect(classifyRefund({ policySnapshot: { status: 'unconfigured', standardApprovalMaxMinor: null }, amountMinor: 1, beneficiarySameAsPayer: true })).toMatchObject({ classification: 'DUAL_APPROVAL', signals: ['POLICY_UNCONFIGURED'] });
  });
  test('suspicion de fraude → blocage', () => {
    expect(classifyRefund({ policySnapshot: active, amountMinor: 1, beneficiarySameAsPayer: true, declaredSignals: ['FRAUD_SUSPECTED'] }).classification).toBe('BLOCKED');
  });
});

describe('F-U1.G — matrice des capacités dérivées', () => {
  test('Admin tenant : capacités courantes uniquement, aucune capacité sensible', () => {
    const admin = tenantContractualCapabilities('Admin');
    expect(admin).toEqual(expect.arrayContaining([CAP.CONTRACT_READ, CAP.MANDATE_MANAGE, CAP.EXPENSE_REQUEST, CAP.COLLECTION_RECORD, CAP.REFUND_PREPARE]));
    SENSITIVE_CAPABILITIES.forEach((cap) => expect(admin).not.toContain(cap));
  });
  test('Gestionnaire : dépenses + lecture ; Secrétaire : encaissement + préparation de remboursement + lecture', () => {
    expect(tenantContractualCapabilities('GestionnaireImmobilier').sort()).toEqual([CAP.CONTRACT_READ, CAP.EXPENSE_JUSTIFY, CAP.EXPENSE_REQUEST].sort());
    expect(tenantContractualCapabilities('Secretaire').sort()).toEqual([CAP.BENEFICIARY_REGISTER, CAP.BILLING_MANAGE, CAP.COLLECTION_RECORD, CAP.CONTRACT_READ, CAP.REFUND_PREPARE].sort());
    expect(tenantContractualCapabilities('Secretaire')).not.toContain(CAP.BILLING_ISSUE);
    expect(tenantContractualCapabilities('Admin')).toContain(CAP.BILLING_ISSUE);
    expect(tenantContractualCapabilities('CommunityManager')).toEqual([]);
    expect(tenantContractualCapabilities('Collaborateur')).toEqual([]);
    expect(tenantContractualCapabilities('Client')).toEqual([]);
  });
  test('opérateur : finance.read → lecture ; finance.manage → sans aucune capacité sensible ; inactif → rien', () => {
    expect(platformContractualCapabilities({ status: 'active', capabilities: ['platform.finance.read'] })).toEqual([CAP.CONTRACT_READ]);
    const manage = platformContractualCapabilities({ status: 'active', capabilities: ['platform.finance.manage'] });
    SENSITIVE_CAPABILITIES.forEach((cap) => expect(manage).not.toContain(cap));
    expect(manage).not.toContain(CAP.EXPENSE_REQUEST);
    expect(platformContractualCapabilities({ status: 'suspended', capabilities: ['platform.finance.manage'] })).toEqual([]);
    expect(platformContractualCapabilities({ status: 'active', capabilities: ['platform.users.manage'] })).toEqual([]);
  });
});

describe('F-U1.I — capacités KYC', () => {
  const { isEligible, PLATFORM_ELIGIBILITY } = require('../services/finance/contractual/contractualFinanceAuthorizationService');
  test('kyc.attest : jamais octroyable à une organisation ; base opérateur platform.users.manage', () => {
    ['Admin', 'Secretaire', 'GestionnaireImmobilier'].forEach((businessRole) => expect(isEligible({ capability: CAP.KYC_ATTEST, scopeType: 'TENANT', membership: { businessRole } })).toBe(false));
    expect(PLATFORM_ELIGIBILITY[CAP.KYC_ATTEST]).toBe('platform.users.manage');
    expect(isEligible({ capability: CAP.KYC_ATTEST, scopeType: 'PLATFORM', operator: { status: 'active', capabilities: ['platform.finance.manage', 'platform.operators.manage'] } })).toBe(false);
  });
  test('kyc.prepare : organisation uniquement (Admin, Secretaire), jamais plateforme', () => {
    expect(isEligible({ capability: CAP.KYC_PREPARE, scopeType: 'TENANT', membership: { businessRole: 'Secretaire' } })).toBe(true);
    expect(isEligible({ capability: CAP.KYC_PREPARE, scopeType: 'TENANT', membership: { businessRole: 'GestionnaireImmobilier' } })).toBe(false);
    expect(isEligible({ capability: CAP.KYC_PREPARE, scopeType: 'PLATFORM', operator: { status: 'active', capabilities: ['platform.users.manage', 'platform.finance.manage'] } })).toBe(false);
  });
});
