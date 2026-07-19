import {
  normalizeListingType,
  isPropertyOwner,
  isPropertyAvailable,
  getPropertyPermissions,
  getRentalConditions,
  extractConversation,
  resolveContactErrorMessage,
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
