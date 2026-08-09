// API-PUBLIC-1 (Phase 5) — Propriétés exposées publiquement. Réutilise
// `utils/apiFeatures.js` (filtre/tri/pagination déjà partagé avec les routes
// internes `/api/properties`) mais n'en réutilise JAMAIS la projection —
// l'audit Phase 1 a révélé que les routes internes actuelles renvoient le
// document Property complet (owner, agent, commissionRate,
// internalManagedOnly, statusAdmin…), une fuite de champs opérationnels déjà
// présente en production. La liste ci-dessous est un ALLOW-LIST explicite,
// jamais un DENY-LIST — tout nouveau champ ajouté à Property.js à l'avenir
// reste invisible ici tant qu'il n'est pas ajouté explicitement.
const Property = require('../../models/Property');
const APIFeatures = require('../../utils/apiFeatures');

const PUBLIC_PROPERTY_FIELDS = 'title description type status price address latitude longitude location images bedrooms bathrooms surface livingRooms kitchens constructionType amenities availability createdAt';

// TENANT-CORE-1 (Phase 7) — `scopeUserIds` optionnel (Set d'identifiants
// User) : quand fourni (clé API liée à un PlatformTenant, voir
// publicApiAuth.js), restreint aux biens dont `owner` appartient au scope —
// même mécanisme de post-filtrage que reportingService.js (assignedTo
// CRM), jamais une seconde implémentation. `undefined`/`null` = comportement
// STRICTEMENT inchangé (catalogue global, tel qu'avant ce sprint).
async function listPublicProperties(query = {}, { scopeUserIds } = {}) {
  const filter = { statusAdmin: 'Validée', isPublished: true, availability: { $ne: 'Retiré' } };
  if (scopeUserIds) filter.owner = { $in: [...scopeUserIds] };
  const baseQuery = Property.find(filter);
  const features = new APIFeatures(baseQuery, query).filter().sort().paginate();
  // `limitFields()` n'est jamais appliqué ici : un appelant public ne doit
  // jamais pouvoir demander un champ hors de l'allow-list via `?fields=`.
  const [properties, total] = await Promise.all([
    features.query.select(PUBLIC_PROPERTY_FIELDS).lean(),
    Property.countDocuments(features.query.getFilter()),
  ]);
  return { properties, total, page: Number(query.page) || 1, limit: Number(query.limit) || 20 };
}

async function getPublicPropertyById(id, { scopeUserIds } = {}) {
  const filter = { _id: id, statusAdmin: 'Validée', isPublished: true };
  if (scopeUserIds) filter.owner = { $in: [...scopeUserIds] };
  const property = await Property.findOne(filter).select(PUBLIC_PROPERTY_FIELDS).lean();
  return property || null;
}

module.exports = { listPublicProperties, getPublicPropertyById, PUBLIC_PROPERTY_FIELDS };
