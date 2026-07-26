// Normalisation centralisée des annonces (Property) côté mobile.
// Le backend reste la source de vérité : ce module ne fait qu'interpréter
// de façon cohérente des champs déjà renvoyés par l'API, sans inventer de règle.

import api from './api';

const HEBERGEMENT_KEYWORDS = ['hebergement', 'hébergement'];
const LOCATION_KEYWORDS = ['location', 'louer', 'rent', 'renting'];
const VENTE_KEYWORDS    = ['vente', 'vendre', 'sale', 'sell'];

/**
 * Normalise le "listingType" d'un bien à partir des différents noms de champs
 * legacy possibles (status, transactionType, category, listingType).
 * Retourne 'location' | 'vente' | 'hebergement' | null.
 * L'ordre de test importe : hébergement est vérifié avant location/vente pour
 * éviter tout chevauchement de mot-clé.
 */
export function normalizeListingType(property) {
  const candidates = [
    property?.status,
    property?.transactionType,
    property?.listingType,
    property?.category,
  ];
  for (const raw of candidates) {
    const v = (raw || '').toString().trim().toLowerCase();
    if (!v) continue;
    if (HEBERGEMENT_KEYWORDS.some((k) => v.includes(k))) return 'hebergement';
    if (LOCATION_KEYWORDS.some((k) => v.includes(k))) return 'location';
    if (VENTE_KEYWORDS.some((k) => v.includes(k)))    return 'vente';
  }
  return null;
}

/** L'utilisateur courant est-il le propriétaire de ce bien ? */
export function isPropertyOwner(property, user) {
  const ownerId = property?.owner?._id || property?.owner || null;
  const userId  = user?._id || null;
  if (!ownerId || !userId) return false;
  return ownerId.toString() === userId.toString();
}

/**
 * Un bien est considéré disponible pour une action (contact, visite) quand
 * ces champs backend l'autorisent. Absence de champ = pas de blocage
 * (rétro-compatibilité avec d'anciennes fiches qui ne les renseignent pas).
 *
 * `isPublished` est volontairement ignoré ici : ce champ appartient au
 * sous-workflow "gestion locative" (rentalListingSyncService.js) et ne
 * reflète pas la visibilité publique générale — GET /properties ne filtre
 * pas dessus. Un bien validé (statusAdmin) et disponible (availability)
 * peut légitimement avoir isPublished=false ; l'utiliser ici bloquait à
 * tort la visite sur 100% des biens réels.
 */
export function isPropertyAvailable(property) {
  if (!property) return false;
  if (property.availability && property.availability !== 'Disponible') return false;
  if (property.statusAdmin && property.statusAdmin !== 'Validée') return false;
  return true;
}

/**
 * Permissions d'action calculées pour l'écran de détail : contact et demande
 * de visite. `reason` fournit un message affichable si l'action est refusée.
 */
export function getPropertyPermissions(property, user) {
  const owner     = isPropertyOwner(property, user);
  const available = isPropertyAvailable(property);

  if (owner) {
    return {
      canContact: false,
      canRequestVisit: false,
      reason: 'Vous êtes le propriétaire de ce bien.',
    };
  }
  if (!available) {
    return {
      canContact: true,
      canRequestVisit: false,
      reason: "Ce bien n'est actuellement pas disponible pour une visite.",
    };
  }
  return { canContact: true, canRequestVisit: true, reason: null };
}

const ACCOMMODATION_TYPE_LABELS = {
  villa_meublee: 'Villa meublée',
  maison_meublee: 'Maison meublée',
  appartement_meuble: 'Appartement meublé',
  studio_meuble: 'Studio meublé',
  residence_meublee: 'Résidence meublée',
  bungalow: 'Bungalow',
};

const RATE_MODE_LABELS = { nightly: 'Tarif / nuit', weekly: 'Tarif / semaine', monthly: 'Tarif / mois', yearly: 'Tarif / an' };

/**
 * Conditions de séjour Hébergement — jamais de vocabulaire de bail (loyer,
 * caution locative, mandat, profils locataire, documents de bail). Le champ
 * "Caution" y a un libellé distinct : "Caution de séjour".
 */
