// __tests__/accommodationCompletion.test.js — Sprint B1 : score de complétude
// (fonction pure, testée directement sans mocks DB).

jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const { computeCompletionScore } = require('../services/accommodationService');

const fullProperty = {
  title: 'Villa Test',
  description: 'Une belle villa',
  bedrooms: 3,
  bathrooms: 2,
  images: ['a.jpg', 'b.jpg', 'c.jpg'],
};

const fullAccommodation = {
  accommodationType: 'villa_meublee',
  capacity: { maxAdults: 4 },
  checkInTime: '14:00',
  checkOutTime: '11:00',
  amenities: { cuisine: ['Four'], salon: [], internet: [], exterieur: [], parking: [], securite: [] },
  includedServices: { menage: true, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false },
};

const activeRate = [{ mode: 'nightly', amount: 35000, active: true }];

describe('computeCompletionScore — Sprint B1 — TEST DATA', () => {
  test('un hébergement complet obtient 100% et complete=true', () => {
    const result = computeCompletionScore(fullAccommodation, fullProperty, activeRate);
    expect(result.score).toBe(100);
    expect(result.complete).toBe(true);
    expect(result.breakdown).toEqual({
      informations: 20, photos: 20, tarifs: 20, equipements: 20, regles: 10, services: 10,
    });
  });

  test('sans photos suffisantes (< 3), la catégorie photos vaut 0', () => {
    const property = { ...fullProperty, images: ['a.jpg'] };
    const result = computeCompletionScore(fullAccommodation, property, activeRate);
    expect(result.breakdown.photos).toBe(0);
    expect(result.score).toBe(80);
    expect(result.complete).toBe(false);
  });

  test('sans tarif actif, la catégorie tarifs vaut 0', () => {
    const result = computeCompletionScore(fullAccommodation, fullProperty, []);
    expect(result.breakdown.tarifs).toBe(0);
    expect(result.complete).toBe(false);
  });

  test('un tarif désactivé (active: false) ne compte pas', () => {
    const result = computeCompletionScore(fullAccommodation, fullProperty, [{ mode: 'nightly', amount: 1000, active: false }]);
    expect(result.breakdown.tarifs).toBe(0);
  });

  test('sans aucun équipement structuré, la catégorie équipements vaut 0', () => {
    const acc = { ...fullAccommodation, amenities: { cuisine: [], salon: [], internet: [], exterieur: [], parking: [], securite: [] } };
    const result = computeCompletionScore(acc, fullProperty, activeRate);
    expect(result.breakdown.equipements).toBe(0);
  });

  test('sans aucun service inclus, la catégorie services vaut 0', () => {
    const acc = { ...fullAccommodation, includedServices: { menage: false, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false } };
    const result = computeCompletionScore(acc, fullProperty, activeRate);
    expect(result.breakdown.services).toBe(0);
  });

  test('capacité manquante (maxAdults=0) fait échouer la catégorie informations', () => {
    const acc = { ...fullAccommodation, capacity: { maxAdults: 0 } };
    const result = computeCompletionScore(acc, fullProperty, activeRate);
    expect(result.breakdown.informations).toBe(0);
  });

  test('un hébergement totalement vide obtient un score de 0', () => {
    const result = computeCompletionScore({}, {}, []);
    expect(result.score).toBe(0);
    expect(result.complete).toBe(false);
  });
});
