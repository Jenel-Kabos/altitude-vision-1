import { getPostAuthDestination } from '../navigation/postAuthDestination';

describe('destination après authentification', () => {
  test.each(['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'])(
    '%s rejoint le shell staff', (role) => expect(getPostAuthDestination({ role })).toBe('/dashboard'),
  );
  test.each([
    { role: 'Proprietaire' },
    { role: 'Proprietaire', effectiveProfiles: ['exploitant_etablissement'] },
    { role: 'Proprietaire', businessProfiles: ['proprietaire_immobilier', 'exploitant_etablissement'] },
  ])('tout Propriétaire rejoint le resolver canonique', user => expect(getPostAuthDestination(user)).toBe('/mon-espace-proprietaire'));
  test('Client rejoint son espace personnel', () => expect(getPostAuthDestination({ role: 'Client' })).toBe('/mon-espace'));
  test.each(['User', 'Prestataire', undefined])('%s rejoint le site public', (role) => expect(getPostAuthDestination({ role })).toBe('/'));
});
