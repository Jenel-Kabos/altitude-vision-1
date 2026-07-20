// __tests__/accommodationModel.test.js — invariants du schéma réel
// (non mocké), notamment occupancyMode ⟺ accommodationType (Sprint Hôtel).

const Accommodation = require('../models/Accommodation');

const PROPERTY_ID = '507f191e810c19729de860ea';
const HOTEL_ID = '707f1f77bcf86cd799439055';
const USER_ID = '507f1f77bcf86cd799439012';

const base = (overrides = {}) => new Accommodation({
  property: PROPERTY_ID,
  createdBy: USER_ID,
  checkInTime: '14:00',
  checkOutTime: '11:00',
  ...overrides,
});

describe('Accommodation model — occupancyMode ⟺ accommodationType (Sprint Hôtel) — TEST DATA', () => {
  test("accommodationType='hotel' force occupancyMode à 'room_based', même si 'entire_place' est envoyé explicitement", async () => {
    const acc = base({ accommodationType: 'hotel', hotel: HOTEL_ID, occupancyMode: 'entire_place' });
    await expect(acc.validate()).resolves.toBeUndefined();
    expect(acc.occupancyMode).toBe('room_based');
  });

  test("un type meublé classique (villa_meublee) reste en 'entire_place', même si 'room_based' est envoyé explicitement", async () => {
    const acc = base({ accommodationType: 'villa_meublee', occupancyMode: 'room_based' });
    await expect(acc.validate()).resolves.toBeUndefined();
    expect(acc.occupancyMode).toBe('entire_place');
  });

  test('la valeur par défaut (aucun envoi) reste entire_place pour un type non-hôtel', async () => {
    const acc = base({ accommodationType: 'studio_meuble' });
    await expect(acc.validate()).resolves.toBeUndefined();
    expect(acc.occupancyMode).toBe('entire_place');
  });

  test.each(['residence_hoteliere', 'chambre_hotes'])(
    "%s (établissement de type hôtelier mais hors périmètre Hotel) reste en 'entire_place'",
    async (type) => {
      const acc = base({ accommodationType: type });
      await expect(acc.validate()).resolves.toBeUndefined();
      expect(acc.occupancyMode).toBe('entire_place');
    },
  );

  test("changer un Accommodation existant de villa_meublee vers hotel bascule occupancyMode à room_based à la prochaine validation", async () => {
    const acc = base({ accommodationType: 'villa_meublee' });
    await acc.validate();
    expect(acc.occupancyMode).toBe('entire_place');

    acc.accommodationType = 'hotel';
    acc.hotel = HOTEL_ID;
    await acc.validate();
    expect(acc.occupancyMode).toBe('room_based');
  });

  test("changer un Accommodation existant de hotel vers un type meublé rebascule occupancyMode à entire_place", async () => {
    const acc = base({ accommodationType: 'hotel', hotel: HOTEL_ID });
    await acc.validate();
    expect(acc.occupancyMode).toBe('room_based');

    acc.accommodationType = 'maison_meublee';
    acc.hotel = null;
    await acc.validate();
    expect(acc.occupancyMode).toBe('entire_place');
  });

  test("accommodationType='hotel' sans référence hotel est rejeté par le schéma (défense en profondeur)", async () => {
    const acc = base({ accommodationType: 'hotel' });
    await expect(acc.validate()).rejects.toThrow();
  });

  test("accommodationType='hotel' avec une référence hotel valide passe la validation", async () => {
    const acc = base({ accommodationType: 'hotel', hotel: HOTEL_ID });
    await expect(acc.validate()).resolves.toBeUndefined();
  });

  test("un type non-hôtel n'exige aucune référence hotel", async () => {
    const acc = base({ accommodationType: 'villa_meublee' });
    await expect(acc.validate()).resolves.toBeUndefined();
  });

  test('un occupancyMode hors enum reste rejeté par le schéma (aucune valeur libre)', () => {
    const acc = base({ accommodationType: 'villa_meublee' });
    // validateSync() ne déclenche pas le hook pre('validate') (réservé à
    // validate()/save()) — utile ici pour vérifier que le champ conserve
    // bien une contrainte enum stricte au niveau schéma, indépendamment du hook.
    acc.occupancyMode = 'a_la_carte';
    const errors = acc.validateSync()?.errors || {};
    expect(errors.occupancyMode).toBeDefined();
  });
});
