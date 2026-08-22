import { getProfileDashboard, getVisibleProfileModules } from '../navigation/dashboardProfiles';

// RBAC-5 — fixture de test locale (jamais un mapping de production) reprenant
// les valeurs de server/utils/iamArchitecture.js DEFAULT_CAPABILITIES pour les
// seuls rôles exercés ici. Remplace l'ancien import de
// client/lib/utils/staffCapabilities.js, supprimé (code mort en production,
// zéro consumer réel — voir server/docs/RBAC5_CLEANUP_MATRIX.md) : ce fichier
// de test avait besoin d'une donnée de parité, pas du mapping lui-même.
const CAPABILITIES_BY_ROLE_FIXTURE = {
  Secretaire: ['documents.read', 'documents.manage', 'payments.read', 'payments.manage', 'clients.read', 'owners.read', 'tenants.read', 'leases.read', 'properties.read'],
  GestionnaireImmobilier: ['properties.read', 'properties.create', 'properties.update', 'owners.read', 'tenants.read', 'tenants.manage', 'visits.read', 'visits.manage', 'rental.read', 'rental.manage', 'leases.read', 'leases.manage', 'maintenance.read', 'maintenance.manage', 'notice.read', 'notice.manage', 'occupancy.read', 'occupancy.manage', 'payment.status'],
  CommunityManager: ['altcom.read', 'altcom.manage', 'events.read', 'events.manage', 'media.read', 'media.manage'],
};

const canFor = role => capability => (CAPABILITIES_BY_ROLE_FIXTURE[role] || []).includes(capability);

describe('DASH-1 — architecture des overviews staff', () => {
  test('la Secrétaire reçoit uniquement ses modules administratifs autorisés', () => {
    const labels = getVisibleProfileModules('Secretaire', canFor('Secretaire')).map(module => module.label);
    expect(labels).toEqual(['Documents', 'Paiements', 'Contrats', 'Locataires']);
    expect(labels).not.toContain('Maintenance');
    expect(labels).not.toContain('Mila Events');
  });

  test('le Gestionnaire reçoit le cockpit locatif sans module financier de mutation', () => {
    const labels = getVisibleProfileModules('GestionnaireImmobilier', canFor('GestionnaireImmobilier')).map(module => module.label);
    expect(labels).toEqual(['Biens en gestion', 'Baux', 'Visites', 'Maintenance', 'Préavis', 'Locataires']);
    expect(labels).not.toContain('Paiements');
    expect(labels).not.toContain('Documents');
  });

  test('le Community Manager reçoit uniquement communication et médias', () => {
    const labels = getVisibleProfileModules('CommunityManager', canFor('CommunityManager')).map(module => module.label);
    expect(labels).toEqual(['Altcom', 'Mila Events', 'Marketing']);
    expect(getProfileDashboard('CommunityManager').title).toMatch(/Community Manager/);
  });
});
