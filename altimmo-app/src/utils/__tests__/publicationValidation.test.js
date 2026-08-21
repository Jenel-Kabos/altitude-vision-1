import {
  getPropertyVisibleFields, sanitizePropertyFieldsForType,
  salePropertySchema, rentalPropertySchema, accommodationSchema,
} from '../publicationValidation';

describe('getPropertyVisibleFields', () => {
  test('Terrain masque chambres ET salles de bain', () => {
    expect(getPropertyVisibleFields('Terrain')).toEqual({ bedrooms: false, bathrooms: false });
  });

  test('Entrepôt masque uniquement les chambres', () => {
    expect(getPropertyVisibleFields('Entrepôt')).toEqual({ bedrooms: false, bathrooms: true });
  });

  test('Parcelle masque chambres ET salles de bain, comme Terrain', () => {
    expect(getPropertyVisibleFields('Parcelle')).toEqual({ bedrooms: false, bathrooms: false });
  });

  test('Appartement affiche chambres et salles de bain', () => {
    expect(getPropertyVisibleFields('Appartement')).toEqual({ bedrooms: true, bathrooms: true });
  });

  test('Bureau et Commerce masquent les chambres', () => {
    expect(getPropertyVisibleFields('Bureau').bedrooms).toBe(false);
    expect(getPropertyVisibleFields('Commerce').bedrooms).toBe(false);
  });
});

describe('sanitizePropertyFieldsForType', () => {
  test('passer à Terrain remet chambres et salles de bain à 0 (jamais conservées cachées)', () => {
    const form = { bedrooms: 3, bathrooms: 2, surface: 500 };
    const next = sanitizePropertyFieldsForType(form, 'Terrain');
    expect(next).toEqual({ bedrooms: 0, bathrooms: 0, surface: 500, type: 'Terrain' });
  });

  test('passer à Entrepôt ne remet à 0 que les chambres', () => {
    const form = { bedrooms: 3, bathrooms: 2 };
    const next = sanitizePropertyFieldsForType(form, 'Entrepôt');
    expect(next.bedrooms).toBe(0);
    expect(next.bathrooms).toBe(2);
  });

  test('passer à Parcelle remet chambres et salles de bain à 0, comme Terrain', () => {
    const form = { bedrooms: 3, bathrooms: 2, surface: 500 };
    const next = sanitizePropertyFieldsForType(form, 'Parcelle');
    expect(next).toEqual({ bedrooms: 0, bathrooms: 0, surface: 500, type: 'Parcelle' });
  });

  test('passer à Appartement conserve les valeurs existantes', () => {
    const form = { bedrooms: 3, bathrooms: 2 };
    const next = sanitizePropertyFieldsForType(form, 'Appartement');
    expect(next.bedrooms).toBe(3);
    expect(next.bathrooms).toBe(2);
  });
});

describe('salePropertySchema.validateStep', () => {
  const baseForm = { titre: 'Villa', description: 'Belle villa', type: 'Villa', ville: 'Brazzaville', arrondissement: 'Bacongo', surface: 200, prix: 50000000 };

  test('étape info : titre/description/type requis', () => {
    expect(salePropertySchema.validateStep('info', { form: { titre: '', description: '', type: '' }, photos: [] }))
      .toEqual({ titre: expect.any(String), description: expect.any(String), type: expect.any(String) });
  });

  test('étape info valide ne retourne aucune erreur', () => {
    expect(salePropertySchema.validateStep('info', { form: baseForm, photos: [] })).toEqual({});
  });

  test('étape price : prix invalide ou nul rejeté', () => {
    expect(salePropertySchema.validateStep('price', { form: { ...baseForm, prix: 0 }, photos: [] }).prix).toBeDefined();
    expect(salePropertySchema.validateStep('price', { form: { ...baseForm, prix: '' }, photos: [] }).prix).toBeDefined();
  });

  test('étape photos : au moins une photo requise', () => {
    expect(salePropertySchema.validateStep('photos', { form: baseForm, photos: [] }).photos).toBeDefined();
    expect(salePropertySchema.validateStep('photos', { form: baseForm, photos: [{ uri: 'x' }] })).toEqual({});
  });

  test('type "Parcelle" est accepté à l\'étape info (nouveau type, ne bloque pas la publication)', () => {
    expect(salePropertySchema.validateStep('info', { form: { ...baseForm, type: 'Parcelle' }, photos: [] })).toEqual({});
  });
});

describe('rentalPropertySchema.validateStep', () => {
  const baseForm = {
    titre: 'Appart', description: 'Meublé', type: 'Appartement meublé',
    ville: 'Brazzaville', arrondissement: 'Bacongo', surface: 60, prix: 150000, cautionMultiplicateur: 2,
  };

  test('étape price : loyer requis + caution bornée 0-6', () => {
    expect(rentalPropertySchema.validateStep('price', { form: { ...baseForm, prix: 0 }, photos: [] }).prix).toBeDefined();
    expect(rentalPropertySchema.validateStep('price', { form: { ...baseForm, cautionMultiplicateur: 8 }, photos: [] }).cautionMultiplicateur).toBeDefined();
    expect(rentalPropertySchema.validateStep('price', { form: baseForm, photos: [] })).toEqual({});
  });
});

describe('accommodationSchema.validateStep', () => {
  const baseForm = {
    titre: 'Villa meublée', description: 'Belle villa', accommodationType: 'villa_meublee',
    ville: 'Brazzaville', arrondissement: 'Bacongo', surface: 200, bathrooms: 1, capaciteAdultes: 2, tarifNuit: 35000,
  };

  test('étape features : surface requise', () => {
    expect(accommodationSchema.validateStep('features', { form: { ...baseForm, surface: '' }, photos: [] }).surface).toBeDefined();
  });

  test('étape info : catégorie hébergement requise (pas de "type" Property)', () => {
    expect(accommodationSchema.validateStep('info', { form: { ...baseForm, accommodationType: '' }, photos: [] }).accommodationType).toBeDefined();
  });

  test('étape features : salle de bain obligatoire (>0), capacité adultes obligatoire', () => {
    expect(accommodationSchema.validateStep('features', { form: { ...baseForm, bathrooms: 0 }, photos: [] }).bathrooms).toBeDefined();
    expect(accommodationSchema.validateStep('features', { form: { ...baseForm, capaciteAdultes: 0 }, photos: [] }).capaciteAdultes).toBeDefined();
    expect(accommodationSchema.validateStep('features', { form: baseForm, photos: [] })).toEqual({});
  });

  test('étape price : tarif par nuit requis', () => {
    expect(accommodationSchema.validateStep('price', { form: { ...baseForm, tarifNuit: 0 }, photos: [] }).tarifNuit).toBeDefined();
  });
});
