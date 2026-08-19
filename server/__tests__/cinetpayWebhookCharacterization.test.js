// PAY-1 avait ajouté ce fichier comme test de caractérisation prouvant, sans
// rien corriger, que `cinetpayController.webhookCinetpay` acceptait un
// payload non authentifié et mutait `Paiement.statut` en `payé` (preuve
// exécutable conservée dans l'historique git de ce fichier au commit
// f1bb85c, et citée intégralement dans
// server/docs/PAY1_ARCHITECTURE_REPORT.md §9).
//
// PAY-2 ferme ce P0 par dépréciation du provider (voir cinetpayController.js
// et server/docs/PAY2_CINETPAY_DEPRECATION_REPORT.md). Ce fichier devient
// désormais le test d'attaque / garde de non-régression : il rejoue
// exactement les mêmes payloads forgés qu'auparavant et prouve qu'ils ne
// produisent plus aucune mutation ni aucune notification — c'est le test qui
// doit échouer si quelqu'un réintroduit un jour une écriture dans ce handler
// sans vérification de signature.

jest.mock('../models/Paiement');
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue() }));

const Paiement = require('../models/Paiement');
const { notify } = require('../services/notificationService');
const controller = require('../controllers/cinetpayController');

const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};

describe('cinetpayController.webhookCinetpay — fermeture du P0 (PAY-2, provider déprécié)', () => {
  afterEach(() => jest.clearAllMocks());

  test('un payload forgé (transaction_id deviné + status ACCEPTED, sans aucun en-tête de signature) ne mute plus aucun paiement', async () => {
    const req = {
      headers: {},
      body: { transaction_id: 'REF-DEVINEE-PAR-UN-TIERS', status: 'ACCEPTED', amount: 999999, metadata: '{}' },
    };
    const res = response();

    await controller.webhookCinetpay(req, res);

    expect(Paiement.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual(expect.objectContaining({
      status: 'fail',
      code: 'PAYMENT_PROVIDER_DEPRECATED',
      provider: 'cinetpay',
    }));
  });

  test('un userId fourni dans le metadata du corps de la requête ne déclenche plus aucune notification', async () => {
    const req = {
      headers: {},
      body: {
        transaction_id: 'REF-1',
        status: 'ACCEPTED',
        amount: 5000,
        metadata: JSON.stringify({ userId: 'attacker-supplied-user-id' }),
      },
    };

    await controller.webhookCinetpay(req, response());

    expect(notify).not.toHaveBeenCalled();
  });

  test('un rejeu identique du même payload reste sans effet à chaque appel (rien à protéger par idempotence, car rien ne mute)', async () => {
    const req = {
      headers: {},
      body: { transaction_id: 'REF-REJOUEE', status: 'ACCEPTED', amount: 1000, metadata: '{}' },
    };

    await controller.webhookCinetpay(req, response());
    await controller.webhookCinetpay(req, response());

    expect(Paiement.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
