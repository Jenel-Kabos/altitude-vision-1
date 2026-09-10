// ALTIMMO-PUSH-TOKEN-LOGOUT-1 — le controller doit accepter :
//   - string non vide  → enregistrement / remplacement
//   - null             → dissociation (logout mobile)
//   - absent / mauvais type → 400
// et ne jamais permettre de modifier le pushToken d'un autre utilisateur.

jest.mock('../models/User', () => ({ findByIdAndUpdate: jest.fn() }));

const User = require('../models/User');
const controller = require('../controllers/userController');

const OWNER = '507f1f77bcf86cd799439011';

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

describe('userController.savePushToken — contrat register / clear', () => {
  beforeEach(() => { jest.clearAllMocks(); User.findByIdAndUpdate.mockResolvedValue({}); });

  test('enregistre un ExpoPushToken valide sur req.user._id', async () => {
    const res = response();
    await controller.savePushToken({ user: { _id: OWNER }, body: { pushToken: 'ExponentPushToken[abc]' } }, res);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(OWNER, { pushToken: 'ExponentPushToken[abc]' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  test('accepte pushToken: null et dissocie le token en base', async () => {
    const res = response();
    await controller.savePushToken({ user: { _id: OWNER }, body: { pushToken: null } }, res);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(OWNER, { pushToken: null });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].message).toMatch(/dissoci/i);
  });

  test('dissociation idempotente (déjà null → toujours 200)', async () => {
    const res = response();
    await controller.savePushToken({ user: { _id: OWNER }, body: { pushToken: null } }, res);
    await controller.savePushToken({ user: { _id: OWNER }, body: { pushToken: null } }, res);
    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(User.findByIdAndUpdate.mock.calls.every(([id, patch]) => id === OWNER && patch.pushToken === null)).toBe(true);
  });

  test('champ absent → 400 (empêche un clear silencieux par bug client)', async () => {
    const res = response();
    await controller.savePushToken({ user: { _id: OWNER }, body: {} }, res);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('type invalide (number, boolean, object, tableau) → 400', async () => {
    const res = response();
    for (const bad of [42, true, false, { a: 1 }, ['t'], '']) {
      jest.clearAllMocks();
      await controller.savePushToken({ user: { _id: OWNER }, body: { pushToken: bad } }, res);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenLastCalledWith(400);
    }
  });

  test('impossible de cibler un autre userId via le body — l\'identité vient de req.user._id', async () => {
    const res = response();
    await controller.savePushToken(
      { user: { _id: OWNER }, body: { pushToken: 'ExponentPushToken[victim]', userId: 'ATTACKER-ID' } },
      res
    );
    // Le patch DB utilise strictement OWNER, jamais la valeur du body.
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(OWNER, expect.any(Object));
    expect(User.findByIdAndUpdate).not.toHaveBeenCalledWith('ATTACKER-ID', expect.anything());
  });

  test('remplacement : token existant écrasé par un nouveau token', async () => {
    const res = response();
    await controller.savePushToken({ user: { _id: OWNER }, body: { pushToken: 'ExponentPushToken[new]' } }, res);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(OWNER, { pushToken: 'ExponentPushToken[new]' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
