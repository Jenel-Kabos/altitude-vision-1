// __tests__/hotelReservationModel.test.js — Sprint C, schéma réel (non mocké).

const HotelReservation = require('../models/HotelReservation');

const HOTEL_ID = '707f1f77bcf86cd799439055';
const CATEGORY_ID = '807f1f77bcf86cd799439066';
const USER_ID = '507f1f77bcf86cd799439012';

const validGuest = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', phone: '+242060000000', country: 'CG' };

const base = (overrides = {}) => new HotelReservation({
  hotel: HOTEL_ID,
  roomCategory: CATEGORY_ID,
  guest: validGuest,
  checkInDate: new Date('2026-08-10T00:00:00Z'),
  checkOutDate: new Date('2026-08-12T00:00:00Z'),
  roomsCount: 1,
  adults: 2,
  unitPrice: 35000,
  subtotal: 70000,
  totalAmount: 70000,
  source: 'public_web',
  createdBy: USER_ID,
  ...overrides,
});

describe('HotelReservation model — dates — TEST DATA', () => {
  test('des dates valides (départ après arrivée) calculent nights automatiquement', async () => {
    const res = base();
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.nights).toBe(2);
  });

  test('checkOutDate égale à checkInDate est rejetée', async () => {
    const res = base({ checkOutDate: new Date('2026-08-10T00:00:00Z') });
    await expect(res.validate()).rejects.toThrow();
  });

  test('checkOutDate antérieure à checkInDate est rejetée', async () => {
    const res = base({ checkOutDate: new Date('2026-08-05T00:00:00Z') });
    await expect(res.validate()).rejects.toThrow();
  });

  test('une seule nuit (1 jour d\'écart) est acceptée et nights=1', async () => {
    const res = base({ checkOutDate: new Date('2026-08-11T00:00:00Z') });
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.nights).toBe(1);
  });
});

describe('HotelReservation model — statuts et transitions — TEST DATA', () => {
  test('status par défaut est "pending"', async () => {
    const res = base();
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.status).toBe('pending');
  });

  test('statuts autorisés : pending/confirmed/cancelled/expired/rejected/checked_in/checked_out (Sprint D)', () => {
    expect(HotelReservation.RESERVATION_STATUSES).toEqual(['pending', 'confirmed', 'cancelled', 'expired', 'rejected', 'checked_in', 'checked_out']);
    // 'no_show' reste hors périmètre — jamais ajouté sans justification.
    expect(HotelReservation.RESERVATION_STATUSES).not.toContain('no_show');
  });

  test('un statut hors enum est rejeté', () => {
    const res = base();
    res.status = 'archived';
    const errors = res.validateSync()?.errors || {};
    expect(errors.status).toBeDefined();
  });

  test('les transitions autorisées sont centralisées et correctes (Sprint C §7 + Sprint D check-in/check-out)', () => {
    expect(HotelReservation.ALLOWED_TRANSITIONS.pending).toEqual(expect.arrayContaining(['confirmed', 'rejected', 'cancelled', 'expired']));
    expect(HotelReservation.ALLOWED_TRANSITIONS.confirmed).toEqual(expect.arrayContaining(['cancelled', 'checked_in']));
    expect(HotelReservation.ALLOWED_TRANSITIONS.checked_in).toEqual(['checked_out']);
    expect(HotelReservation.ALLOWED_TRANSITIONS.checked_out).toEqual([]);
    expect(HotelReservation.ALLOWED_TRANSITIONS.cancelled).toEqual([]);
    expect(HotelReservation.ALLOWED_TRANSITIONS.expired).toEqual([]);
    expect(HotelReservation.ALLOWED_TRANSITIONS.rejected).toEqual([]);
  });

  test('checked_in ne peut plus être annulé (seul checked_out est permis une fois le client présent)', () => {
    expect(HotelReservation.ALLOWED_TRANSITIONS.checked_in).not.toContain('cancelled');
  });

  test('sources autorisées : public_web/owner_dashboard/admin_dashboard', () => {
    expect(HotelReservation.RESERVATION_SOURCES).toEqual(['public_web', 'owner_dashboard', 'admin_dashboard']);
  });
});

