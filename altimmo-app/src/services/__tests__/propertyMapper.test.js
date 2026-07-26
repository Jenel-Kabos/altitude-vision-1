jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../api';
import {
  normalizeListingType,
  isPropertyOwner,
  isPropertyAvailable,
  getPropertyPermissions,
  getRentalConditions,
  extractConversation,
  resolveContactErrorMessage,
  resolveDetailParams,
  fetchAnnonceDetail,
  getDisplayPrice,
} from '../propertyMapper';

describe('normalizeListingType', () => {
  test('reconnaît le status backend "location" (lowercase, valeur réelle enum)', () => {
    expect(normalizeListingType({ status: 'location' })).toBe('location');
  });

  test('reconnaît le status backend "vente"', () => {
    expect(normalizeListingType({ status: 'vente' })).toBe('vente');
  });

  test('gère les variantes de casse et anciens noms de champs', () => {
    expect(normalizeListingType({ status: 'Location' })).toBe('location');
    expect(normalizeListingType({ transactionType: 'LOCATION' })).toBe('location');
    expect(normalizeListingType({ listingType: 'rent' })).toBe('location');
    expect(normalizeListingType({ category: 'Vente' })).toBe('vente');
  });

  test('retourne null si aucun champ connu ne correspond', () => {
    expect(normalizeListingType({ type: 'Appartement' })).toBeNull();
    expect(normalizeListingType({})).toBeNull();
  });

  test('reconnaît "vente" via transactionType ou category (pas seulement status)', () => {
    expect(normalizeListingType({ transactionType: 'vente' })).toBe('vente');
    expect(normalizeListingType({ category: 'sell' })).toBe('vente');
  });

  test('reconnaît le status backend "hebergement" et ne le confond jamais avec vente/location', () => {
    expect(normalizeListingType({ status: 'hebergement' })).toBe('hebergement');
    expect(normalizeListingType({ status: 'Hebergement' })).toBe('hebergement');
  });
});

describe('isPropertyOwner', () => {
  test('détecte le propriétaire via owner._id peuplé', () => {
    const property = { owner: { _id: 'user-1' } };
    expect(isPropertyOwner(property, { _id: 'user-1' })).toBe(true);
    expect(isPropertyOwner(property, { _id: 'user-2' })).toBe(false);
  });

  test('détecte le propriétaire via owner sous forme d\'ObjectId brut', () => {
    expect(isPropertyOwner({ owner: 'user-1' }, { _id: 'user-1' })).toBe(true);
  });

  test('retourne false si utilisateur non connecté', () => {
    expect(isPropertyOwner({ owner: 'user-1' }, null)).toBe(false);
  });

  test('retourne false si owner absent', () => {
    expect(isPropertyOwner({}, { _id: 'user-1' })).toBe(false);
  });
});

describe('isPropertyAvailable', () => {
  test('indisponible si la propriété elle-même est absente', () => {
    expect(isPropertyAvailable(null)).toBe(false);
    expect(isPropertyAvailable(undefined)).toBe(false);
  });

  test('disponible par défaut si les champs de statut sont absents (rétro-compat)', () => {
    expect(isPropertyAvailable({})).toBe(true);
  });

  test('indisponible si availability n\'est pas "Disponible"', () => {
    expect(isPropertyAvailable({ availability: 'Loué' })).toBe(false);
  });

  test('indisponible ("suspendu") si availability est "Indisponible"', () => {
    expect(isPropertyAvailable({ availability: 'Indisponible' })).toBe(false);
  });

  test('indisponible si statusAdmin n\'est pas "Validée"', () => {
    expect(isPropertyAvailable({ statusAdmin: 'En attente' })).toBe(false);
  });

  test('disponible même si isPublished === false — champ hors sujet (workflow gestion locative séparé)', () => {
    expect(isPropertyAvailable({
      availability: 'Disponible', statusAdmin: 'Validée', isPublished: false,
    })).toBe(true);
  });

  test('disponible quand tous les champs l\'autorisent explicitement', () => {
    expect(isPropertyAvailable({
      availability: 'Disponible', statusAdmin: 'Validée', isPublished: true,
    })).toBe(true);
  });
});

