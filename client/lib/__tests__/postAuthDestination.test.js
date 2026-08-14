import { getPostAuthDestination } from '../navigation/postAuthDestination';

describe('destination après authentification', () => {
  test.each(['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant'])(
    '%s rejoint le shell staff', (role) => expect(getPostAuthDestination({ role })).toBe('/dashboard'),
  );
  test('Proprietaire rejoint son shell', () => expect(getPostAuthDestination({ role: 'Proprietaire' })).toBe('/mes-biens'));
  test.each(['Client', 'User', 'Prestataire', undefined])('%s rejoint le site client', (role) => expect(getPostAuthDestination({ role })).toBe('/'));
});