function getAccommodationConditions(property) {
  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
  const acc = property.accommodation;
  const rows = [];
  if (!acc) return rows;

  if (acc.accommodationType) {
    rows.push({ key: 'type', label: 'Formule', value: ACCOMMODATION_TYPE_LABELS[acc.accommodationType] || acc.accommodationType });
  }
  if (Array.isArray(acc.rates)) {
    acc.rates.forEach((r) => {
      rows.push({ key: `rate-${r.mode}`, label: RATE_MODE_LABELS[r.mode] || r.mode, value: `${fmt(r.amount)} FCFA` });
    });
  }
  if (acc.checkInTime || acc.checkOutTime) {
    rows.push({ key: 'horaires', label: 'Arrivée / Départ', value: `${acc.checkInTime || '—'} / ${acc.checkOutTime || '—'}` });
  }
  if (acc.securityDeposit > 0) {
    rows.push({ key: 'caution-sejour', label: 'Caution de séjour', value: `${fmt(acc.securityDeposit)} FCFA` });
  }
  if (acc.cleaningFee > 0) {
    rows.push({ key: 'menage', label: 'Frais de ménage', value: `${fmt(acc.cleaningFee)} FCFA` });
  }
  return rows;
}

/**
 * Extrait les conditions de location publiquement affichables, en filtrant
 * les valeurs manquantes/nulles. Ne retourne jamais de donnée privée
 * (contrat signé, identité locataire, documents, historique de paiement).
 * Hébergement suit une branche entièrement séparée (getAccommodationConditions)
 * pour ne jamais afficher de vocabulaire de bail.
 */
export function getRentalConditions(property) {
  if (!property) return [];
  if (normalizeListingType(property) === 'hebergement') return getAccommodationConditions(property);

  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
  const price = property.price || property.prix || 0;
  const rows = [];

  rows.push({
    key: 'loyer',
    label: 'Loyer mensuel',
    value: `${fmt(price)} FCFA`,
  });

  const cautionMult = property.cautionMultiplicateur;
  if (cautionMult != null) {
    rows.push({
      key: 'caution',
      label: 'Caution',
      value: `${fmt(price * cautionMult)} FCFA — ${cautionMult} mois de loyer`,
    });
  }

  // Formule de repli alignée sur le web (PropertyDetailPage.jsx) : 80% du
  // loyer en location, 10% du prix en vente — jamais un taux fixe universel.
  const isVente = normalizeListingType(property) === 'vente';
  const honoraires = property.honoraires != null
    ? property.honoraires
    : Math.round(price * (isVente ? 0.1 : 0.8));
  rows.push({
    key: 'honoraires',
    label: "Frais d'agence",
    value: `${fmt(honoraires)} FCFA`,
  });

  if (property.fraisVisite != null) {
    rows.push({
      key: 'fraisVisite',
      label: 'Frais de visite',
      value: property.fraisVisite > 0 ? `${fmt(property.fraisVisite)} FCFA` : 'Gratuite',
    });
  }

  if (Array.isArray(property.profilsLocataireRecherches) && property.profilsLocataireRecherches.length > 0) {
    rows.push({
      key: 'profils',
      label: 'Profil recherché',
      value: property.profilsLocataireRecherches.join(', '),
    });
  }

  if (Array.isArray(property.documentsRequis) && property.documentsRequis.length > 0) {
    rows.push({
      key: 'documents',
      label: 'Documents à fournir',
      value: property.documentsRequis.join(', '),
    });
  }

  return rows;
}

/**
 * Extrait la conversation d'une réponse `POST /conversations/start`.
 * Retourne null si la réponse ne contient pas de conversation valide
 * (évite de naviguer vers l'écran de chat avec un identifiant manquant).
 */
export function extractConversation(response) {
  const conversation = response?.data?.data?.conversation;
  if (!conversation?._id) return null;
  return conversation;
}

/**
 * Choisit le message d'erreur à afficher pour un échec de contact, sans
 * jamais exposer une erreur Axios brute à l'utilisateur.
 */
export function resolveContactErrorMessage(err) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.request) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  return "Impossible d'ouvrir la messagerie.";
}

// ─────────────────────────────────────────────────────────────────────────
// Correctif crash mobile DetailAnnonceScreen (2026-07) — convention canonique
// de navigation vers l'écran détail, compatible avec les anciens formats.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normalise les params de navigation vers `DetailAnnonce` en une forme canonique
 * `{ resourceType: 'property'|'accommodation', resourceId, item }`, quel que soit le format
 * d'origine :
 *  - canonique : `{ resourceType, resourceId, item }` ;
 *  - historique : `{ annonce }` (objet complet — Liste/Carte/Favoris/Recommandations) ;
 *  - deep-link : `{ propertyId }` (AppNavigator, linking `annonces/:propertyId`) ;
 *  - notification push : `{ id }` (propertyController.js, notification `new_property`) ;
 *  - futur (anticipé) : `{ accommodationId }`.
 * Retourne `{ resourceType: null, resourceId: null, item: null }` si rien d'exploitable
 * n'est trouvé — l'appelant doit alors afficher un écran d'erreur, jamais planter.
 */
