jest.mock('../models/Transaction');
jest.mock('../models/PaiementTransaction');
jest.mock('../services/yabetooService');
jest.mock('../config/cloudinary', () => ({ upload: { single: jest.fn() }, uploadToCloudinary: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn(), notifyStaff: jest.fn() }));
jest.mock('../services/actionLogService', () => ({ logAction: jest.fn(), buildAuteur: jest.fn() }));

const Transaction = require('../models/Transaction');
const PaiementTransaction = require('../models/PaiementTransaction');
const controller = require('../controllers/paiementTransactionController');
const crypto = require('crypto');

const TX_ID = '507f1f77bcf86cd799439011';
const OTHER_TX_ID = '507f1f77bcf86cd799439012';
const CLIENT_ID = '507f1f77bcf86cd799439013';
const OTHER_CLIENT_ID = '507f1f77bcf86cd799439014';

const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};
const populatedQuery = (value) => ({ populate: jest.fn().mockResolvedValue(value) });
const selectedQuery = (value) => ({ select: jest.fn().mockResolvedValue(value) });

describe('paiementTransactionController — contrôle IDOR', () => {
  afterEach(() => jest.clearAllMocks());

  test('refuse l’initiation d’un paiement sur la transaction d’un tiers', async () => {
    Transaction.findById.mockReturnValue(populatedQuery({ _id: TX_ID, client: CLIENT_ID, status: 'En cours' }));
    const req = { params: { id: TX_ID }, body: { phone: '060000000', operator: 'MTN' }, user: { _id: OTHER_CLIENT_ID, role: 'Client' } };
    const res = response();
    await controller.initierPaiement(req, res);
    expect(res.statusCode).toBe(403);
    expect(PaiementTransaction.create).not.toHaveBeenCalled();
  });

  test('refuse la consultation d’une intention de paiement d’un tiers', async () => {
    PaiementTransaction.findOne.mockResolvedValue({ transaction: TX_ID });
    Transaction.findById.mockReturnValue(selectedQuery({ _id: TX_ID, client: CLIENT_ID }));
    const req = { params: { id: TX_ID, intentId: 'INTENT-SECRET' }, user: { _id: OTHER_CLIENT_ID, role: 'Client' } };
    const res = response();
    await controller.verifierPaiement(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toHaveProperty('data');
  });

  test('refuse un identifiant de paiement provenant d’une autre transaction lors de la validation', async () => {
    PaiementTransaction.findById.mockResolvedValue({ transaction: OTHER_TX_ID, methode: 'virement' });
    const req = { params: { txId: TX_ID, pId: '507f1f77bcf86cd799439015' }, body: { action: 'valider' }, user: { _id: CLIENT_ID, role: 'Admin' } };
    const res = response();
    await controller.validerVirement(req, res);
    expect(res.statusCode).toBe(409);
    expect(Transaction.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('paiementTransactionController — signature webhook Yabetoo', () => {
  const previousSecret = process.env.YABETOO_WEBHOOK_SECRET;
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.YABETOO_WEBHOOK_SECRET;
    else process.env.YABETOO_WEBHOOK_SECRET = previousSecret;
  });

  test('accepte une signature HMAC-SHA256 valide sur timestamp + corps brut', () => {
    process.env.YABETOO_WEBHOOK_SECRET = 'webhook-test-secret';
    const timestamp = '1713108000';
    const rawBody = Buffer.from('{"type":"payment_intent.succeeded"}');
    const signature = crypto.createHmac('sha256', process.env.YABETOO_WEBHOOK_SECRET).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
    expect(controller.verifyYabetooWebhook({ rawBody, headers: { 'x-yabetoo-webhook-timestamp': timestamp, 'x-yabetoo-webhook-signature': `v1=${signature}` } }, Number(timestamp))).toEqual({ ok: true });
  });

  test('rejette une signature invalide et un rejeu hors tolérance', () => {
    process.env.YABETOO_WEBHOOK_SECRET = 'webhook-test-secret';
    const rawBody = Buffer.from('{}');
    const invalid = controller.verifyYabetooWebhook({ rawBody, headers: { 'x-yabetoo-webhook-timestamp': '1000', 'x-yabetoo-webhook-signature': `v1=${'0'.repeat(64)}` } }, 2000);
    expect(invalid).toMatchObject({ ok: false, statusCode: 401 });
  });
});

describe('paiementTransactionController — signature webhook CinetPay', () => {
  const previousSecret = process.env.CINETPAY_SECRET;
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CINETPAY_SECRET;
    else process.env.CINETPAY_SECRET = previousSecret;
  });

  test('vérifie le x-token avec la concaténation officielle des champs', () => {
    process.env.CINETPAY_SECRET = 'cinetpay-test-secret';
    const body = { cpm_site_id: 'SITE', cpm_trans_id: 'TX1', cpm_amount: '1000', cpm_currency: 'XAF' };
    const fields = ['cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount', 'cpm_currency', 'signature', 'payment_method', 'cel_phone_num', 'cpm_phone_prefixe', 'cpm_language', 'cpm_version', 'cpm_payment_config', 'cpm_page_action', 'cpm_custom', 'cpm_designation', 'cpm_error_message'];
    const payload = fields.map((field) => String(body[field] ?? '')).join('');
    const token = crypto.createHmac('sha256', process.env.CINETPAY_SECRET).update(payload).digest('hex');
    expect(controller.verifyCinetPayWebhook({ body, headers: { 'x-token': token } })).toEqual({ ok: true });
  });

  test('échoue fermé sans secret configuré', () => {
    delete process.env.CINETPAY_SECRET;
    expect(controller.verifyCinetPayWebhook({ body: {}, headers: {} })).toMatchObject({ ok: false, statusCode: 503 });
  });
});
