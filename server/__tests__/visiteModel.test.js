const Visite = require('../models/Visite');

describe('Visite model — TEST DATA', () => {
  test('reste compatible avec une ancienne visite', () => {
    const visite = new Visite({ property: '507f1f77bcf86cd799439011', client: '507f191e810c19729de860ea', statut: 'Confirmée' });
    expect(visite.validateSync()).toBeUndefined();
    expect(visite.status).toBeNull();
  });

  test('refuse un nombre de visiteurs ou un montant négatif', () => {
    const visite = new Visite({ property: '507f1f77bcf86cd799439011', client: '507f191e810c19729de860ea', visitorCount: 0, visitFeeAmount: -1 });
    const errors = visite.validateSync().errors;
    expect(errors.visitorCount).toBeDefined();
    expect(errors.visitFeeAmount).toBeDefined();
  });
});
