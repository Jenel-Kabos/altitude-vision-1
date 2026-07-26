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
    "%s est un établissement Hotel en 'room_based'",
    async (type) => {
      const acc = base({ accommodationType: type, hotel: HOTEL_ID });
      await expect(acc.validate()).resolves.toBeUndefined();
      expect(acc.occupancyMode).toBe('room_based');
    },
  );

  test.each(['hotel', 'residence_hoteliere', 'chambre_hotes'])(
    '%s sans référence Hotel est rejeté',
    async (type) => {
      const acc = base({ accommodationType: type });
      await expect(acc.validate()).rejects.toThrow();
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

describe('Accommodation model — Sprint B1 (équipements/règles/services/galerie/suspendu) — TEST DATA', () => {
  test('amenities/rules/includedServices ont des valeurs par défaut cohérentes', async () => {
    const acc = base({ accommodationType: 'villa_meublee' });
    await acc.validate();
    expect(acc.amenities.cuisine).toEqual([]);
    expect(acc.amenities.securite).toEqual([]);
    expect(acc.rules.childrenAllowed).toBe(true);
    expect(acc.rules.petsAllowed).toBe(false);
    expect(acc.rules.minimumAge).toBe(0);
    expect(acc.includedServices.menage).toBe(false);
    expect(acc.gallery).toEqual([]);
    expect(acc.active).toBe(true);
  });

  test('amenities accepte des valeurs libres par catégorie (pas d\'enum strict serveur)', async () => {
    const acc = base({
      accommodationType: 'appartement_meuble',
      amenities: { cuisine: ['Four', 'Réfrigérateur'], internet: ['Wifi'] },
    });
    await expect(acc.validate()).resolves.toBeUndefined();
    expect(acc.amenities.cuisine).toEqual(['Four', 'Réfrigérateur']);
  });

  test("publicationStatus accepte désormais 'suspendu'", async () => {
    const acc = base({ accommodationType: 'villa_meublee', publicationStatus: 'suspendu' });
    await expect(acc.validate()).resolves.toBeUndefined();
  });

  test('publicationStatus rejette toute valeur hors enum', () => {
    const acc = base({ accommodationType: 'villa_meublee' });
    acc.publicationStatus = 'archive';
    const errors = acc.validateSync()?.errors || {};
    expect(errors.publicationStatus).toBeDefined();
  });

  test('gallery exige une url par entrée', () => {
    const acc = base({ accommodationType: 'villa_meublee', gallery: [{ type: 'photo' }] });
    const errors = acc.validateSync()?.errors || {};
    expect(Object.keys(errors).some((k) => k.startsWith('gallery'))).toBe(true);
  });
});
