const PROFILE_DASHBOARDS = Object.freeze({
  Secretaire: {
    eyebrow: 'Administration',
    title: 'Tableau de bord Secrétaire',
    description: 'Documents, encaissements et suivi administratif quotidien.',
    modules: [
      { label: 'Documents', description: 'Consulter et traiter les documents administratifs.', href: '/dashboard/documents', capability: 'documents.read' },
      { label: 'Paiements', description: 'Suivre les paiements et les justificatifs autorisés.', href: '/dashboard/gestion-locative/paiements', capability: 'payments.read' },
      { label: 'Contrats', description: 'Accéder aux contrats nécessaires au traitement.', href: '/dashboard/gestion-locative/baux', capability: 'leases.read' },
      { label: 'Locataires', description: 'Retrouver les informations auxiliaires des locataires.', href: '/dashboard/gestion-locative/locataires', capability: 'tenants.read' },
    ],
  },
  GestionnaireImmobilier: {
    eyebrow: 'Opérations immobilières',
    title: 'Tableau de bord Gestionnaire',
    description: 'Pilotez les biens confiés, les locations et les interventions.',
    modules: [
      { label: 'Biens en gestion', description: 'Voir le portefeuille locatif et son occupation.', href: '/dashboard/gestion-locative', capability: 'rental.read' },
      { label: 'Baux', description: 'Suivre les contrats et leurs échéances.', href: '/dashboard/gestion-locative/baux', capability: 'leases.read' },
      { label: 'Visites', description: 'Organiser et confirmer les rendez-vous.', href: '/dashboard/visites', capability: 'visits.read' },
      { label: 'Maintenance', description: 'Prioriser les tickets et interventions.', href: '/dashboard/gestion-locative/maintenance', capability: 'maintenance.read' },
      { label: 'Préavis', description: 'Suivre les sorties et préavis en cours.', href: '/dashboard/gestion-locative/preavis', capability: 'notice.read' },
      { label: 'Locataires', description: 'Consulter les dossiers locataires.', href: '/dashboard/gestion-locative/locataires', capability: 'tenants.read' },
    ],
  },
  CommunityManager: {
    eyebrow: 'Communication',
    title: 'Tableau de bord Community Manager',
    description: 'Pilotez les contenus Altcom, Mila Events et leurs médias.',
    modules: [
      { label: 'Altcom', description: 'Gérer services, portfolio et publications.', href: '/dashboard/altcom', capability: 'altcom.read' },
      { label: 'Mila Events', description: 'Préparer et publier les événements.', href: '/dashboard/events', capability: 'events.read' },
      { label: 'Marketing', description: 'Accéder aux campagnes et contenus associés.', href: '/dashboard/altcom/marketing', capability: 'altcom.manage' },
    ],
  },
});

export const getProfileDashboard = (role) => PROFILE_DASHBOARDS[role] || null;

export const getVisibleProfileModules = (role, can) => {
  const dashboard = getProfileDashboard(role);
  if (!dashboard) return [];
  return dashboard.modules.filter(({ capability }) => !capability || can(capability));
};

export { PROFILE_DASHBOARDS };
