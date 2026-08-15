// SYNC-2A — projection IAM-3 côté Mobile. Miroir volontaire (jamais une
// extraction monorepo, jugée disproportionnée pour 15 lignes stables) de
// server/utils/iamArchitecture.js (DEFAULT_CAPABILITIES) et
// client/lib/utils/staffCapabilities.js — les trois copies doivent rester
// identiques ; toute nouvelle capability ajoutée côté backend doit être
// répercutée ici ET côté Web. Cette projection ne sécurise RIEN par
// elle-même : elle sert uniquement à filtrer navigation/actions/boutons
// côté Mobile. Le backend reste l'unique autorité (requireCapability côté
// serveur) — un contournement de cette table ne donnerait accès à rien que
// le serveur n'autoriserait pas déjà.
const CAPABILITIES_BY_ROLE = Object.freeze({
  Admin: ['*'],
  Collaborateur: ['legacy.full'],
  Secretaire: ['documents.read', 'documents.manage', 'payments.read', 'payments.manage', 'clients.read', 'owners.read', 'tenants.read', 'leases.read', 'properties.read'],
  GestionnaireImmobilier: ['properties.read', 'properties.create', 'properties.update', 'owners.read', 'tenants.read', 'tenants.manage', 'visits.read', 'visits.manage', 'rental.read', 'rental.manage', 'leases.read', 'leases.manage', 'maintenance.read', 'maintenance.manage', 'notice.read', 'notice.manage', 'occupancy.read', 'occupancy.manage', 'payment.status'],
  CommunityManager: ['altcom.read', 'altcom.manage', 'events.read', 'events.manage', 'media.read', 'media.manage'],
  Communicant: ['messages.read', 'messages.manage', 'visits.read'],
});

export const hasStaffCapability = (user, capability) => {
  const capabilities = CAPABILITIES_BY_ROLE[user?.role] || [];
  return capabilities.includes('*') || capabilities.includes('legacy.full') || capabilities.includes(capability);
};

export { CAPABILITIES_BY_ROLE };
