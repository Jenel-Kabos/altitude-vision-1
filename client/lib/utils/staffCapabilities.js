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
