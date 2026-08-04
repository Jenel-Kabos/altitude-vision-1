// GL-LIFE-1 — vérifie la forme de la table de transitions (même convention
// que RentalMaintenanceTicket.RENTAL_MAINTENANCE_STATUS_TRANSITIONS) et la
// dérivation pure `deriveCycleVie` (pour les baux créés avant ce sprint,
// sans `cycleVie`) — aucun accès DB ici.
const { LEASE_STATES, LEASE_TRANSITIONS, deriveCycleVie } = require('../services/rentalLeaseLifecycleService');

test('chaque état déclaré possède une entrée dans la table de transitions', () => {
  LEASE_STATES.forEach((state) => {
    expect(Array.isArray(LEASE_TRANSITIONS[state])).toBe(true);
  });
});

test('toute transition cible un état déclaré (jamais un état fantôme)', () => {
  Object.values(LEASE_TRANSITIONS).flat().forEach((target) => {
    expect(LEASE_STATES).toContain(target);
  });
});

test('"archive" est un état terminal (aucune transition sortante)', () => {
  expect(LEASE_TRANSITIONS.archive).toEqual([]);
});

test('le chemin nominal complet est traversable projet → ... → archive', () => {
  const path = ['projet', 'en_preparation', 'a_signer', 'actif', 'preavis', 'inspection_sortie', 'cloture_financiere', 'resilie', 'archive'];
  for (let i = 0; i < path.length - 1; i += 1) {
    expect(LEASE_TRANSITIONS[path[i]]).toContain(path[i + 1]);
  }
});

test('un bail actif peut être résilié directement (résiliation anticipée), sans passer par le préavis', () => {
  expect(LEASE_TRANSITIONS.actif).toContain('resilie');
});

test('deriveCycleVie : contrat legacy sans cycleVie, statut en_attente → a_signer', () => {
  expect(deriveCycleVie({ statut: 'en_attente' })).toBe('a_signer');
});

test('deriveCycleVie : contrat legacy sans cycleVie, statut actif → actif', () => {
  expect(deriveCycleVie({ statut: 'actif' })).toBe('actif');
});

test('deriveCycleVie : contrat legacy résilié/expiré → resilie', () => {
  expect(deriveCycleVie({ statut: 'résilié' })).toBe('resilie');
  expect(deriveCycleVie({ statut: 'expiré' })).toBe('resilie');
});

test('deriveCycleVie : ne recalcule jamais si cycleVie est déjà présent', () => {
  expect(deriveCycleVie({ statut: 'actif', cycleVie: 'preavis' })).toBe('preavis');
});
