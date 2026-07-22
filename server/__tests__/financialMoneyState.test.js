const money = require('../services/finance/moneyService');
const state = require('../services/finance/financialStateService');

describe('Financial Core — monnaie', () => {
  test.each([0, 1, 25000, Number.MAX_SAFE_INTEGER])('accepte un entier sûr %p', (value) => expect(money.assertAmountMinor(value)).toBe(value));
  test.each([1.2, NaN, Infinity, '100', Number.MAX_SAFE_INTEGER + 1, -1])('rejette un montant invalide %p', (value) => expect(() => money.assertAmountMinor(value)).toThrow(expect.objectContaining({ code: 'FINANCIAL_INVALID_AMOUNT' })));
  test('additionne, soustrait et multiplie sans flottant', () => {
    expect(money.addMinor(10, 20, -5)).toBe(25);
    expect(money.subtractMinor(100, 30, 20)).toBe(50);
    expect(money.multiplyMinor(1250, 4)).toBe(5000);
  });
  test('calcule les points de base avec arrondi déterministe', () => {
    expect(money.percentageOfMinor(10000, 1800)).toBe(1800);
    expect(money.percentageOfMinor(1, 5000)).toBe(1);
  });
  test('alloue proportionnellement en conservant strictement le total', () => {
    const result = money.allocateProportionally(100, [1, 1, 1]);
    expect(result).toEqual([34, 33, 33]);
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(100);
  });
  test('rejette les devises incompatibles et inconnues', () => {
    expect(() => money.assertSameCurrency({ currency: 'XAF' }, { currency: 'EUR' })).toThrow(expect.objectContaining({ code: 'FINANCIAL_CURRENCY_MISMATCH' }));
    expect(() => money.assertCurrency('BTC')).toThrow();
  });
});

describe('Financial Core — machines d’état', () => {
  test.each([['draft', 'issued'], ['draft', 'cancelled'], ['issued', 'credited'], ['issued', 'void']])('autorise document %s → %s', (from, to) => expect(state.assertFinancialDocumentTransition(from, to)).toBe(true));
  test.each([['issued', 'draft'], ['cancelled', 'issued'], ['issued', 'paid']])('interdit document %s → %s', (from, to) => expect(() => state.assertFinancialDocumentTransition(from, to)).toThrow(expect.objectContaining({ code: 'FINANCIAL_INVALID_TRANSITION' })));
  test.each([['pending', 'processing'], ['processing', 'succeeded'], ['succeeded', 'partially_refunded'], ['partially_refunded', 'refunded']])('autorise paiement %s → %s', (from, to) => expect(state.assertFinancialPaymentTransition(from, to)).toBe(true));
  test.each([['succeeded', 'processing'], ['refunded', 'succeeded'], ['failed', 'pending']])('interdit paiement %s → %s', (from, to) => expect(() => state.assertFinancialPaymentTransition(from, to)).toThrow());
});
