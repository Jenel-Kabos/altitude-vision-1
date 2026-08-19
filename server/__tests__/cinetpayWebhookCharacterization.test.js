// PAY-1 — Test de caractérisation (aucun changement métier). Documente par la
// preuve le comportement RÉEL actuel du webhook CinetPay live
// (`POST /api/paiements/webhook-cinetpay`, cinetpayController.webhookCinetpay),
// notify_url effectif configuré dans initierPaiement — par opposition au flux
// signé/idempotent mais explicitement commenté "legacy — non utilisé" dans
// paiementTransactionController.webhookCinetpay.
//
// Ce test ne corrige rien : il prouve, avec assertions, qu'aucune vérification
// de signature n'est appliquée avant l'écriture `Paiement.statut = 'payé'`, et
// qu'aucun garde-fou d'idempotence n'empêche une notification répétée. Il doit
// continuer à échouer (donc signaler une régression de compréhension) si un
// futur correctif ajoute une vérification — c'est le but : ce test devra être
// mis à jour explicitement le jour où la vulnérabilité est corrigée, jamais
// contourné silencieusement.

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

describe('cinetpayController.webhookCinetpay — comportement réel actuel (PAY-1, non corrigé)', () => {
  afterEach(() => jest.clearAllMocks());

  test('accepte une requête sans aucun en-tête de signature et marque le paiement payé', async () => {
    Paiement.findOneAndUpdate.mockReturnValue({ catch: jest.fn().mockResolvedValue(undefined) });
    const req = {
      headers: {}, // aucune signature, aucun x-token — contrairement à paiementTransactionController.webhookCinetpay
      body: { transaction_id: 'REF-DEVINEE-PAR-UN-TIERS', status: 'ACCEPTED', amount: 999999, metadata: '{}' },
    };
    const res = response();

    await controller.webhookCinetpay(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(Paiement.findOneAndUpdate).toHaveBeenCalledWith(
      { reference: 'REF-DEVINEE-PAR-UN-TIERS' },
      expect.objectContaining({ statut: 'payé', montantRecu: 999999 }),
    );
  });

  test('déclenche une notification "payment_success" à partir d’un userId fourni dans le metadata du corps de la requête, non authentifié', async () => {
    Paiement.findOneAndUpdate.mockReturnValue({ catch: jest.fn().mockResolvedValue(undefined) });
    const req = {
      headers: {},
      body: {
        transaction_id: 'REF-1',
        status: 'ACCEPTED',
        amount: 5000,
        metadata: JSON.stringify({ userId: 'attacker-supplied-user-id' }),
      },
    };
    const res = response();

    await controller.webhookCinetpay(req, res);

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      recipient: 'attacker-supplied-user-id',
      type: 'payment_success',
    }));
  });

  test('un second appel identique (rejeu) répète intégralement l’écriture et la notification — aucune protection anti-doublon', async () => {
    Paiement.findOneAndUpdate.mockReturnValue({ catch: jest.fn().mockResolvedValue(undefined) });
    const req = {
      headers: {},
      body: { transaction_id: 'REF-REJOUEE', status: 'ACCEPTED', amount: 1000, metadata: '{}' },
    };

    await controller.webhookCinetpay(req, response());
    await controller.webhookCinetpay(req, response());

    expect(Paiement.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
