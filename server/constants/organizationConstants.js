// ORGANIZATION-1 — même convention que constants/businessProfileConstants.js
// (USER-ARCH-1) : les valeurs d'enum vivent ici, importées par le(s)
// modèle(s) et le service, jamais dupliquées.
const ORG_UNIT_TYPES = ['organization', 'business_unit', 'establishment', 'department', 'team'];
const ORG_UNIT_STATUSES = ['active', 'archived'];
const ROLE_IN_UNIT = ['owner', 'manager', 'lead', 'member'];
const MEMBERSHIP_STATUSES = ['active', 'suspended', 'revoked'];

// Ordre conventionnel recommandé (documentation uniquement, jamais imposé
// par le schéma — voir "la profondeur doit rester flexible" du brief).
const RECOMMENDED_TYPE_ORDER = ['organization', 'business_unit', 'establishment', 'department', 'team'];

module.exports = { ORG_UNIT_TYPES, ORG_UNIT_STATUSES, ROLE_IN_UNIT, MEMBERSHIP_STATUSES, RECOMMENDED_TYPE_ORDER };
