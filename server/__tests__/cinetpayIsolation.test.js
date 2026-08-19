// PAY-2 — CinetPay déprécié : plus aucun appel externe n'est possible par
// construction (le handler ne fait plus jamais appel à axios). Ce test,
// auparavant nommé pour l'isolation du mock, prouve maintenant l'isolation
// la plus forte possible : l'absence totale d'appel réseau.
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn() }));

const axios = require('axios');
const controller = require('../controllers/cinetpayController');
const PaiementTransaction = require('../models/PaiementTransaction');
const Transaction = require('../models/Transaction');

test('les paiements CinetPay historiques restent lisibles — les valeurs d’enum et champs legacy ne sont pas retirés du schéma', () => {
  const methodeEnum = PaiementTransaction.schema.path('methode').enumValues;
  expect(methodeEnum).toEqual(expect.arrayContaining(['cinetpay_mobile', 'cinetpay_carte']));
  expect(PaiementTransaction.schema.path('cinetpayTransactionId')).toBeDefined();
  expect(PaiementTransaction.schema.path('cinetpayRaw')).toBeDefined();

  const paymentMethodEnum = Transaction.schema.path('paymentMethod').enumValues;
  expect(paymentMethodEnum).toEqual(expect.arrayContaining(['cinetpay_mobile', 'cinetpay_carte']));
});

test('initiation CinetPay est refusée sans jamais appeler le provider externe', async () => {
  const req = { body: { montant: 1000, description: 'Test', transactionId: 'fake-transaction' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.initierPaiement(req, res);
  expect(axios.post).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(410);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    status: 'fail',
    code: 'PAYMENT_PROVIDER_DEPRECATED',
    provider: 'cinetpay',
  }));
});
