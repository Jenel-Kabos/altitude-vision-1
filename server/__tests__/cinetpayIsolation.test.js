jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn() }));

const axios = require('axios');
const controller = require('../controllers/cinetpayController');

test('initiation CinetPay utilise une réponse provider fake', async () => {
  axios.post.mockResolvedValue({ data: { code: '201', data: { payment_url: 'https://checkout.example.test/fake' } } });
  const req = { body: { montant: 1000, description: 'Test', transactionId: 'fake-transaction' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.initierPaiement(req, res);
  expect(axios.post).toHaveBeenCalledWith('https://api-checkout.cinetpay.com/v2/payment', expect.objectContaining({ amount: 1000 }));
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ status: 'success', paymentUrl: 'https://checkout.example.test/fake', transactionId: 'fake-transaction' });
});
