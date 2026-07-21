// __tests__/ratePlanModel.test.js — Sprint B2, schéma réel (non mocké).
// Vérifie l'invariant additif "exactement une cible" introduit pour
// permettre à RatePlan de référencer soit un Accommodation (Sprint B1,
// inchangé), soit une RoomCategory (Sprint B2) — jamais les deux, jamais
// aucune.

const RatePlan = require('../models/RatePlan');

const ACCOMMODATION_ID = '607f191e810c19729de860eb';
const ROOM_CATEGORY_ID = '707f1f77bcf86cd799439077';
const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new RatePlan({
  amount: 35000,
  createdBy: USER_ID,
  ...overrides,
});

describe('RatePlan model — Sprint B2 (roomCategory/rateType additif) — TEST DATA', () => {
  test('accommodation + mode (Sprint B1, comportement inchangé) passe la validation', async () => {
    const rate = base({ accommodation: ACCOMMODATION_ID, mode: 'nightly' });
    await expect(rate.validate()).resolves.toBeUndefined();
  });

  test('roomCategory + rateType (Sprint B2) passe la validation', async () => {
    const rate = base({ roomCategory: ROOM_CATEGORY_ID, rateType: 'public' });
    await expect(rate.validate()).resolves.toBeUndefined();
  });

  test('ni accommodation+mode ni roomCategory+rateType est rejeté', async () => {
    const rate = base();
    await expect(rate.validate()).rejects.toThrow();
  });

  test('les deux cibles à la fois sont rejetées (jamais accommodation ET roomCategory)', async () => {
    const rate = base({ accommodation: ACCOMMODATION_ID, mode: 'nightly', roomCategory: ROOM_CATEGORY_ID, rateType: 'public' });
    await expect(rate.validate()).rejects.toThrow();
  });

  test('accommodation sans mode est rejeté (paire incomplète)', async () => {
    const rate = base({ accommodation: ACCOMMODATION_ID });
    await expect(rate.validate()).rejects.toThrow();
  });

  test('roomCategory sans rateType est rejeté (paire incomplète)', async () => {
    const rate = base({ roomCategory: ROOM_CATEGORY_ID });
    await expect(rate.validate()).rejects.toThrow();
  });

  test('rateType hors enum est rejeté', () => {
    const rate = base({ roomCategory: ROOM_CATEGORY_ID, rateType: 'noel' });
    const errors = rate.validateSync()?.errors || {};
    expect(errors.rateType).toBeDefined();
  });

  test('un montant négatif est rejeté', () => {
    const rate = base({ accommodation: ACCOMMODATION_ID, mode: 'nightly', amount: -10 });
    const errors = rate.validateSync()?.errors || {};
    expect(errors.amount).toBeDefined();
  });

  test('RATE_TYPES et RATE_MODES sont exposés en statique', () => {
    expect(RatePlan.RATE_TYPES).toEqual(['public', 'entreprise', 'weekend', 'promotion', 'haute_saison']);
    expect(RatePlan.RATE_MODES).toEqual(['nightly', 'weekly', 'monthly', 'yearly']);
  });
});

describe('RatePlan model — audit des index (contrôle final Sprint B2) — TEST DATA', () => {
  // Empêche la régression du bug corrigé à l'audit final : deux appels
  // concurrents pouvaient chacun constater "aucun tarif actif" et créer
  // deux tarifs actifs pour la même cible/type. La contrainte doit être
  // portée par un index UNIQUE (pas seulement par la logique applicative),
  // et rester partielle (les tarifs inactifs ne sont jamais concernés).
  const indexes = RatePlan.schema.indexes();

  test('un index unique partiel protège (accommodation, mode) — actifs uniquement', () => {
    const idx = indexes.find(([keys]) => keys.accommodation === 1 && keys.mode === 1);
    expect(idx).toBeDefined();
    const [, options] = idx;
    expect(options.unique).toBe(true);
    expect(options.partialFilterExpression).toMatchObject({ active: true });
  });

  test('un index unique partiel protège (roomCategory, rateType) — actifs uniquement', () => {
    const idx = indexes.find(([keys]) => keys.roomCategory === 1 && keys.rateType === 1);
    expect(idx).toBeDefined();
    const [, options] = idx;
    expect(options.unique).toBe(true);
    expect(options.partialFilterExpression).toMatchObject({ active: true });
  });

  test("aucun index simple redondant sur 'accommodation' ou 'roomCategory' seuls (doublon corrigé)", () => {
    const singleFieldIndexes = indexes.filter(([keys]) => Object.keys(keys).length === 1);
    const redundant = singleFieldIndexes.find(([keys]) => keys.accommodation === 1 || keys.roomCategory === 1);
    expect(redundant).toBeUndefined();
  });
});
