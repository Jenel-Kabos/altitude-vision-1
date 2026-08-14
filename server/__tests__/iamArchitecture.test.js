const { projectLegacyRole, hasDefaultCapability } = require('../utils/iamArchitecture');

describe('IAM-2 — projection rétrocompatible', () => {
  test.each([
    ['Admin', 'ADMIN', null], ['Secretaire', 'STAFF', 'SECRETARY'],
    ['GestionnaireImmobilier', 'STAFF', 'REAL_ESTATE_MANAGER'],
    ['CommunityManager', 'STAFF', 'COMMUNITY_MANAGER'],
    ['Proprietaire', 'OWNER', null], ['Client', 'CLIENT', null],
  ])('%s → %s / %s', (role, accountFamily, staffFunction) => {
    expect(projectLegacyRole(role)).toMatchObject({ role, accountFamily, staffFunction });
  });
  test('Admin possède toute capacité par défaut', () => expect(hasDefaultCapability('Admin', 'hotel.manage')).toBe(true));
  test('les responsabilités staff cibles sont séparées', () => {
    expect(hasDefaultCapability('Secretaire', 'payments.manage')).toBe(true);
    expect(hasDefaultCapability('Secretaire', 'rental.manage')).toBe(false);
    expect(hasDefaultCapability('GestionnaireImmobilier', 'rental.manage')).toBe(true);
    expect(hasDefaultCapability('GestionnaireImmobilier', 'payments.manage')).toBe(false);
    expect(hasDefaultCapability('GestionnaireImmobilier', 'documents.read')).toBe(false);
    expect(hasDefaultCapability('GestionnaireImmobilier', 'maintenance.manage')).toBe(true);
    expect(hasDefaultCapability('CommunityManager', 'altcom.manage')).toBe(true);
    expect(hasDefaultCapability('CommunityManager', 'documents.read')).toBe(false);
    expect(hasDefaultCapability('CommunityManager', 'visits.manage')).toBe(false);
    expect(hasDefaultCapability('Collaborateur', 'events.manage')).toBe(true);
  });
});
