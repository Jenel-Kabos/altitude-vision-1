// RBAC-2 — verrou anti-drift : STAFF_IMMO/ROLES_ALTIMMO/ROLES_GL/ROLES_LITIGES
// étaient 4 constantes de valeur identique sous des noms différents
// (RBAC-1 §Duplication) — désormais 4 alias stricts de CANONICAL_IMMO_STAFF_ROLES.
// Ce test garantit qu'un futur ajout/retrait de rôle dans l'un des 4 noms
// (ex. un développeur qui réintroduit un array littéral séparé sans le
// savoir) est immédiatement détecté, plutôt que de re-diverger en silence.
const roles = require('../utils/roles');

describe('RBAC-2 — parité des alias du groupe staff immobilier', () => {
  test('STAFF_IMMO, ROLES_ALTIMMO, ROLES_GL et ROLES_LITIGES sont la même référence', () => {
    expect(roles.STAFF_IMMO).toBe(roles.CANONICAL_IMMO_STAFF_ROLES);
    expect(roles.ROLES_ALTIMMO).toBe(roles.CANONICAL_IMMO_STAFF_ROLES);
    expect(roles.ROLES_GL).toBe(roles.CANONICAL_IMMO_STAFF_ROLES);
    expect(roles.ROLES_LITIGES).toBe(roles.CANONICAL_IMMO_STAFF_ROLES);
  });

  test('contenu exact préservé — Admin, GestionnaireImmobilier, Collaborateur, jamais plus jamais moins', () => {
    expect([...roles.CANONICAL_IMMO_STAFF_ROLES].sort()).toEqual(['Admin', 'Collaborateur', 'GestionnaireImmobilier']);
  });

  test('les rôles externes/spécialisés ne sont jamais inclus dans ce groupe', () => {
    expect(roles.CANONICAL_IMMO_STAFF_ROLES).not.toContain('Secretaire');
    expect(roles.CANONICAL_IMMO_STAFF_ROLES).not.toContain('CommunityManager');
    expect(roles.CANONICAL_IMMO_STAFF_ROLES).not.toContain('Communicant');
    expect(roles.CANONICAL_IMMO_STAFF_ROLES).not.toContain('Client');
    expect(roles.CANONICAL_IMMO_STAFF_ROLES).not.toContain('Proprietaire');
  });
});

// RBAC-5 — même verrou anti-drift pour le second groupe de duplication
// identifié par RBAC-2 (RBAC2_REPORT.md §46b) mais laissé hors périmètre à
// l'époque : STAFF_DOC/ROLES_PAIEMENTS/ROLES_DOCS étaient 3 constantes de
// valeur identique déclarées séparément — désormais 3 alias stricts de
// CANONICAL_DOC_STAFF_ROLES.
describe('RBAC-5 — parité des alias du groupe staff documents/paiements', () => {
  test('STAFF_DOC, ROLES_PAIEMENTS et ROLES_DOCS sont la même référence', () => {
    expect(roles.STAFF_DOC).toBe(roles.CANONICAL_DOC_STAFF_ROLES);
    expect(roles.ROLES_PAIEMENTS).toBe(roles.CANONICAL_DOC_STAFF_ROLES);
    expect(roles.ROLES_DOCS).toBe(roles.CANONICAL_DOC_STAFF_ROLES);
  });

  test('contenu exact préservé — Admin, Secretaire, Collaborateur, jamais plus jamais moins', () => {
    expect([...roles.CANONICAL_DOC_STAFF_ROLES].sort()).toEqual(['Admin', 'Collaborateur', 'Secretaire']);
  });

  test('les rôles externes/spécialisés ne sont jamais inclus dans ce groupe', () => {
    expect(roles.CANONICAL_DOC_STAFF_ROLES).not.toContain('GestionnaireImmobilier');
    expect(roles.CANONICAL_DOC_STAFF_ROLES).not.toContain('CommunityManager');
    expect(roles.CANONICAL_DOC_STAFF_ROLES).not.toContain('Communicant');
    expect(roles.CANONICAL_DOC_STAFF_ROLES).not.toContain('Client');
    expect(roles.CANONICAL_DOC_STAFF_ROLES).not.toContain('Proprietaire');
  });
});