describe('HotelReservation model — historique de statut — TEST DATA', () => {
  test('statusHistory accepte des entrées avec from/to/changedBy/reason', async () => {
    const res = base({
      statusHistory: [{ from: null, to: 'pending', changedBy: USER_ID, reason: '' }],
    });
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.statusHistory).toHaveLength(1);
    expect(res.statusHistory[0].to).toBe('pending');
  });

  test('statusHistory est vide par défaut', async () => {
    const res = base();
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.statusHistory).toEqual([]);
  });
});

describe('HotelReservation model — référence lisible — TEST DATA', () => {
  test('buildReservationReference produit le format RES-AAAA-NNNNNN (padding 6 chiffres)', () => {
    expect(HotelReservation.buildReservationReference(1, 2026)).toBe('RES-2026-000001');
    expect(HotelReservation.buildReservationReference(42, 2026)).toBe('RES-2026-000042');
    expect(HotelReservation.buildReservationReference(123456, 2026)).toBe('RES-2026-123456');
  });

  test('reference porte un index unique déclaré au niveau du schéma', () => {
    // Unicité déclarée en option de champ (unique: true) plutôt qu'en index
    // composé — confirmé par la présence de l'option `unique` sur le path.
    expect(HotelReservation.schema.path('reference').options.unique).toBe(true);
  });
});

describe('HotelReservation model — client invité (sans compte) — TEST DATA', () => {
  test('createdBy et guestUser ne sont pas requis (demande publique anonyme, mission §8)', async () => {
    const res = base({ createdBy: undefined, guestUser: undefined });
    await expect(res.validate()).resolves.toBeUndefined();
  });

  test('guest.firstName/lastName/email restent obligatoires même sans compte', async () => {
    const res = base({ guest: { firstName: '', lastName: '', email: '' } });
    await expect(res.validate()).rejects.toThrow();
  });

  test('un email client manifestement invalide est rejeté', async () => {
    const res = base({ guest: { ...validGuest, email: 'pas-un-email' } });
    await expect(res.validate()).rejects.toThrow();
  });
});

describe('HotelReservation model — champs numériques — TEST DATA', () => {
  test('roomsCount doit être au moins 1', () => {
    const res = base({ roomsCount: 0 });
    const errors = res.validateSync()?.errors || {};
    expect(errors.roomsCount).toBeDefined();
  });

  test('adults doit être au moins 1', () => {
    const res = base({ adults: 0 });
    const errors = res.validateSync()?.errors || {};
    expect(errors.adults).toBeDefined();
  });

  test('children accepte 0 par défaut', async () => {
    const res = base();
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.children).toBe(0);
  });

  test('currency par défaut XAF', async () => {
    const res = base();
    await expect(res.validate()).resolves.toBeUndefined();
    expect(res.currency).toBe('XAF');
  });
});

describe('HotelReservation model — index (audit performances §20) — TEST DATA', () => {
  const indexes = HotelReservation.schema.indexes();

  test('un index {hotel, status} existe', () => {
    const idx = indexes.find(([keys]) => keys.hotel === 1 && keys.status === 1);
    expect(idx).toBeDefined();
  });

  test('un index {roomCategory, checkInDate, checkOutDate} existe', () => {
    const idx = indexes.find(([keys]) => keys.roomCategory === 1 && keys.checkInDate === 1 && keys.checkOutDate === 1);
    expect(idx).toBeDefined();
  });

  test('un index {guestUser, createdAt} existe', () => {
    const idx = indexes.find(([keys]) => keys.guestUser === 1 && keys.createdAt === -1);
    expect(idx).toBeDefined();
  });

  test('un index {status, pendingExpiresAt} existe (utilisé par le job d\'expiration)', () => {
    const idx = indexes.find(([keys]) => keys.status === 1 && keys.pendingExpiresAt === 1);
    expect(idx).toBeDefined();
  });
});
