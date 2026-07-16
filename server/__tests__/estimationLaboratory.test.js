const auth = require('../middleware/authMiddleware');
const { getEstimation, calculateEstimation } = require('../controllers/estimationController');

const response = () => {
  const res = { statusCode: 200, body: null };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
};

describe('laboratoire estimation — sécurité et compatibilité', () => {
  test.each([getEstimation, calculateEstimation])('un ObjectId invalide retourne 404 sans CastError', async handler => {
    const res = response();
    await handler({ params: { id: 'pas-un-object-id' }, user: { id: '507f1f77bcf86cd799439011' }, body: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  test('un rôle hors périmètre estimation est refusé', () => {
    const middleware = auth.restrictTo('Admin', 'Collaborateur');
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; } };
    expect(() => middleware({ user: { role: 'Client' } }, res, jest.fn())).toThrow('Accès refusé');
    expect(res.statusCode).toBe(403);
  });

  test('un gestionnaire de références autorisé passe le middleware', () => {
    const next = jest.fn();
    auth.restrictTo('Admin', 'Collaborateur')({ user: { role: 'Admin' } }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
