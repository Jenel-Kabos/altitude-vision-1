import { resolveOwnerContexts, resolveOwnerDestination } from '../navigation/ownerContext';

describe('DASH-2 — résolution des contextes propriétaire', () => {
  test('immobilier pur', () => expect(resolveOwnerDestination(['proprietaire_immobilier'])).toBe('/mes-biens'));
  test('hébergement pur', () => expect(resolveOwnerDestination(['exploitant_etablissement'])).toBe('/mes-hotels'));
  test('multi-activité requiert un choix explicite', () => expect(resolveOwnerDestination(['proprietaire_immobilier', 'exploitant_etablissement'])).toBeNull());
  test('sans ressource garde un fallback explicite sans inventer de profil', () => {
    expect(resolveOwnerDestination([])).toBeNull();
    expect(resolveOwnerContexts([])).toEqual({ hasRealEstate: false, hasAccommodation: false });
  });
});
