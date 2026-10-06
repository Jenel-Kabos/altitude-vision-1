// C2.10A — scope canonique de la GESTION LOCATIVE.
//
// Property.tenant est l'UNIQUE provenance organisationnelle d'un bien et de
// toutes ses ressources locatives (dossier, bail, paiement, préavis,
// maintenance, documents, locataire, fiche propriétaire) :
//   Property.tenant = null → INDIVIDUAL (bien indépendant)
//   Property.tenant = T    → ORGANIZATION(T)
// Aucune inférence : ni Property.owner, ni RentalManagement.manager, ni
// User.role, ni OrgMembership du propriétaire, ni createdBy, ni l'heuristique
// « tenant unique », ni X-Platform-Tenant-Id seul.
//
// Volontairement distinct de `tenantResourceAttributionService.fromProperty`
// (repli owner→membership encore utilisé par Hotel/Transaction/Conversation…) :
// ce module ne s'applique qu'au domaine locatif. Il répond à « à quel espace
// appartient cette ressource ? » — jamais à « l'acteur a-t-il l'autorité ? »
// (IAM) ni à « l'espace a-t-il souscrit ? » (requireTenantModule).
const mongoose = require('mongoose');
const Property = require('../../models/Property');
const Contrat = require('../../models/Contrat');

const RENTAL_SCOPE = Object.freeze({ INDIVIDUAL: 'INDIVIDUAL', ORGANIZATION: 'ORGANIZATION' });

const rawId = (value) => value?._id || value || null;
const validId = (value) => (mongoose.isValidObjectId(rawId(value)) ? String(rawId(value)) : null);

function resolveRentalPropertyScope(property) {
  if (!property) return { scope: null, tenantId: null };
  return property.tenant
    ? { scope: RENTAL_SCOPE.ORGANIZATION, tenantId: String(rawId(property.tenant)) }
    : { scope: RENTAL_SCOPE.INDIVIDUAL, tenantId: null };
}

async function contractPropertyIds(filter) {
  const biens = await Contrat.find(filter).distinct('bien');
  return biens.map(validId).filter(Boolean);
}

// Biens auxquels la ressource est rattachée par une relation métier réelle.
async function rentalResourcePropertyIds({ resourceType, resource }) {
  if (!resource) return [];
  switch (resourceType) {
    case 'Property': return [validId(resource)].filter(Boolean);
    case 'RentalManagement':
    case 'RentalMaintenanceTicket': return [validId(resource.property)].filter(Boolean);
    case 'Contrat': return [validId(resource.bien)].filter(Boolean);
    case 'Paiement': {
      const contrat = resource.contrat?.bien !== undefined
        ? resource.contrat
        : validId(resource.contrat) && await Contrat.findById(validId(resource.contrat)).select('bien').lean();
      return [validId(contrat?.bien)].filter(Boolean);
    }
    case 'Locataire': return contractPropertyIds({ locataire: rawId(resource) });
    case 'Proprietaire': return contractPropertyIds({ proprietaire: rawId(resource) });
    default: throw new Error(`rentalScopeService: resourceType non géré '${resourceType}'.`);
  }
}

// Locataire/Proprietaire n'ont aucun bien tant qu'aucun bail ne les lie :
// leur champ `tenant` (posé côté serveur à la création, jamais depuis le body)
// est alors leur seule provenance explicite. Dès qu'un bail existe, chaque
// bien lié doit appartenir au même espace (fail-closed sinon).
const DIRECT_TENANT_TYPES = new Set(['Locataire', 'Proprietaire']);

