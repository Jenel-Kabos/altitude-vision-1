// Schémas de validation du formulaire mobile de publication (Vente / Location /
// Hébergement). Pas de librairie de schéma (Yup/Zod) — validation inline, cohérente
// avec le style déjà en place dans PublierBienScreen.jsx (validateStep par étape),
// mais séparée par parcours pour éviter un unique écran conditionnel illisible.

// Types de bien pour lesquels chambres/salles de bain n'ont pas de sens métier
// (Vente et Location uniquement — l'Hébergement ne connaît pas ces types, voir §6 mission).
const NO_BEDROOMS_TYPES  = ['Terrain', 'Parcelle', 'Entrepôt', 'Bureau', 'Commerce'];
const NO_BATHROOMS_TYPES = ['Terrain', 'Parcelle'];

export function getPropertyVisibleFields(type) {
  return {
    bedrooms:  !NO_BEDROOMS_TYPES.includes(type),
    bathrooms: !NO_BATHROOMS_TYPES.includes(type),
  };
}

// Change de type => supprime les valeurs devenues incompatibles (jamais conservées
// cachées dans le state ni envoyées au backend).
export function sanitizePropertyFieldsForType(form, type) {
  const visible = getPropertyVisibleFields(type);
  const next = { ...form, type };
  if (!visible.bedrooms)  next.bedrooms  = 0;
  if (!visible.bathrooms) next.bathrooms = 0;
  return next;
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isPositiveNumber = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) > 0;

// ─────────────────────────────────────────────────────────────────────────
// Vente
// ─────────────────────────────────────────────────────────────────────────
export const salePropertySchema = {
  steps: ['info', 'location', 'features', 'price', 'photos', 'summary'],
  validateStep(stepId, { form, photos }) {
    const e = {};
    if (stepId === 'info') {
      if (!isNonEmptyString(form.titre)) e.titre = 'Titre requis';
      if (!isNonEmptyString(form.description)) e.description = 'Description requise';
      if (!form.type) e.type = 'Choisissez un type de bien';
    }
    if (stepId === 'location') {
      if (!isNonEmptyString(form.ville)) e.ville = 'Ville requise';
      if (!isNonEmptyString(form.arrondissement)) e.arrondissement = 'Arrondissement requis';
    }
    if (stepId === 'features') {
      if (!isPositiveNumber(form.surface)) e.surface = 'Surface requise';
    }
    if (stepId === 'price') {
      if (!isPositiveNumber(form.prix)) e.prix = 'Prix de vente valide requis';
    }
    if (stepId === 'photos') {
      if (!photos || photos.length === 0) e.photos = 'Ajoutez au moins une photo';
    }
    return e;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Location
// ─────────────────────────────────────────────────────────────────────────
export const rentalPropertySchema = {
  steps: ['info', 'location', 'features', 'price', 'photos', 'summary'],
  validateStep(stepId, { form, photos }) {
    const e = {};
    if (stepId === 'info') {
      if (!isNonEmptyString(form.titre)) e.titre = 'Titre requis';
      if (!isNonEmptyString(form.description)) e.description = 'Description requise';
      if (!form.type) e.type = 'Choisissez un type de bien';
    }
    if (stepId === 'location') {
      if (!isNonEmptyString(form.ville)) e.ville = 'Ville requise';
      if (!isNonEmptyString(form.arrondissement)) e.arrondissement = 'Arrondissement requis';
    }
    if (stepId === 'features') {
      if (!isPositiveNumber(form.surface)) e.surface = 'Surface requise';
    }
    if (stepId === 'price') {
      if (!isPositiveNumber(form.prix)) e.prix = 'Loyer mensuel valide requis';
      if (form.cautionMultiplicateur < 0 || form.cautionMultiplicateur > 6) {
        e.cautionMultiplicateur = 'Caution entre 0 et 6 mois';
      }
    }
    if (stepId === 'photos') {
      if (!photos || photos.length === 0) e.photos = 'Ajoutez au moins une photo';
    }
    return e;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Hébergement — Accommodation (pas de `type` de bien Property, voir accommodationType).
// Bathrooms est obligatoire ici (>0) : Accommodation.submit() l'exige côté backend
// (PROPERTY_REQUIRED_FIELDS dans accommodationService.js, jamais assoupli côté mobile).
// ─────────────────────────────────────────────────────────────────────────
export const furnishedAccommodationSchema = {
  steps: ['info', 'location', 'features', 'price', 'photos', 'summary'],
  validateStep(stepId, { form, photos }) {
    const e = {};
    if (stepId === 'info') {
      if (!isNonEmptyString(form.titre)) e.titre = 'Titre requis';
      if (!isNonEmptyString(form.description)) e.description = 'Description requise';
      if (!form.accommodationType) e.accommodationType = "Choisissez une catégorie d'hébergement";
    }
    if (stepId === 'location') {
      if (!isNonEmptyString(form.ville)) e.ville = 'Ville requise';
      if (!isNonEmptyString(form.arrondissement)) e.arrondissement = 'Arrondissement requis';
    }
    if (stepId === 'features') {
      if (!isPositiveNumber(form.surface)) e.surface = 'Surface requise';
      if (!isPositiveNumber(form.bathrooms)) e.bathrooms = 'Au moins 1 salle de bain requise';
      if (!isPositiveNumber(form.capaciteAdultes)) e.capaciteAdultes = 'Capacité (adultes) requise';
    }
    if (stepId === 'price') {
      if (!isPositiveNumber(form.tarifNuit)) e.tarifNuit = 'Tarif par nuit valide requis';
    }
    if (stepId === 'photos') {
      if (!photos || photos.length === 0) e.photos = 'Ajoutez au moins une photo';
    }
    return e;
  },
};

export const hotelAccommodationSchema = {
  steps: ['info', 'location', 'features', 'price', 'photos', 'summary'],
  validateStep(stepId, { form, photos }) {
    const e = {};
    if (stepId === 'info') {
      if (!isNonEmptyString(form.establishmentName)) e.establishmentName = "Nom de l'établissement requis";
      if (!isNonEmptyString(form.description)) e.description = 'Description requise';
      if (!form.accommodationType) e.accommodationType = 'Choisissez une catégorie hôtelière';
    }
    if (stepId === 'location') {
      if (!isNonEmptyString(form.ville)) e.ville = 'Ville requise';
      if (!isNonEmptyString(form.arrondissement)) e.arrondissement = 'Arrondissement requis';
    }
    if (stepId === 'features' && !isPositiveNumber(form.capaciteAdultes)) {
      e.capaciteAdultes = 'Capacité globale requise';
    }
    if (stepId === 'price' && !isPositiveNumber(form.tarifNuit)) e.tarifNuit = 'Tarif de base valide requis';
    if (stepId === 'photos' && (!photos || photos.length === 0)) e.photos = 'Ajoutez au moins une photo';
    return e;
  },
};

export const accommodationSchema = furnishedAccommodationSchema;

export { NO_BEDROOMS_TYPES, NO_BATHROOMS_TYPES };
