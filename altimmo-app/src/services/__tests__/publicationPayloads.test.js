import {
  buildSalePropertyPayload, buildRentalPropertyPayload,
  buildAccommodationPropertyPayload, buildAccommodationProfilePayload, buildAccommodationRatePayload,
  buildHotelPropertyPayload, buildHotelProfilePayload,
} from '../publicationPayloads';

const photoUrls = ['https://res.cloudinary.com/x/a.jpg', 'https://res.cloudinary.com/x/b.jpg'];

describe('buildSalePropertyPayload', () => {
  const form = {
    titre: '  Villa  ', description: 'Belle villa', type: 'Villa',
    ville: 'Brazzaville', arrondissement: 'Bacongo', rue: '', surface: '200',
    bedrooms: 3, bathrooms: 2, livingRooms: 1, kitchens: 1, amenities: ['Parking'],
    prix: '50000000', honoraires: '', fraisVisite: '',
    // champs Location — ne doivent jamais fuiter dans un payload Vente
    cautionMultiplicateur: 2, profilsLocataireRecherches: ['Salarié'], documentsRequis: ['CNI'],
  };

  test('impose categorie=vente, jamais laissé au choix libre', () => {
    expect(buildSalePropertyPayload(form, photoUrls).categorie).toBe('vente');
  });

  test("n'envoie aucun champ caché spécifique Location (cautionMultiplicateur/profils/documents)", () => {
    const payload = buildSalePropertyPayload(form, photoUrls);
    expect(payload.cautionMultiplicateur).toBeUndefined();
    expect(payload.profilsLocataireRecherches).toBeUndefined();
    expect(payload.documentsRequis).toBeUndefined();
  });

  test('normalise les nombres (surface/prix/chambres en string ou number → Number)', () => {
    const payload = buildSalePropertyPayload(form, photoUrls);
    expect(payload.superficie).toBe(200);
    expect(payload.prix).toBe(50000000);
    expect(payload.chambres).toBe(3);
    expect(typeof payload.superficie).toBe('number');
  });

  test('supprime les valeurs vides (rue/honoraires/fraisVisite non renseignés)', () => {
    const payload = buildSalePropertyPayload(form, photoUrls);
    expect(payload.rue).toBeUndefined();
    expect(payload.honoraires).toBeUndefined();
    expect(payload.fraisVisite).toBeUndefined();
  });

  test('transmet les photos déjà uploadées telles quelles', () => {
    expect(buildSalePropertyPayload(form, photoUrls).photos).toEqual(photoUrls);
  });

  test('titre trim (identifiant texte propre, jamais une valeur brute non nettoyée)', () => {
    expect(buildSalePropertyPayload(form, photoUrls).titre).toBe('Villa');
  });
});

describe('buildRentalPropertyPayload', () => {
  const form = {
    titre: 'Appart meublé', description: 'Meublé', type: 'Appartement meublé',
    ville: 'Brazzaville', arrondissement: 'Bacongo', surface: '60',
    bedrooms: 2, bathrooms: 1, prix: '150000',
    cautionMultiplicateur: 3, profilsLocataireRecherches: ['Salarié'], documentsRequis: ['CNI'],
  };

  test('impose categorie=location', () => {
    expect(buildRentalPropertyPayload(form, photoUrls).categorie).toBe('location');
  });

  test('inclut les champs spécifiques location (caution/profils/documents)', () => {
    const payload = buildRentalPropertyPayload(form, photoUrls);
    expect(payload.cautionMultiplicateur).toBe(3);
    expect(payload.profilsLocataireRecherches).toEqual(['Salarié']);
    expect(payload.documentsRequis).toEqual(['CNI']);
  });

  test('tableaux vides supprimés du payload (jamais envoyés comme [])', () => {
    const payload = buildRentalPropertyPayload({ ...form, profilsLocataireRecherches: [], documentsRequis: [] }, photoUrls);
    expect(payload.profilsLocataireRecherches).toBeUndefined();
    expect(payload.documentsRequis).toBeUndefined();
  });
});

describe('buildAccommodationPropertyPayload / buildAccommodationProfilePayload / buildAccommodationRatePayload', () => {
  const form = {
    titre: 'Villa meublée', description: 'Belle villa', type: 'Villa',
    ville: 'Brazzaville', arrondissement: 'Bacongo',
    bedrooms: 2, bathrooms: 1,
    accommodationType: 'villa_meublee', furnished: true,
    capaciteAdultes: 4, capaciteEnfants: 2, beds: 3,
    checkInTime: '14:00', checkOutTime: '11:00',
    tarifNuit: '35000', securityDeposit: '', cleaningFee: '5000',
    accommodationAmenities: { internet: ['Wifi'], cuisine: [] },
  };

  test('le Property créé pour un hébergement impose categorie=hebergement', () => {
    expect(buildAccommodationPropertyPayload(form, photoUrls).categorie).toBe('hebergement');
  });

  test('la catégorie pilote un Property.type canonique et le tarif unique alimente Property.prix', () => {
    const payload = buildAccommodationPropertyPayload({ ...form, type: '', tarifNuit: '35000' }, photoUrls);
    expect(payload.type).toBe('Villa');
    expect(payload.prix).toBe(35000);
  });

  test('le profil Accommodation normalise capacity en objet {maxAdults,maxChildren}', () => {
    const payload = buildAccommodationProfilePayload(form);
    expect(payload.capacity).toEqual({ maxAdults: 4, maxChildren: 2 });
  });

  test('le profil Accommodation ne conserve pas les catégories vides ({cuisine: []})', () => {
    const payload = buildAccommodationProfilePayload(form);
    expect(payload.amenities.cuisine).toEqual([]); // conservé tel quel (objet, pas de strip récursif)
    expect(payload.amenities.internet).toEqual(['Wifi']);
  });

  test('securityDeposit vide absent du payload, cleaningFee normalisé en nombre', () => {
    const payload = buildAccommodationProfilePayload(form);
    expect(payload.securityDeposit).toBeUndefined();
    expect(payload.cleaningFee).toBe(5000);
  });

  test('le tarif est toujours envoyé en mode nightly (seul mode câblé côté backend mobile)', () => {
    expect(buildAccommodationRatePayload(form)).toEqual({ mode: 'nightly', amount: 35000, currency: 'XAF' });
  });
});

describe('builders Établissement hôtelier', () => {
  const form = {
    establishmentName: ' Hôtel Panorama ', description: 'Centre-ville',
    accommodationType: 'hotel', ville: 'Brazzaville', arrondissement: 'Poto-Poto',
    tarifNuit: '45000', capaciteAdultes: 80, starRating: '3', hasReception: true,
    hotelServices: { wifi: true, restaurant: false }, checkInTime: '14:00', checkOutTime: '11:00',
  };

  test('utilise le type Property canonique existant et le même montant que RatePlan', () => {
    const property = buildHotelPropertyPayload(form, photoUrls);
    expect(property.type).toBe('Commerce');
    expect(property.prix).toBe(buildAccommodationRatePayload(form).amount);
    expect(property.chambres).toBe(0);
    expect(property.bathrooms).toBe(0);
  });

  test('n’envoie aucun champ résidentiel dans le profil hôtelier', () => {
    const profile = buildHotelProfilePayload({ ...form, beds: 12, securityDeposit: 50000, accommodationAmenities: { cuisine: ['Four'] } });
    expect(profile.hotel.name).toBe('Hôtel Panorama');
    expect(profile.hotel.starRating).toBe(3);
    expect(profile.beds).toBeUndefined();
    expect(profile.securityDeposit).toBeUndefined();
    expect(profile.amenities).toBeUndefined();
  });
});
