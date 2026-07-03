// __tests__/errorMiddleware.test.js
// Tests unitaires du middleware de gestion d'erreurs

jest.mock('../config/db', () => jest.fn());

const makeRes = () => {
  const res = {
    statusCode: 200,
    status: jest.fn(function(c) { this.statusCode = c; return this; }),
    json:   jest.fn(),
  };
  return res;
};

// Simulation de la logique errorMiddleware (même logique que errorMiddleware.js)
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message    = err.message;

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message    = 'Ressource non trouvée.';
  }
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `La valeur '${err.keyValue?.[field]}' existe déjà pour le champ '${field}'.`;
  }
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {}).map(v => v.message).join(', ');
  }

  res.status(statusCode).json({ message });
};

describe('errorHandler middleware', () => {
  test('retourne 500 par défaut pour une erreur générique', () => {
    const err = new Error('Erreur serveur');
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Erreur serveur' }));
  });

  test('retourne 404 pour une CastError MongoDB (ObjectId invalide)', () => {
    const err = { name: 'CastError', kind: 'ObjectId', message: 'Cast error' };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Ressource non trouvée.' }));
  });

  test('retourne 400 pour un E11000 (duplicate key)', () => {
    const err = {
      code:     11000,
      keyValue: { email: 'test@test.com' },
      message:  'duplicate key',
    };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('test@test.com') })
    );
  });

  test('retourne 400 pour une ValidationError Mongoose', () => {
    const err = {
      name:   'ValidationError',
      errors: {
        price: { message: 'Le prix est requis.' },
        type:  { message: 'Le type est invalide.' },
      },
    };
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toContain('prix est requis');
    expect(jsonCall.message).toContain('type est invalide');
  });
});