describe('getPropertyPermissions', () => {
  // isPublished: false — état réel de tous les biens en production actuellement
  // (workflow "gestion locative" séparé) ; ne doit pas bloquer la visite.
  const availableProperty = {
    owner: { _id: 'owner-1' },
    availability: 'Disponible',
    statusAdmin: 'Validée',
    isPublished: false,
  };

  test('propriétaire du bien : ni contact ni visite', () => {
    const perms = getPropertyPermissions(availableProperty, { _id: 'owner-1' });
    expect(perms).toEqual({
      canContact: false,
      canRequestVisit: false,
      reason: 'Vous êtes le propriétaire de ce bien.',
    });
  });

  test('client sur bien disponible : contact et visite autorisés', () => {
    const perms = getPropertyPermissions(availableProperty, { _id: 'client-1' });
    expect(perms).toEqual({ canContact: true, canRequestVisit: true, reason: null });
  });

  test('client sur bien indisponible : contact possible, visite refusée avec raison', () => {
    const perms = getPropertyPermissions(
      { ...availableProperty, availability: 'Loué' },
      { _id: 'client-1' },
    );
    expect(perms.canContact).toBe(true);
    expect(perms.canRequestVisit).toBe(false);
    expect(perms.reason).toMatch(/pas.*disponible/i);
  });

  test('utilisateur non connecté sur bien disponible : autorisé (redirection login gérée à l\'écran)', () => {
    const perms = getPropertyPermissions(availableProperty, null);
    expect(perms).toEqual({ canContact: true, canRequestVisit: true, reason: null });
  });
});

describe('getRentalConditions', () => {
  test('retourne un tableau vide si la propriété est absente', () => {
    expect(getRentalConditions(null)).toEqual([]);
    expect(getRentalConditions(undefined)).toEqual([]);
  });

  test('accepte l\'alias "prix" (legacy) en plus de "price"', () => {
    const rows = getRentalConditions({ prix: 250000 });
    expect(rows.find(r => r.key === 'loyer').value).toBe(`${(250000).toLocaleString('fr-FR')} FCFA`);
  });

  test('inclut toujours le loyer, jamais de valeur inventée pour les frais de visite', () => {
    const rows = getRentalConditions({ price: 100000, fraisVisite: 0 });
    const loyer = rows.find(r => r.key === 'loyer');
    const visite = rows.find(r => r.key === 'fraisVisite');
    expect(loyer.value).toBe(`${(100000).toLocaleString('fr-FR')} FCFA`);
    expect(visite.value).toBe('Gratuite');
  });

  test('affiche le vrai montant des frais de visite quand il est positif', () => {
    const rows = getRentalConditions({ price: 100000, fraisVisite: 5000 });
    const visite = rows.find(r => r.key === 'fraisVisite');
    expect(visite.value).toBe(`${(5000).toLocaleString('fr-FR')} FCFA`);
  });

  test('utilise les honoraires manuels saisis en base plutôt que la formule par défaut', () => {
    const rows = getRentalConditions({ price: 100000, honoraires: 42000 });
    const honoraires = rows.find(r => r.key === 'honoraires');
    expect(honoraires.value).toBe(`${(42000).toLocaleString('fr-FR')} FCFA`);
  });

  test('retombe sur la formule par défaut (80% du loyer) si honoraires absent', () => {
    const rows = getRentalConditions({ price: 100000 });
    const honoraires = rows.find(r => r.key === 'honoraires');
    expect(honoraires.value).toBe(`${(80000).toLocaleString('fr-FR')} FCFA`);
  });

  test('n\'affiche pas de ligne caution si cautionMultiplicateur est absent', () => {
    const rows = getRentalConditions({ price: 100000 });
    expect(rows.find(r => r.key === 'caution')).toBeUndefined();
  });

  test('affiche la caution en FCFA et en mois de loyer quand cautionMultiplicateur est fourni', () => {
    const rows = getRentalConditions({ price: 100000, cautionMultiplicateur: 2 });
    const caution = rows.find(r => r.key === 'caution');
    expect(caution.value).toBe(`${(200000).toLocaleString('fr-FR')} FCFA — 2 mois de loyer`);
  });

  test('affiche le profil recherché et les documents requis quand ils sont fournis', () => {
    const rows = getRentalConditions({
      price: 100000,
      profilsLocataireRecherches: ['Salarié', 'Fonctionnaire'],
      documentsRequis: ['CNI', 'Attestation de travail'],
    });
    expect(rows.find(r => r.key === 'profils').value).toBe('Salarié, Fonctionnaire');
    expect(rows.find(r => r.key === 'documents').value).toBe('CNI, Attestation de travail');
  });

  test('n\'affiche pas de ligne profils/documents si les tableaux sont vides', () => {
    const rows = getRentalConditions({ price: 100000, profilsLocataireRecherches: [], documentsRequis: [] });
    expect(rows.find(r => r.key === 'profils')).toBeUndefined();
    expect(rows.find(r => r.key === 'documents')).toBeUndefined();
  });

  test('applique la formule de vente (10%) et non celle de location (80%) pour une annonce en vente', () => {
    const rows = getRentalConditions({ price: 100000, status: 'vente' });
    const honoraires = rows.find(r => r.key === 'honoraires');
    expect(honoraires.value).toBe(`${(10000).toLocaleString('fr-FR')} FCFA`);
  });

  test('applique la formule de location (80%) par défaut si le type n\'est pas déterminable', () => {
    const rows = getRentalConditions({ price: 100000 });
    const honoraires = rows.find(r => r.key === 'honoraires');
    expect(honoraires.value).toBe(`${(80000).toLocaleString('fr-FR')} FCFA`);
  });

  test('un hébergement ne contient jamais de vocabulaire de bail (loyer, caution locative, honoraires, profils, documents)', () => {
    const rows = getRentalConditions({
      status: 'hebergement',
      price: 100000,
      accommodation: {
        accommodationType: 'villa_meublee',
        checkInTime: '14:00', checkOutTime: '11:00',
        securityDeposit: 20000, cleaningFee: 5000,
        rates: [{ mode: 'nightly', amount: 35000 }],
      },
    });
    expect(rows.find(r => r.key === 'loyer')).toBeUndefined();
    expect(rows.find(r => r.key === 'caution')).toBeUndefined();
    expect(rows.find(r => r.key === 'honoraires')).toBeUndefined();
    expect(rows.find(r => r.key === 'profils')).toBeUndefined();
    expect(rows.find(r => r.key === 'documents')).toBeUndefined();
    expect(rows.find(r => r.key === 'caution-sejour').value).toBe(`${(20000).toLocaleString('fr-FR')} FCFA`);
    expect(rows.find(r => r.key === 'rate-nightly').value).toBe(`${(35000).toLocaleString('fr-FR')} FCFA`);
  });

  test('un hébergement sans profil Accommodation (bien en attente de configuration) ne casse pas et retourne un tableau vide', () => {
    expect(getRentalConditions({ status: 'hebergement', price: 100000 })).toEqual([]);
  });
});

