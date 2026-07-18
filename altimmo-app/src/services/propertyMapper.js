// Normalisation centralisée des annonces (Property) côté mobile.
// Le backend reste la source de vérité : ce module ne fait qu'interpréter
// de façon cohérente des champs déjà renvoyés par l'API, sans inventer de règle.

const LOCATION_KEYWORDS = ['location', 'louer', 'rent', 'renting'];
const VENTE_KEYWORDS    = ['vente', 'vendre', 'sale', 'sell'];

/**
 * Normalise le "listingType" d'un bien à partir des différents noms de champs
 * legacy possibles (status, transactionType, category, listingType).
 * Retourne 'location' | 'vente' | null.
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
 * ces trois champs backend l'autorisent. Absence de champ = pas de blocage
 * (rétro-compatibilité avec d'anciennes fiches qui ne les renseignent pas).
 */
export function isPropertyAvailable(property) {
  if (!property) return false;
  if (property.availability && property.availability !== 'Disponible') return false;
  if (property.statusAdmin && property.statusAdmin !== 'Validée') return false;
  if (property.isPublished === false) return false;
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

/**
 * Extrait les conditions de location publiquement affichables, en filtrant
 * les valeurs manquantes/nulles. Ne retourne jamais de donnée privée
 * (contrat signé, identité locataire, documents, historique de paiement).
 */
export function getRentalConditions(property) {
  if (!property) return [];
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
