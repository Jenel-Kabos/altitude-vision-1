// __tests__/hotelCompletion.test.js — Sprint B2 : score de complétude Hôtel
// (fonction pure, testée directement sans mocks DB).

jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const { computeHotelCompletionScore } = require('../services/hotelService');

const fullHotel = {
  name: 'Hôtel Le Panorama',
  description: 'Un hôtel confortable au cœur de la ville.',
  phone: '+242060000000',
  gallery: [{ url: 'a.jpg' }],
  hotelServices: { restaurant: true, bar: false, piscine: false, spa: false, salleSport: false, salleConference: false, navette: false, parking: false, reception24h: false, wifi: false },
};
const property = { address: { city: 'Brazzaville' }, images: ['a.jpg', 'b.jpg', 'c.jpg'] };
const categories = [{ _id: 'CAT-1' }, { _id: 'CAT-2' }];

describe('computeHotelCompletionScore — Sprint B2 — TEST DATA', () => {
  test('un hôtel complet (informations + galerie + services + catégories + tarifs) obtient 100%', () => {
    const result = computeHotelCompletionScore(fullHotel, property, categories, [1, 2]);
    expect(result.score).toBe(100);
    expect(result.complete).toBe(true);
    expect(result.breakdown).toEqual({ informations: 20, galerie: 20, services: 20, categories: 25, tarifs: 15 });
  });

  test('sans téléphone, la catégorie informations vaut 0', () => {
    const result = computeHotelCompletionScore({ ...fullHotel, phone: '' }, property, categories, [1, 2]);
    expect(result.breakdown.informations).toBe(0);
    expect(result.complete).toBe(false);
  });

  test('sans galerie ni photos suffisantes, la catégorie galerie vaut 0', () => {
    const result = computeHotelCompletionScore({ ...fullHotel, gallery: [] }, { ...property, images: ['a.jpg'] }, categories, [1, 2]);
    expect(result.breakdown.galerie).toBe(0);
  });

  test('sans aucun service structuré, la catégorie services vaut 0', () => {
    const noServices = { ...fullHotel, hotelServices: Object.fromEntries(Object.keys(fullHotel.hotelServices).map((k) => [k, false])) };
    const result = computeHotelCompletionScore(noServices, property, categories, [1, 2]);
    expect(result.breakdown.services).toBe(0);
  });

  test('sans aucune catégorie de chambres, catégories ET tarifs valent 0', () => {
    const result = computeHotelCompletionScore(fullHotel, property, [], []);
    expect(result.breakdown.categories).toBe(0);
    expect(result.breakdown.tarifs).toBe(0);
  });

  test("une catégorie sans aucun tarif actif fait échouer la catégorie 'tarifs' (toutes les catégories doivent avoir au moins un tarif)", () => {
    const result = computeHotelCompletionScore(fullHotel, property, categories, [1, 0]);
    expect(result.breakdown.categories).toBe(25); // catégories existent
    expect(result.breakdown.tarifs).toBe(0); // mais l'une d'elles n'a aucun tarif actif
  });

  test('un hôtel totalement vide obtient un score de 0', () => {
    const result = computeHotelCompletionScore({}, {}, [], []);
    expect(result.score).toBe(0);
    expect(result.complete).toBe(false);
  });
});
