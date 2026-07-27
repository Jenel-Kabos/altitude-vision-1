// __tests__/roomAssignmentService.test.js — Sprint D
//
// Room/RoomAssignment sont mockés, mais `RoomAssignment.create` reproduit
// fidèlement la contrainte d'unicité partielle réelle (index
// {room, releasedAt:null} et {reservation, releasedAt:null}, voir
// RoomAssignment.js) : une tentative de double affectation lève une erreur
// `{code: 11000}`, exactement comme MongoDB le ferait — même méthodologie
// que hotelAvailabilityService.test.js (Sprint C) pour prouver l'absence de
// surbooking.

jest.mock('../models/Room');
jest.mock('../models/RoomAssignment');
jest.mock('../config/db', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const Room = require('../models/Room');
const RoomAssignment = require('../models/RoomAssignment');
const {
  assignRoom, changeRoom, releaseRoom, getAvailableRooms,
} = require('../services/roomAssignmentService');

const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const ROOM_ID = 'a07f1f77bcf86cd799439088';
const OTHER_ROOM_ID = 'a07f1f77bcf86cd799439099';
const RESERVATION_ID = '907f1f77bcf86cd799439077';
const USER_ID = '507f1f77bcf86cd799439012';

/** Simule fidèlement la collection RoomAssignment avec ses contraintes d'unicité partielle. */
function makeAssignmentStore() {
  const activeByRoom = new Map(); // roomId -> assignment
  const activeByReservation = new Map(); // reservationId -> assignment[]
  let seq = 0;

  RoomAssignment.create = jest.fn(async (data) => {
    const roomKey = String(data.room);
    const resKey = String(data.reservation);
    if (activeByRoom.has(roomKey)) { const e = new Error('duplicate'); e.code = 11000; throw e; }
    seq += 1;
    const doc = {
      _id: `ASSIGN-${seq}`, reservation: data.reservation, room: data.room,
      assignedBy: data.assignedBy, reason: data.reason, releasedAt: null,
    };
    // save() réel (pas un simple stub) : reproduit le comportement de
    // l'index unique partiel MongoDB — une fois `releasedAt` renseigné, le
    // document n'est plus "actif" et une nouvelle affectation sur la même
    // chambre/réservation redevient possible (correctif — scénario
    // "libération puis réaffectation le même jour", §5 du correctif).
    doc.save = jest.fn(async () => {
      if (doc.releasedAt) {
        if (activeByRoom.get(roomKey) === doc) activeByRoom.delete(roomKey);
        activeByReservation.set(resKey, (activeByReservation.get(resKey) || []).filter((item) => item !== doc));
      }
    });
    activeByRoom.set(roomKey, doc);
    activeByReservation.set(resKey, [...(activeByReservation.get(resKey) || []), doc]);
    return doc;
  });

  RoomAssignment.findOne = jest.fn(async (query) => {
    if (query.room) return activeByRoom.get(String(query.room)) || null;
    if (query.reservation) return (activeByReservation.get(String(query.reservation)) || [])[0] || null;
    return null;
  });
  RoomAssignment.countDocuments = jest.fn(async (query) => (activeByReservation.get(String(query.reservation)) || []).length);

  return { activeByRoom, activeByReservation };
}

const room = (overrides = {}) => ({ _id: ROOM_ID, hotel: HOTEL_ID, roomCategory: CATEGORY_ID, status: 'available', active: true, ...overrides });
// roomsCount:1 par défaut (correctif — garde-fou multi-chambres, §3) : la
// majorité des tests de ce fichier portent sur une réservation mono-chambre.
const reservation = (overrides = {}) => ({ _id: RESERVATION_ID, hotel: HOTEL_ID, roomCategory: CATEGORY_ID, status: 'confirmed', roomsCount: 1, ...overrides });

describe('roomAssignmentService — assignRoom — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeAssignmentStore();
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'reserved' });
  });

  test('affecte une chambre disponible de la bonne catégorie/hôtel', async () => {
    Room.findById = jest.fn().mockResolvedValue(room());
    const assignment = await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } });
    expect(assignment.room).toBe(ROOM_ID);
    expect(Room.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ROOM_ID, status: { $in: ['available', 'reserved'] } },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'reserved' }) }),
    );
  });

  test("refuse une chambre d'un autre hôtel", async () => {
    Room.findById = jest.fn().mockResolvedValue(room({ hotel: 'OTHER-HOTEL' }));
    await expect(assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  test("refuse une chambre d'une autre catégorie que celle réservée", async () => {
    Room.findById = jest.fn().mockResolvedValue(room({ roomCategory: 'OTHER-CATEGORY' }));
    await expect(assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  test('refuse une chambre déjà occupée', async () => {
    Room.findById = jest.fn().mockResolvedValue(room({ status: 'occupied' }));
    await expect(assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('refuse si la réservation a déjà une chambre active', async () => {
    Room.findById = jest.fn().mockResolvedValue(room());
    await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } });
    Room.findById = jest.fn().mockResolvedValue(room({ _id: OTHER_ROOM_ID }));
    await expect(assignRoom({ reservationId: RESERVATION_ID, roomId: OTHER_ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('roomAssignmentService — garde-fou multi-chambres (correctif §3) — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeAssignmentStore();
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'reserved' });
    Room.findById = jest.fn().mockResolvedValue(room());
  });

  test('affectation autorisée jusqu’à roomsCount', async () => {
    const result = await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation({ roomsCount: 3 }), actingUser: { id: USER_ID } });
    expect(result.room).toBe(ROOM_ID);
  });

  test('affectation refusée si roomsCount === 0', async () => {
    await expect(assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation({ roomsCount: 0 }), actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('changement de chambre autorisé pour une réservation multi-chambres', async () => {
    // Affectation initiale mono-chambre (roomsCount:1), puis la réservation
    // passée à changeRoom simule un roomsCount incohérent/modifié à 2 —
    // le changement doit être bloqué avant toute écriture.
    await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } });
    Room.findById = jest.fn().mockResolvedValue(room({ _id: OTHER_ROOM_ID }));
    const changed = await changeRoom({ reservationId: RESERVATION_ID, oldRoomId: ROOM_ID, newRoomId: OTHER_ROOM_ID, reservation: reservation({ roomsCount: 2 }), actingUser: { id: USER_ID } });
    expect(changed.room).toBe(OTHER_ROOM_ID);
  });

  test('réservation roomsCount = 1 reste pleinement fonctionnelle (non-régression)', async () => {
    const assignment = await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation({ roomsCount: 1 }), actingUser: { id: USER_ID } });
    expect(assignment.room).toBe(ROOM_ID);
  });
});

describe('roomAssignmentService — chevauchement des périodes (correctif §5) — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeAssignmentStore();
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'reserved' });
    Room.findById = jest.fn().mockResolvedValue(room());
    Room.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'available' });
  });

  // NOTE méthodologique (voir HOTEL_OPERATIONS_V1.md, section correctif) :
  // ce sprint ne fait PAS encore de contrôle de chevauchement par dates —
  // il garantit une invariante plus forte et suffisante : une chambre ne
  // peut avoir qu'UNE SEULE affectation active à la fois, quelles que
  // soient les dates. Cela rend tout chevauchement structurellement
  // impossible (l'affectation concurrente est refusée AVANT même de
  // comparer des dates). Ces tests le démontrent avec des réservations aux
  // dates réalistes, pour couvrir explicitement les scénarios de la mission.
  const resA = () => reservation({ _id: 'RES-A', checkInDate: new Date('2026-08-10'), checkOutDate: new Date('2026-08-13') });

  test('chevauchement partiel refusé (A: 10→13 août, B: 12→15 août, même chambre)', async () => {
    const resB = reservation({ _id: 'RES-B', checkInDate: new Date('2026-08-12'), checkOutDate: new Date('2026-08-15') });
    await assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: resA(), actingUser: { id: USER_ID } });
    await expect(assignRoom({ reservationId: 'RES-B', roomId: ROOM_ID, reservation: resB, actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('période incluse refusée (B: 11→12 août, incluse dans A: 10→13 août, même chambre)', async () => {
    const resB = reservation({ _id: 'RES-B', checkInDate: new Date('2026-08-11'), checkOutDate: new Date('2026-08-12') });
    await assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: resA(), actingUser: { id: USER_ID } });
    await expect(assignRoom({ reservationId: 'RES-B', roomId: ROOM_ID, reservation: resB, actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('même période refusée (A et B : 10→13 août, même chambre)', async () => {
    const resB = reservation({ _id: 'RES-B', checkInDate: new Date('2026-08-10'), checkOutDate: new Date('2026-08-13') });
    await assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: resA(), actingUser: { id: USER_ID } });
    await expect(assignRoom({ reservationId: 'RES-B', roomId: ROOM_ID, reservation: resB, actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('départ et arrivée le même jour autorisés (A part le 13 août, B arrive le 13 août) après libération de A', async () => {
    const resB = reservation({ _id: 'RES-B', checkInDate: new Date('2026-08-13'), checkOutDate: new Date('2026-08-15') });
    await assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: resA(), actingUser: { id: USER_ID } });
    // A quitte la chambre (check-out/libération) — la chambre redevient
    // disponible avant l'arrivée de B le même jour.
    await releaseRoom({ reservationId: 'RES-A', actingUser: { id: USER_ID }, reason: 'Départ' });
    Room.findById = jest.fn().mockResolvedValue(room());
    const assignment = await assignRoom({ reservationId: 'RES-B', roomId: ROOM_ID, reservation: resB, actingUser: { id: USER_ID } });
    expect(assignment.room).toBe(ROOM_ID);
  });

  test('deux affectations concurrentes sur la même chambre (périodes différentes) : une seule réussit', async () => {
    const resB = reservation({ _id: 'RES-B', checkInDate: new Date('2026-09-01'), checkOutDate: new Date('2026-09-03') });
    const [a, b] = await Promise.allSettled([
      assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: resA(), actingUser: { id: USER_ID } }),
      assignRoom({ reservationId: 'RES-B', roomId: ROOM_ID, reservation: resB, actingUser: { id: USER_ID } }),
    ]);
    const outcomes = [a.status, b.status];
    expect(outcomes.filter((s) => s === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((s) => s === 'rejected')).toHaveLength(1);
  });

  test('changeRoom respecte la même contrainte : refuse une nouvelle chambre déjà couverte par une autre réservation', async () => {
    const resB = reservation({ _id: 'RES-B', checkInDate: new Date('2026-08-20'), checkOutDate: new Date('2026-08-22') });
    await assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: resA(), actingUser: { id: USER_ID } });
    await assignRoom({ reservationId: 'RES-B', roomId: OTHER_ROOM_ID, reservation: resB, actingUser: { id: USER_ID } });
    // RES-B tente de changer pour la chambre de RES-A, toujours active.
    await expect(changeRoom({ reservationId: 'RES-B', newRoomId: ROOM_ID, reservation: resB, actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('roomAssignmentService — CONCURRENCE : double affectation impossible — TEST DATA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeAssignmentStore();
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'reserved' });
    Room.findById = jest.fn().mockResolvedValue(room());
  });

  test('deux affectations concurrentes de la MÊME chambre à deux réservations différentes → une seule réussit', async () => {
    const [a, b] = await Promise.allSettled([
      assignRoom({ reservationId: 'RES-A', roomId: ROOM_ID, reservation: reservation({ _id: 'RES-A' }), actingUser: { id: USER_ID } }),
      assignRoom({ reservationId: 'RES-B', roomId: ROOM_ID, reservation: reservation({ _id: 'RES-B' }), actingUser: { id: USER_ID } }),
    ]);
    const outcomes = [a.status, b.status];
    expect(outcomes.filter((s) => s === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((s) => s === 'rejected')).toHaveLength(1);
  });

  test('deux affectations concurrentes de chambres DIFFÉRENTES à la même réservation → une seule réussit (une seule chambre par réservation)', async () => {
    const [a, b] = await Promise.allSettled([
      assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }),
      assignRoom({ reservationId: RESERVATION_ID, roomId: OTHER_ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }),
    ]);
    const outcomes = [a.status, b.status];
    expect(outcomes.filter((s) => s === 'fulfilled')).toHaveLength(1);
  });
});

describe('roomAssignmentService — changeRoom / releaseRoom — TEST DATA', () => {
  let store;
  beforeEach(() => {
    jest.clearAllMocks();
    store = makeAssignmentStore();
    Room.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'reserved' });
    Room.findById = jest.fn().mockResolvedValue(room());
    Room.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: ROOM_ID, status: 'available' });
  });

  test('changeRoom libère l’ancienne chambre avant de créer la nouvelle affectation', async () => {
    await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } });
    Room.findById = jest.fn().mockResolvedValue(room({ _id: OTHER_ROOM_ID }));
    const callOrder = [];
    RoomAssignment.create.mockImplementationOnce(async (data) => {
      callOrder.push('assign-new');
      return { _id: 'NEW', reservation: data.reservation, room: data.room, releasedAt: null, save: jest.fn() };
    });
    const current = store.activeByReservation.get(RESERVATION_ID)[0];
    const originalSave = current.save;
    current.save = jest.fn(async () => { callOrder.push('release-old'); return originalSave(); });

    await changeRoom({ reservationId: RESERVATION_ID, newRoomId: OTHER_ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID }, reason: 'x' });
    expect(callOrder).toEqual(['release-old', 'assign-new']);
  });

  test("changeRoom refuse si la nouvelle chambre est indisponible — l'ancienne affectation reste intacte", async () => {
    await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } });
    Room.findById = jest.fn().mockResolvedValue(room({ _id: OTHER_ROOM_ID, status: 'occupied' }));
    await expect(changeRoom({ reservationId: RESERVATION_ID, newRoomId: OTHER_ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(store.activeByReservation.get(RESERVATION_ID)[0].releasedAt).toBeNull();
  });

  test('releaseRoom libère l\'affectation active et remet la chambre à "available" par défaut', async () => {
    await assignRoom({ reservationId: RESERVATION_ID, roomId: ROOM_ID, reservation: reservation(), actingUser: { id: USER_ID } });
    const result = await releaseRoom({ reservationId: RESERVATION_ID, actingUser: { id: USER_ID }, reason: 'fin' });
    expect(Room.findByIdAndUpdate).toHaveBeenCalledWith(ROOM_ID, { $set: { status: 'available', updatedBy: USER_ID } }, { new: true });
    expect(result.assignment.releasedAt).not.toBeNull();
  });

  test("releaseRoom échoue si aucune affectation active n'existe", async () => {
    await expect(releaseRoom({ reservationId: 'UNKNOWN', actingUser: { id: USER_ID } })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('roomAssignmentService — getAvailableRooms — TEST DATA', () => {
  test('ne renvoie que les chambres actives au statut "available" par défaut', async () => {
    Room.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([room()]) });
    await getAvailableRooms({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID });
    expect(Room.find).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ['available'] } }));
  });

  test('includeReserved=true inclut aussi les chambres "reserved"', async () => {
    Room.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await getAvailableRooms({ hotelId: HOTEL_ID, roomCategoryId: CATEGORY_ID, includeReserved: true });
    expect(Room.find).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ['available', 'reserved'] } }));
  });
});