async function resolveRentalResourceScope({ resourceType, resource }) {
  const propertyIds = [...new Set(await rentalResourcePropertyIds({ resourceType, resource }))];
  const properties = propertyIds.length
    ? await Property.find({ _id: { $in: propertyIds } }).select('tenant').lean()
    : [];
  const spaces = new Set(properties.map((p) => (p.tenant ? String(p.tenant) : RENTAL_SCOPE.INDIVIDUAL)));
  if (properties.length !== propertyIds.length) spaces.add('missing_property');
  if (DIRECT_TENANT_TYPES.has(resourceType) && resource.tenant) spaces.add(String(rawId(resource.tenant)));
  if (DIRECT_TENANT_TYPES.has(resourceType) && resource.individualOwner) spaces.add(RENTAL_SCOPE.INDIVIDUAL);
  if (spaces.size === 0) return { status: 'unresolved', scope: null, tenantId: null, propertyIds };
  if (spaces.size > 1) return { status: 'mixed', scope: null, tenantId: null, propertyIds };
  const [space] = spaces;
  if (space === 'missing_property') return { status: 'unresolved', scope: null, tenantId: null, propertyIds };
  if (space === RENTAL_SCOPE.INDIVIDUAL) return { status: 'resolved', scope: RENTAL_SCOPE.INDIVIDUAL, tenantId: null, propertyIds };
  return { status: 'resolved', scope: RENTAL_SCOPE.ORGANIZATION, tenantId: space, propertyIds };
}

function rentalScopeError(code) {
  const error = new Error('Ressource inaccessible dans ce contexte tenant.');
  error.statusCode = 404;
  error.code = code;
  return error;
}

// Garde ORGANIZATION : la ressource doit appartenir EXACTEMENT au tenant de la
// requête. tenant:null, autre tenant, rattachement mixte ou introuvable → 404.
async function assertRentalResourceInTenant({ resourceType, resource, tenantId }) {
  if (!validId(tenantId)) throw rentalScopeError('TENANT_CONTEXT_REQUIRED');
  const scope = await resolveRentalResourceScope({ resourceType, resource });
  if (scope.scope === RENTAL_SCOPE.ORGANIZATION && scope.tenantId === String(tenantId)) return scope;
  throw rentalScopeError(scope.scope === RENTAL_SCOPE.INDIVIDUAL ? 'RENTAL_INDIVIDUAL_SCOPE' : 'TENANT_RESOURCE_NOT_FOUND');
}

// Population canonique d'un tenant : les biens dont Property.tenant = T.
// Sans tenant valide → [] (jamais `tenant: undefined`, qui matcherait null).
async function tenantRentalPropertyIds(tenantId) {
  if (!validId(tenantId)) return [];
  return Property.find({ tenant: validId(tenantId) }).distinct('_id');
}

// Population Locataire/Proprietaire d'un tenant — exactement celle qu'accepte
// `assertRentalResourceInTenant` (liste ≡ garde par ID) : fiches liées par bail
// à un bien de T ou de provenance T, moins toute fiche de provenance ≠ T ou
// liée par bail à un bien hors de T (fail-closed).
async function tenantRentalPartyIds(tenantId, { Model, field }) {
  if (!validId(tenantId)) return [];
  const propertyIds = await tenantRentalPropertyIds(tenantId);
  const [viaContract, viaProvenance] = await Promise.all([
    propertyIds.length ? Contrat.find({ bien: { $in: propertyIds } }).distinct(field) : [],
    Model.find({ tenant: validId(tenantId) }).distinct('_id'),
  ]);
  const candidates = [...new Set([...viaContract, ...viaProvenance].map(validId).filter(Boolean))];
  if (!candidates.length) return [];
  const [foreignByContract, foreignByProvenance] = await Promise.all([
    Contrat.find({ [field]: { $in: candidates }, bien: { $nin: propertyIds, $ne: null } }).distinct(field),
    Model.find({ _id: { $in: candidates }, tenant: { $nin: [null, validId(tenantId)] } }).distinct('_id'),
  ]);
  const excluded = new Set([...foreignByContract, ...foreignByProvenance].map(String));
  return candidates.filter((id) => !excluded.has(id));
}

// Routeurs polymorphes location/vente : contrat (type + bien) d'un paiement,
// sans dépendance route → modèle.
async function loadPaymentContract(paiement) {
  const contratId = validId(paiement?.contrat);
  return contratId ? Contrat.findById(contratId).select('type bien').lean() : null;
}

module.exports = {
  RENTAL_SCOPE,
  loadPaymentContract,
  tenantRentalPartyIds,
  resolveRentalPropertyScope,
  resolveRentalResourceScope,
  assertRentalResourceInTenant,
  tenantRentalPropertyIds,
};
