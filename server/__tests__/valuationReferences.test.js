const MarketPriceReference = require('../models/MarketPriceReference');
const ConstructionCostReference = require('../models/ConstructionCostReference');
const ValuationCalculation = require('../models/ValuationCalculation');

describe('références et snapshots du laboratoire', () => {
  test('une référence marché valide exige min ≤ moyenne ≤ max et une source', async () => {
    const reference = new MarketPriceReference({ city: 'Brazzaville', propertyType: 'Terrain nu', minPricePerSqm: 1, averagePricePerSqm: 2, maxPricePerSqm: 3, dataSource: 'Relevé interne', sourceType: 'demonstration' });
    await expect(reference.validate()).resolves.toBeUndefined();
  });

  test('une grille de prix incohérente est rejetée avant persistance', async () => {
    const reference = new MarketPriceReference({ city: 'Brazzaville', propertyType: 'Terrain nu', minPricePerSqm: 3, averagePricePerSqm: 2, maxPricePerSqm: 1, dataSource: 'Relevé interne', sourceType: 'demonstration' });
    await expect(reference.validate()).rejects.toThrow('min ≤ moyenne ≤ max');
  });

  test('un coût de construction incohérent est rejeté', async () => {
    const reference = new ConstructionCostReference({ city: 'Brazzaville', constructionCategory: 'standard', costMinPerSqm: 3, costAveragePerSqm: 2, costMaxPerSqm: 4, source: 'Donnée test' });
    await expect(reference.validate()).rejects.toThrow('min ≤ moyenne ≤ max');
  });

  test('un calcul conserve un snapshot autonome de ses entrées', async () => {
    const calculation = new ValuationCalculation({ estimationId: '507f1f77bcf86cd799439011', version: 1, inputSnapshot: { surface: 500 }, finalResult: { marketValue: { recommended: 20000000 } }, confidenceScore: 60 });
    await expect(calculation.validate()).resolves.toBeUndefined();
    expect(calculation.inputSnapshot.surface).toBe(500);
  });
});
