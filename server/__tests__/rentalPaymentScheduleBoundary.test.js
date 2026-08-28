jest.mock('../models/Paiement');

const Paiement = require('../models/Paiement');
const { generatePaiements } = require('../services/rentalPaymentScheduleService');

describe('generatePaiements — contrat de parité', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    [null, '2026-03-01', 100], ['2026-01-01', null, 100], ['2026-01-01', '2026-03-01', 0],
  ])('ne persiste rien si une donnée obligatoire manque', async (start, end, rent) => {
    await expect(generatePaiements('contract-1', start, end, rent)).resolves.toBeUndefined();
    expect(Paiement.insertMany).not.toHaveBeenCalled();
  });

  test('génère chaque mois inclusivement avec le payload historique exact', async () => {
    Paiement.insertMany.mockResolvedValue([]);
    await generatePaiements('contract-1', '2026-01-15', '2026-03-20', 150000);
    expect(Paiement.insertMany).toHaveBeenCalledWith([
      { contrat: 'contract-1', mois: 1, annee: 2026, montant: 150000, statut: 'impayé' },
      { contrat: 'contract-1', mois: 2, annee: 2026, montant: 150000, statut: 'impayé' },
      { contrat: 'contract-1', mois: 3, annee: 2026, montant: 150000, statut: 'impayé' },
    ]);
  });

  test('propage exactement une erreur insertMany', async () => {
    Paiement.insertMany.mockRejectedValue(new Error('mongo failure'));
    await expect(generatePaiements('contract-1', '2026-01-01', '2026-01-31', 100)).rejects.toThrow('mongo failure');
  });
});
