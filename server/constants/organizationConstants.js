// ORGANIZATION-1 — même convention que constants/businessProfileConstants.js
// (USER-ARCH-1) : les valeurs d'enum vivent ici, importées par le(s)
// modèle(s) et le service, jamais dupliquées.
const ORG_UNIT_TYPES = ['organization', 'business_unit', 'establishment', 'department', 'team'];
const ORG_UNIT_STATUSES = ['active', 'archived'];
const ROLE_IN_UNIT = ['owner', 'manager', 'lead', 'member'];
const MEMBERSHIP_STATUSES = ['active', 'suspended', 'revoked'];

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-1B — rôles métier portables PAR TENANT
// via `OrgMembership.businessRole`. Distincts du `roleInUnit` hiérarchique et
// du `User.role` legacy global : un même User peut avoir un businessRole
// différent dans chaque tenant.
//
// Volontairement STAFF-ONLY : les rôles externes (`Client`, `Proprietaire`,
// `Prestataire`, `User`) décrivent une identité/relation métier orthogonale
// (voir UserBusinessProfile, Property.owner, etc.) et ne sont jamais un rôle
// de membership tenant. Un Proprietaire qui possède un bien Altimmo n'est
// PAS membre du tenant Altimmo par ce seul fait ; il le devient uniquement
// s'il obtient une OrgMembership explicite avec `businessRole` renseigné.
const TENANT_BUSINESS_ROLES = ['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'];

// Ordre conventionnel recommandé (documentation uniquement, jamais imposé
// par le schéma — voir "la profondeur doit rester flexible" du brief).
const RECOMMENDED_TYPE_ORDER = ['organization', 'business_unit', 'establishment', 'department', 'team'];

module.exports = { ORG_UNIT_TYPES, ORG_UNIT_STATUSES, ROLE_IN_UNIT, MEMBERSHIP_STATUSES, TENANT_BUSINESS_ROLES, RECOMMENDED_TYPE_ORDER };
