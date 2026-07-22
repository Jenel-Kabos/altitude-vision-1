const { FINANCIAL_CURRENCIES } = require('../../constants/financialConstants');
const { fail } = require('./financialError');

function assertCurrency(currency) {
  if (typeof currency !== 'string' || !FINANCIAL_CURRENCIES.includes(currency)) {
    fail('FINANCIAL_CURRENCY_MISMATCH', 'Devise financière non supportée.');
  }
  return currency;
}

function assertAmountMinor(value, { allowNegative = false } = {}) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    fail('FINANCIAL_INVALID_AMOUNT', 'Le montant doit être un entier dans la plage sûre JavaScript.');
  }
  return value;
}

function assertSameCurrency(...money) {
  const currencies = money.map((item) => assertCurrency(item.currency));
  if (new Set(currencies).size > 1) fail('FINANCIAL_CURRENCY_MISMATCH', 'Les devises doivent être identiques.');
  return currencies[0];
}

function checked(value) {
  return assertAmountMinor(value, { allowNegative: true });
}

const addMinor = (...amounts) => checked(amounts.reduce((sum, amount) => checked(sum + assertAmountMinor(amount, { allowNegative: true })), 0));
const subtractMinor = (base, ...amounts) => addMinor(assertAmountMinor(base, { allowNegative: true }), ...amounts.map((v) => -assertAmountMinor(v, { allowNegative: true })));

function multiplyMinor(amountMinor, quantity) {
  assertAmountMinor(amountMinor, { allowNegative: true });
  if (!Number.isSafeInteger(quantity) || quantity < 0) fail('FINANCIAL_INVALID_AMOUNT', 'La quantité doit être un entier positif.');
  return checked(amountMinor * quantity);
}

// Arrondi commercial déterministe : moitié vers +∞ pour les valeurs positives.
function percentageOfMinor(amountMinor, basisPoints) {
  assertAmountMinor(amountMinor, { allowNegative: true });
  if (!Number.isSafeInteger(basisPoints)) fail('FINANCIAL_INVALID_AMOUNT', 'Les points de base doivent être entiers.');
  const numerator = checked(amountMinor * basisPoints);
  return checked(numerator >= 0 ? Math.floor((numerator + 5000) / 10000) : Math.ceil((numerator - 5000) / 10000));
}

function allocateProportionally(totalMinor, weights) {
  assertAmountMinor(totalMinor);
  if (!Array.isArray(weights) || weights.length === 0 || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    fail('FINANCIAL_INVALID_AMOUNT', 'Les poids doivent être des entiers positifs.');
  }
  const totalWeight = weights.reduce((sum, weight) => checked(sum + weight), 0);
  if (totalWeight <= 0) fail('FINANCIAL_INVALID_AMOUNT', 'La somme des poids doit être positive.');
  const raw = weights.map((weight, index) => ({ index, base: Math.floor((totalMinor * weight) / totalWeight), remainder: (totalMinor * weight) % totalWeight }));
  let remaining = totalMinor - raw.reduce((sum, item) => sum + item.base, 0);
  raw.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remaining; i += 1) raw[i].base += 1;
  return raw.sort((a, b) => a.index - b.index).map((item) => item.base);
}

function formatMoney(amountMinor, currency, locale = 'fr-FR') {
  assertAmountMinor(amountMinor, { allowNegative: true });
  assertCurrency(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / (currency === 'XAF' ? 1 : 100));
}

module.exports = { assertCurrency, assertAmountMinor, assertSameCurrency, addMinor, subtractMinor, multiplyMinor, percentageOfMinor, allocateProportionally, formatMoney };