export function resolveDetailParams(params = {}) {
  if (params.resourceType && params.resourceId) {
    return { resourceType: params.resourceType, resourceId: params.resourceId, item: params.item || null };
  }
  if (params.annonce) {
    // Un objet "annonce" historique est toujours Property-shaped (voir
    // accommodationSearchService.js : un item hébergement porte `_id` = Property._id
    // + `accommodationId` séparé) — jamais une Accommodation brute.
    const item = params.annonce;
    const id = item._id || item.id;
    return { resourceType: 'property', resourceId: id || null, item };
  }
  if (params.propertyId) return { resourceType: 'property', resourceId: params.propertyId, item: null };
  if (params.accommodationId) return { resourceType: 'accommodation', resourceId: params.accommodationId, item: null };
  if (params.id) return { resourceType: 'property', resourceId: params.id, item: null };
  return { resourceType: null, resourceId: null, item: null };
}

/**
 * Charge le détail d'une annonce à partir de sa convention canonique. `resourceType='property'`
 * couvre Vente/Location ET Hébergement (un item hébergement de `/altimmo/search` est toujours
 * un Property avec `accommodationType` attaché) ; `resourceType='accommodation'` cible
 * `GET /accommodations/public/:id` (utilisé uniquement quand seul un `accommodationId` est
 * connu, sans le `_id` Property correspondant).
 * Lance une erreur explicite (jamais silencieuse) si `resourceType`/`resourceId` manquent, ou
 * si l'API répond une erreur (404 incluse) — à charge de l'appelant d'afficher l'état d'erreur.
 */
export async function fetchAnnonceDetail({ resourceType, resourceId }) {
  if (!resourceType || !resourceId) {
    const err = new Error('Identifiant de bien manquant ou invalide.');
    err.isMissingIdentifier = true;
    throw err;
  }
  const url = resourceType === 'accommodation'
    ? `/accommodations/public/${resourceId}`
    : `/properties/${resourceId}`;
  const res = await api.get(url);
  const property = res.data?.data?.property;
  if (!property) {
    const err = new Error('Bien introuvable.');
    err.isMissingIdentifier = true;
    throw err;
  }
  return property;
}

const RATE_MODE_PRICE_LABELS = { nightly: '/ nuit', weekly: '/ semaine', monthly: '/ mois', yearly: '/ an' };

/**
 * Prix affichable, jamais inventé : vente → `price` ; location → `price` (loyer, même champ
 * que vente côté modèle) ; hébergement → tarif réel le plus pertinent
 * (`accommodation.rates`, priorité nightly) si disponible, sinon `price`. Si aucune valeur
 * positive n'est trouvée, `hasPrice=false` — l'appelant doit alors afficher "Prix sur
 * demande", jamais 0 FCFA.
 */
export function getDisplayPrice(property) {
  if (!property) return { amount: 0, hasPrice: false, suffix: '' };
  const listingType = normalizeListingType(property);

  if (listingType === 'hebergement') {
    const rates = property.accommodation?.rates;
    if (Array.isArray(rates) && rates.length > 0) {
      const preferredOrder = ['nightly', 'weekly', 'monthly', 'yearly'];
      const best = preferredOrder.map((mode) => rates.find((r) => r.mode === mode)).find(Boolean) || rates[0];
      if (best && Number(best.amount) > 0) {
        return { amount: Number(best.amount), hasPrice: true, suffix: RATE_MODE_PRICE_LABELS[best.mode] || '' };
      }
    }
    const fallback = Number(property.price || 0);
    return fallback > 0 ? { amount: fallback, hasPrice: true, suffix: '' } : { amount: 0, hasPrice: false, suffix: '' };
  }

  const amount = Number(property.price || property.prix || 0);
  if (amount <= 0) return { amount: 0, hasPrice: false, suffix: '' };
  return { amount, hasPrice: true, suffix: listingType === 'location' ? '/ mois' : '' };
}
