const {
  projectLegacyRole, hasDefaultCapability,
  ALL_CAPABILITIES, assertKnownCapability, getEffectiveCapabilities,
} = require('../utils/iamArchitecture');

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

// RBAC-2 — registre canonique, validation des capacités, capacités effectives.
describe('IAM-2 / RBAC-2 — registre canonique des capacités', () => {
  test('ALL_CAPABILITIES ne contient jamais les jokers `*`/`legacy.full`', () => {
    expect(ALL_CAPABILITIES).not.toContain('*');
    expect(ALL_CAPABILITIES).not.toContain('legacy.full');
  });

  test('ALL_CAPABILITIES contient bien payments.reverse (correctif RBAC-2 — capacité auparavant absente de toute liste)', () => {
    expect(ALL_CAPABILITIES).toContain('payments.reverse');
  });

  test('assertKnownCapability ne lève rien pour une capacité réellement déclarée', () => {
    expect(() => assertKnownCapability('properties.update')).not.toThrow();
  });

  test('assertKnownCapability lève une erreur de configuration claire pour une capacité inconnue (jamais un accès silencieux)', () => {
    expect(() => assertKnownCapability('propertie.read')).toThrow(/Capacité inconnue/);
  });

  test('getEffectiveCapabilities("Admin") retourne l\'ensemble complet du registre (joker `*` résolu)', () => {
    const effective = getEffectiveCapabilities('Admin');
    expect(effective).toEqual(expect.arrayContaining(ALL_CAPABILITIES));
    expect(effective).not.toContain('*');
  });

  test('getEffectiveCapabilities("Collaborateur") retourne l\'ensemble complet du registre (joker `legacy.full` résolu)', () => {
    const effective = getEffectiveCapabilities('Collaborateur');
    expect(effective).toEqual(expect.arrayContaining(ALL_CAPABILITIES));
    expect(effective).not.toContain('legacy.full');
  });

  test('getEffectiveCapabilities("GestionnaireImmobilier") retourne exactement sa liste déclarée, jamais le registre complet', () => {
    const effective = getEffectiveCapabilities('GestionnaireImmobilier');
    expect(effective).toContain('rental.manage');
    expect(effective).not.toContain('payments.reverse'); // réservé Admin/Collaborateur, voir IAM-3 ci-dessous
    expect(effective).not.toContain('documents.read');
    expect(effective.length).toBeLessThan(ALL_CAPABILITIES.length);
  });

  test('getEffectiveCapabilities d\'un rôle externe (Proprietaire/Client) reste minimal, jamais staff', () => {
    expect(getEffectiveCapabilities('Proprietaire')).toEqual(['properties.own', 'accommodation.own']);
    expect(getEffectiveCapabilities('Client')).toEqual(['client.self']);
  });

  test('getEffectiveCapabilities d\'un rôle inconnu retourne un ensemble vide (fail closed, jamais une erreur qui masquerait un accès)', () => {
    expect(getEffectiveCapabilities('RoleInexistant')).toEqual([]);
  });

  test('hasDefaultCapability d\'un rôle inconnu retourne toujours false (fail closed)', () => {
    expect(hasDefaultCapability('RoleInexistant', 'properties.read')).toBe(false);
    expect(hasDefaultCapability(undefined, 'properties.read')).toBe(false);
    expect(hasDefaultCapability(null, 'properties.read')).toBe(false);
  });

  test('payments.reverse (ADMIN_ONLY_CAPABILITIES) : exactement Admin et Collaborateur (via leurs jokers), jamais un rôle staff nommé — parité avec le test IAM-3 de rentalPaymentReceiptsAndCancellation', () => {
    // RBAC-2 — ce test caractérise le comportement RÉEL, pas une hypothèse :
    // une première tentative de correction avait ajouté `payments.reverse` à
    // GestionnaireImmobilier en se fiant au commentaire `CANCEL_ROLES` de
    // paiementController.js, avant de découvrir que ce commentaire est
    // obsolète (code mort pour ce rôle depuis l'introduction du guard de
    // route) et que le test "IAM-3 : GestionnaireImmobilier ne peut pas
    // annuler un encaissement" encode le contrat réellement voulu. Corrigé
    // en conséquence — voir __tests__/rentalPaymentReceiptsAndCancellation
    // .mongo.integration.test.js pour la preuve HTTP de bout en bout.
    const rolesAvecPaymentsReverse = ['Admin', 'Collaborateur', 'Secretaire', 'GestionnaireImmobilier', 'CommunityManager', 'Communicant']
      .filter((role) => hasDefaultCapability(role, 'payments.reverse'));
    expect(rolesAvecPaymentsReverse).toEqual(expect.arrayContaining(['Admin', 'Collaborateur']));
    expect(rolesAvecPaymentsReverse).not.toContain('Secretaire');
    expect(rolesAvecPaymentsReverse).not.toContain('GestionnaireImmobilier');
    expect(rolesAvecPaymentsReverse).not.toContain('CommunityManager');
    expect(rolesAvecPaymentsReverse).not.toContain('Communicant');
  });
});
