const Transaction = require('../models/Transaction');
const Contrat = require('../models/Contrat');

describe('IM-1 — verrous persistants du cycle immobilier', () => {
  test('une seule transaction ouverte ou finalisée peut référencer un bien', () => {
    const index = Transaction.schema.indexes().find(([, options]) => options.name === 'one_active_real_estate_transaction_per_property');
    expect(index).toBeDefined();
    expect(index[0]).toEqual({ property: 1 });
    expect(index[1]).toMatchObject({ unique: true });
    expect(index[1].partialFilterExpression.status.$in).toEqual(expect.arrayContaining(['En cours', 'Paiement en attente', 'Réussie', 'Litigée']));
  });

  test('un seul contrat en attente ou actif peut exister par bien et type', () => {
    const index = Contrat.schema.indexes().find(([, options]) => options.name === 'one_open_contract_per_property_and_type');
    expect(index).toBeDefined();
    expect(index[0]).toEqual({ bien: 1, type: 1 });
    expect(index[1]).toMatchObject({ unique: true });
    expect(index[1].partialFilterExpression.statut.$in).toEqual(expect.arrayContaining(['en_attente', 'actif']));
  });
});
