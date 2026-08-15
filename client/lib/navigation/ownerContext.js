export const OWNER_CONTEXTS = Object.freeze({
  REAL_ESTATE: 'patrimoine',
  ACCOMMODATION: 'etablissement',
});

export function resolveOwnerContexts(profiles = []) {
  return {
    hasRealEstate: profiles.includes('proprietaire_immobilier'),
    hasAccommodation: profiles.includes('exploitant_etablissement'),
  };
}

export function resolveOwnerDestination(profiles = []) {
  const { hasRealEstate, hasAccommodation } = resolveOwnerContexts(profiles);
  if (hasRealEstate && !hasAccommodation) return '/mes-biens';
  if (hasAccommodation && !hasRealEstate) return '/mes-hotels';
  return null;
}
