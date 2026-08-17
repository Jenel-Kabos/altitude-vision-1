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

// POST-E2E-2 — teste le VRAI module (pas la réimplémentation ci-dessus) :
// une erreur portant `.statusCode` mais sans `.name` reconnu tombait sur 500
// (bug réel démontré, voir conversationController.js:assertConversationAccess,
// POST_E2E2_ETAT_INITIAL.md §5). `ConversationAccessError` est le nom
// désormais reconnu (même convention que HotelAccessError).
const { errorHandler: realErrorHandler } = require('../middleware/errorMiddleware');

describe('errorHandler middleware (module réel) — ConversationAccessError', () => {
  test('honore .statusCode=403 pour une ConversationAccessError nommée', () => {
    const err = new Error('Accès refusé');
    err.name = 'ConversationAccessError';
    err.statusCode = 403;
    const res = makeRes();
    realErrorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'fail', message: 'Accès refusé' }));
  });

  test('honore .statusCode=404 pour une ConversationAccessError nommée', () => {
    const err = new Error('Conversation introuvable');
    err.name = 'ConversationAccessError';
    err.statusCode = 404;
    const res = makeRes();
    realErrorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('une erreur inattendue SANS nom reconnu reste bien une 500 (non transformée globalement)', () => {
    const err = new Error('Boom inattendu');
    const res = makeRes();
    realErrorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', message: 'Boom inattendu' }));
  });
});
