// PAY-3 — tests du registre de providers (architecture provider-agnostic).
// Aucun appel externe : tout est pur, en mémoire.
const {
  getProvider, listProviders, supportsRefund, normalizeStatus,
  assertFallbackAllowed, PAYMENT_PROVIDERS,
} = require('../services/finance/paymentProviderRegistry');
const { FINANCIAL_PAYMENT_STATUSES, FINANCIAL_PAYMENT_METHODS } = require('../constants/financialConstants');
const FinancialPayment = require('../models/FinancialPayment');

describe('paymentProviderRegistry — method/provider separation (PAY-3 §2)', () => {
  test('chaque provider déclare des methods qui existent réellement dans FINANCIAL_PAYMENT_METHODS', () => {
    for (const entry of listProviders()) {
      for (const method of entry.methods) {
        expect(FINANCIAL_PAYMENT_METHODS).toContain(method);
      }
    }
  });

  test('mobile_money est servi par plusieurs providers distincts (mtn_direct, airtel_direct, yabetoo) — la séparation method/provider est réelle', () => {
    const mobileMoneyProviders = listProviders().filter((p) => p.methods.includes('mobile_money')).map((p) => p.provider);
    expect(mobileMoneyProviders.sort()).toEqual(['airtel_direct', 'mtn_direct', 'yabetoo'].sort());
  });

  test('provider inconnu → FINANCIAL_PROVIDER_UNKNOWN', () => {
    expect(() => getProvider('inexistant')).toThrow(expect.objectContaining({ code: 'FINANCIAL_PROVIDER_UNKNOWN' }));
  });
});

describe('paymentProviderRegistry — providers automatiques non implémentés (PAY-3 §9/§10/§12 ; mtn_direct réellement implémenté depuis PAY-4, voir paymentProviderMtnDirect.test.js)', () => {
  test.each([PAYMENT_PROVIDERS.AIRTEL_DIRECT, PAYMENT_PROVIDERS.CARD_PSP, PAYMENT_PROVIDERS.YABETOO])(
    '%s : initiatePayment/getStatus/verifyCallback lèvent FINANCIAL_PROVIDER_NOT_IMPLEMENTED, jamais un appel réel',
    (providerKey) => {
      const provider = getProvider(providerKey);
      expect(() => provider.initiatePayment()).toThrow(expect.objectContaining({ code: 'FINANCIAL_PROVIDER_NOT_IMPLEMENTED' }));
      expect(() => provider.getStatus()).toThrow(expect.objectContaining({ code: 'FINANCIAL_PROVIDER_NOT_IMPLEMENTED' }));
      expect(() => provider.verifyCallback()).toThrow(expect.objectContaining({ code: 'FINANCIAL_PROVIDER_NOT_IMPLEMENTED' }));
    },
  );

  test('le provider manuel n’a pas de initiatePayment — il n’émule pas artificiellement le contrat des providers automatiques (mandat §14)', () => {
    const manual = getProvider(PAYMENT_PROVIDERS.MANUAL);
    expect(manual.initiatePayment).toBeUndefined();
    expect(manual.capabilities.initiate).toBe(false);
  });

  test('seul card_psp déclare supportsRefund — aucun provider n’implémente refundPayment sans le déclarer', () => {
    expect(supportsRefund(PAYMENT_PROVIDERS.CARD_PSP)).toBe(true);
    expect(supportsRefund(PAYMENT_PROVIDERS.MTN_DIRECT)).toBe(false);
    expect(supportsRefund(PAYMENT_PROVIDERS.MANUAL)).toBe(false);
  });
});

describe('paymentProviderRegistry — normalisation de statut (PAY-3 §16)', () => {
  test('chaque statut normalisé appartient bien à FINANCIAL_PAYMENT_STATUSES (jamais un nouvel enum créé)', () => {
    expect(normalizeStatus('mtn_direct', 'SUCCESSFUL')).toBe('succeeded');
    expect(normalizeStatus('airtel_direct', 'success')).toBe('succeeded');
    expect(normalizeStatus('yabetoo', 'pending')).toBe('pending');
    expect(normalizeStatus('card_psp', 'authorized')).toBe('processing');
    expect(FINANCIAL_PAYMENT_STATUSES).toContain(normalizeStatus('mtn_direct', 'FAILED'));
  });

  test('statut distant non reconnu → FINANCIAL_PROVIDER_STATUS_UNKNOWN, jamais une supposition silencieuse', () => {
    expect(() => normalizeStatus('mtn_direct', 'un_statut_qui_nexiste_pas')).toThrow(
      expect.objectContaining({ code: 'FINANCIAL_PROVIDER_STATUS_UNKNOWN' }),
    );
  });
});

describe('paymentProviderRegistry — interdiction de fallback automatique sur pending/unknown (PAY-3 §17)', () => {
  test.each(['pending', 'processing'])('bascule interdite depuis "%s" (risque de double débit)', (status) => {
    expect(() => assertFallbackAllowed(status)).toThrow(expect.objectContaining({ code: 'FINANCIAL_FALLBACK_NOT_ALLOWED' }));
  });

  test.each(['failed', 'cancelled'])('bascule autorisée uniquement depuis un état terminal non réussi ("%s")', (status) => {
    expect(() => assertFallbackAllowed(status)).not.toThrow();
  });

  test('bascule interdite depuis un état réussi (jamais re-router un paiement déjà confirmé)', () => {
    expect(() => assertFallbackAllowed('succeeded')).toThrow(expect.objectContaining({ code: 'FINANCIAL_FALLBACK_NOT_ALLOWED' }));
  });
});

describe('paymentProviderRegistry — doublon de paiement provider déjà empêché par le Financial Core existant (PAY-3 §28)', () => {
  test('FinancialPayment porte déjà un index unique {provider, providerPaymentId} — aucun second mécanisme d’idempotence créé par PAY-3', () => {
    const indexes = FinancialPayment.schema.indexes();
    const providerPaymentIdIndex = indexes.find(([fields]) => fields.provider === 1 && fields.providerPaymentId === 1);
    expect(providerPaymentIdIndex).toBeDefined();
    expect(providerPaymentIdIndex[1].unique).toBe(true);
  });
});
