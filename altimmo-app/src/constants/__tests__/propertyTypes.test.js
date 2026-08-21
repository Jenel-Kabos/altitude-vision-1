import { PROPERTY_TYPES, PROPERTY_TYPE_VALUES } from '../propertyTypes';

// HOTFIX-MOB-ADD-PROPERTY-1 : "Parcelle" doit être un type sélectionnable au même
// titre que les 9 types existants, sans jamais faire régresser "Terrain" (les deux
// coexistent comme des types de bien distincts — voir server/models/Property.js).
describe('PROPERTY_TYPES (mobile)', () => {
  test('contient "Parcelle" comme type sélectionnable', () => {
    expect(PROPERTY_TYPE_VALUES).toContain('Parcelle');
  });

  test('"Terrain" reste présent (non régressé)', () => {
    expect(PROPERTY_TYPE_VALUES).toContain('Terrain');
  });

  test('"Terrain" et "Parcelle" sont deux entrées distinctes', () => {
    const terrain = PROPERTY_TYPES.find((t) => t.value === 'Terrain');
    const parcelle = PROPERTY_TYPES.find((t) => t.value === 'Parcelle');
    expect(terrain).toBeDefined();
    expect(parcelle).toBeDefined();
    expect(terrain).not.toBe(parcelle);
  });

  test('exactement 10 types au total (9 existants + Parcelle)', () => {
    expect(PROPERTY_TYPES).toHaveLength(10);
  });
});