describe('extractConversation', () => {
  test('extrait la conversation quand la réponse est valide', () => {
    const response = { data: { data: { conversation: { _id: 'conv-1', lastMessage: 'salut' } } } };
    expect(extractConversation(response)).toEqual({ _id: 'conv-1', lastMessage: 'salut' });
  });

  test('retourne null si la conversation est absente', () => {
    expect(extractConversation({ data: { data: {} } })).toBeNull();
  });

  test('retourne null si la conversation n\'a pas de _id (réponse 200 malformée)', () => {
    expect(extractConversation({ data: { data: { conversation: {} } } })).toBeNull();
  });

  test('retourne null si la réponse est vide', () => {
    expect(extractConversation({})).toBeNull();
    expect(extractConversation(undefined)).toBeNull();
  });
});

describe('resolveContactErrorMessage', () => {
  test('utilise le message backend quand disponible', () => {
    const err = { response: { data: { message: 'Vous ne pouvez pas contacter ce bien.' } } };
    expect(resolveContactErrorMessage(err)).toBe('Vous ne pouvez pas contacter ce bien.');
  });

  test('détecte une erreur réseau (requête envoyée, aucune réponse reçue)', () => {
    const err = { request: {} };
    expect(resolveContactErrorMessage(err)).toBe('Connexion impossible. Vérifiez votre réseau puis réessayez.');
  });

  test('retombe sur un message générique sans exposer l\'erreur Axios brute', () => {
    const err = { message: 'AxiosError: Network Error at line 42 in internal module' };
    expect(resolveContactErrorMessage(err)).toBe("Impossible d'ouvrir la messagerie.");
  });
});

