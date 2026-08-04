// GL-ASSET-1 — vérifie la forme de la table de transitions (même
// convention que RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS
// / rentalLeaseLifecycleService.LEASE_TRANSITIONS) et la dérivation pure
// `deriveAssetCycle` (pour les biens créés avant ce sprint, sans
// `assetCycle`) — aucun accès DB ici.
const { ASSET_STATES, ASSET_TRANSITIONS, deriveAssetCycle } = require('../services/propertyAssetLifecycleService');

test('chaque état déclaré possède une entrée dans la table de transitions', () => {
  ASSET_STATES.forEach((state) => {
    expect(Array.isArray(ASSET_TRANSITIONS[state])).toBe(true);
  });
});

test('toute transition cible un état déclaré (jamais un état fantôme)', () => {
  Object.values(ASSET_TRANSITIONS).flat().forEach((target) => {
    expect(ASSET_STATES).toContain(target);
  });
});

test('"archive" est un état terminal (aucune transition sortante)', () => {
  expect(ASSET_TRANSITIONS.archive).toEqual([]);
});

test('le cycle nominal complet est traversable : disponible → réservé → en location → préavis → inspection → travaux → disponible', () => {
  const path = ['disponible', 'reserve', 'en_location', 'preavis', 'inspection', 'travaux', 'disponible'];
  for (let i = 0; i < path.length - 1; i += 1) {
    expect(ASSET_TRANSITIONS[path[i]]).toContain(path[i + 1]);
  }
});

test('un bien disponible peut être vendu puis archivé directement', () => {
  expect(ASSET_TRANSITIONS.disponible).toContain('vendu');
  expect(ASSET_TRANSITIONS.vendu).toContain('archive');
});

test('deriveAssetCycle : bien legacy sans assetCycle, dérivé depuis availability', () => {
  expect(deriveAssetCycle({ availability: 'Disponible' })).toBe('disponible');
  expect(deriveAssetCycle({ availability: 'Réservé' })).toBe('reserve');
  expect(deriveAssetCycle({ availability: 'Loué' })).toBe('en_location');
  expect(deriveAssetCycle({ availability: 'En maintenance' })).toBe('travaux');
  expect(deriveAssetCycle({ availability: 'Retiré' })).toBe('archive');
  expect(deriveAssetCycle({ availability: 'Vendu' })).toBe('vendu');
});

test('deriveAssetCycle : ne recalcule jamais si assetCycle est déjà présent', () => {
  expect(deriveAssetCycle({ availability: 'Loué', assetCycle: 'preavis' })).toBe('preavis');
});

test('ASSET_TRANSITIONS.en_location n\'autorise pas de revenir directement sur lui-même (pas de transition triviale)', () => {
  expect(ASSET_TRANSITIONS.en_location).not.toContain('en_location');
});
