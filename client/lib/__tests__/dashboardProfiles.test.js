import { getProfileDashboard, getVisibleProfileModules } from '../navigation/dashboardProfiles';
import { CAPABILITIES_BY_ROLE } from '../utils/staffCapabilities';

const canFor = role => capability => (CAPABILITIES_BY_ROLE[role] || []).includes(capability);

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