describe('resolveDetailParams', () => {
  test('convention canonique déjà fournie : passe-plat', () => {
    const item = { _id: 'p1' };
    expect(resolveDetailParams({ resourceType: 'accommodation', resourceId: 'a1', item }))
      .toEqual({ resourceType: 'accommodation', resourceId: 'a1', item });
  });

  test('navigation historique { annonce } : objet complet, resourceType toujours "property"', () => {
    const annonce = { _id: 'p1', price: 100000 };
    expect(resolveDetailParams({ annonce })).toEqual({ resourceType: 'property', resourceId: 'p1', item: annonce });
  });

  test('navigation historique { annonce } avec "id" plutôt que "_id"', () => {
    const annonce = { id: 'p2' };
    expect(resolveDetailParams({ annonce })).toEqual({ resourceType: 'property', resourceId: 'p2', item: annonce });
  });

  test('deep-link { propertyId } seul : pas d\'item, resourceType "property"', () => {
    expect(resolveDetailParams({ propertyId: 'p3' })).toEqual({ resourceType: 'property', resourceId: 'p3', item: null });
  });

  test('{ accommodationId } seul : resourceType "accommodation"', () => {
    expect(resolveDetailParams({ accommodationId: 'a2' })).toEqual({ resourceType: 'accommodation', resourceId: 'a2', item: null });
  });

  test('notification push { id } seul : traité comme "property"', () => {
    expect(resolveDetailParams({ id: 'p4' })).toEqual({ resourceType: 'property', resourceId: 'p4', item: null });
  });

  test('aucun identifiant exploitable : tout à null (pas de crash)', () => {
    expect(resolveDetailParams({})).toEqual({ resourceType: null, resourceId: null, item: null });
    expect(resolveDetailParams(undefined)).toEqual({ resourceType: null, resourceId: null, item: null });
  });
});

describe('fetchAnnonceDetail', () => {
  afterEach(() => jest.clearAllMocks());

  test('appelle GET /properties/:id pour resourceType="property"', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { property: { _id: 'p1' } } } });
    const result = await fetchAnnonceDetail({ resourceType: 'property', resourceId: 'p1' });
    expect(api.get).toHaveBeenCalledWith('/properties/p1');
    expect(result).toEqual({ _id: 'p1' });
  });

  test('appelle GET /accommodations/public/:id pour resourceType="accommodation"', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { property: { _id: 'p1', accommodationId: 'a1' } } } });
    await fetchAnnonceDetail({ resourceType: 'accommodation', resourceId: 'a1' });
    expect(api.get).toHaveBeenCalledWith('/accommodations/public/a1');
  });

  test('lève une erreur explicite si resourceType/resourceId manquent (jamais un appel API silencieux)', async () => {
    await expect(fetchAnnonceDetail({ resourceType: null, resourceId: null })).rejects.toThrow();
    expect(api.get).not.toHaveBeenCalled();
  });

  test('lève une erreur si la réponse ne contient pas de property (ex. 404)', async () => {
    api.get.mockResolvedValueOnce({ data: { data: {} } });
    await expect(fetchAnnonceDetail({ resourceType: 'property', resourceId: 'p1' })).rejects.toThrow();
  });

  test('propage l\'erreur (ex. 404 HTTP) à l\'appelant sans la masquer', async () => {
    const err = { response: { status: 404 } };
    api.get.mockRejectedValueOnce(err);
    await expect(fetchAnnonceDetail({ resourceType: 'property', resourceId: 'p1' })).rejects.toBe(err);
  });
});

describe('getDisplayPrice', () => {
  test('propriété absente : pas de prix, jamais de crash', () => {
    expect(getDisplayPrice(undefined)).toEqual({ amount: 0, hasPrice: false, suffix: '' });
  });

  test('vente : prix brut, sans suffixe', () => {
    expect(getDisplayPrice({ status: 'vente', price: 50000000 })).toEqual({ amount: 50000000, hasPrice: true, suffix: '' });
  });

  test('location : prix avec suffixe "/ mois"', () => {
    expect(getDisplayPrice({ status: 'location', price: 250000 })).toEqual({ amount: 250000, hasPrice: true, suffix: '/ mois' });
  });

  test('prix absent ou nul : hasPrice=false ("Prix sur demande" côté écran), jamais 0 affiché comme un vrai prix', () => {
    expect(getDisplayPrice({ status: 'vente', price: 0 })).toEqual({ amount: 0, hasPrice: false, suffix: '' });
    expect(getDisplayPrice({ status: 'location' })).toEqual({ amount: 0, hasPrice: false, suffix: '' });
  });

  test('hébergement : priorise le tarif nightly de accommodation.rates', () => {
    const property = {
      status: 'hebergement',
      price: 999999,
      accommodation: { rates: [{ mode: 'monthly', amount: 400000 }, { mode: 'nightly', amount: 35000 }] },
    };
    expect(getDisplayPrice(property)).toEqual({ amount: 35000, hasPrice: true, suffix: '/ nuit' });
  });

  test('hébergement sans rates : retombe sur price si positif', () => {
    expect(getDisplayPrice({ status: 'hebergement', price: 30000 })).toEqual({ amount: 30000, hasPrice: true, suffix: '' });
  });

  test('hébergement sans rates ni price : "Prix sur demande", jamais inventé', () => {
    expect(getDisplayPrice({ status: 'hebergement' })).toEqual({ amount: 0, hasPrice: false, suffix: '' });
  });
});
