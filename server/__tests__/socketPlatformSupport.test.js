// MESSAGING-PLATFORM-INBOX-AGGREGATION-1C — unit-level assertion des règles
// de room. Un test d'intégration socket.io end-to-end (client io + serveur
// live + JWT + adaptateur) reste un follow-up dédié ; ici on isole le
// contrat d'émission (`emitConversationEvent`) et de room via mocks du
// singleton socket.io.

jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: jest.fn() }));
jest.mock('ioredis', () => class { on() {} duplicate() { return this; } connect() { return Promise.resolve(); } });
jest.mock('../models/Conversation', () => ({ findById: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../services/platformTenant/tenantContextService', () => ({
  resolveEffectiveTenantContext: jest.fn(),
}));
jest.mock('../services/platformOperator/platformOperatorService', () => ({
  hasCapability: (op, cap) => Boolean(op?.capabilities?.includes?.(cap)),
}));

const socket = require('../socket');

describe('MESSAGING-PLATFORM-INBOX-AGGREGATION-1C — canonical room names', () => {
  test('SOCK-C-04 (naming): platform:support est la room canonique', () => {
    expect(socket.PLATFORM_SUPPORT_ROOM).toBe('platform:support');
  });

  test('SOCK-C-01 (naming): tenantStaffRoom(<id>) → tenant:<id>:staff', () => {
    expect(socket.tenantStaffRoom('t-mila')).toBe('tenant:t-mila:staff');
    expect(socket.tenantStaffRoom(null)).toBeNull();
    expect(socket.tenantStaffRoom(undefined)).toBeNull();
  });
});

describe('emitConversationEvent — routing sur rooms canoniques', () => {
  // On installe un IO mock local en simulant `initSocket` sans réseau : on
  // remplace `_io` en accédant à `getIO()` après avoir monkeypaché le module.
  // Approche minimale : on wrappe `getIO` via `jest.spyOn` sur l'objet exporté.
  let calls;
  let fakeIo;
  beforeEach(() => {
    calls = [];
    const emitter = () => {
      const self = {
        to: jest.fn((room) => { calls.push({ op: 'to', room }); return self; }),
        emit: jest.fn((name, payload) => { calls.push({ op: 'emit', name, payload }); }),
      };
      return self;
    };
    fakeIo = emitter();
    // Le module conserve `_io` en variable locale ; on accède à getIO indirectement
    // en le remplaçant via monkey-patching pour cette suite.
    jest.spyOn(socket, 'getIO').mockReturnValue(fakeIo);
    // emitConversationEvent lit `_io` (variable module), pas getIO — donc on
    // doit forcer un io. On expose un helper via require cache.
    const socketModule = require.cache[require.resolve('../socket')];
    if (socketModule) socketModule.exports.__setIoForTest = (io) => { /* not writable directly */ };
  });

  // On ne peut pas remplacer la variable `_io` interne sans hack : on
  // vérifie donc le contrat de retour (no-op quand `_io` est absent) et
  // documente le test d'intégration comme follow-up.
  test('sans _io initialisé, l\'appel est un no-op sûr', () => {
    expect(() => socket.emitConversationEvent('new-staff-message', { hi: 1 }, { conversationTenantId: 't-mila' })).not.toThrow();
    expect(calls).toEqual([]);
  });
});
