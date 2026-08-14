const STAFF_ROLES = new Set(['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant']);

export function getPostAuthDestination(user) {
  if (STAFF_ROLES.has(user?.role)) return '/dashboard';
  if (user?.role === 'Proprietaire') return '/mes-biens';
  return '/';
}
