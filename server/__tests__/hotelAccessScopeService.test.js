const { effectiveCapabilities, isEffectiveNow } = require('../services/hotel/hotelAccessScopeService');
const { validateCapabilities, validatePeriod } = require('../services/hotel/hotelStaffAssignmentService');
const { DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE, HOTEL_OPERATIONAL_CAPABILITIES } = require('../constants/hotelAccessConstants');

describe('hotelAccessScopeService — isEffectiveNow', () => {
  const base = { status: 'active', validFrom: new Date(Date.now() - 86400000), validUntil: null };

  test('actif sans date de fin est effectif', () => expect(isEffectiveNow(base)).toBe(true));
  test('rattachement suspendu n’est jamais effectif', () => expect(isEffectiveNow({ ...base, status: 'suspended' })).toBe(false));
  test('rattachement révoqué n’est jamais effectif', () => expect(isEffectiveNow({ ...base, status: 'revoked' })).toBe(false));
  test('rattachement futur (validFrom > maintenant) n’est pas encore effectif', () => expect(isEffectiveNow({ ...base, validFrom: new Date(Date.now() + 86400000) })).toBe(false));
  test('rattachement expiré (validUntil <= maintenant) n’est plus effectif, même si status=active', () => expect(isEffectiveNow({ ...base, validUntil: new Date(Date.now() - 1000) })).toBe(false));
  test('rattachement avec validUntil futur reste effectif', () => expect(isEffectiveNow({ ...base, validUntil: new Date(Date.now() + 86400000) })).toBe(true));
});

describe('hotelAccessScopeService — effectiveCapabilities', () => {
  test('fusionne les capacités par défaut du rôle local avec les capacités explicites, sans doublon', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'housekeeping', capabilities: [HOTEL_OPERATIONAL_CAPABILITIES.HOUSEKEEPING_VIEW, 'financial.document.view'] });
    expect(caps).toEqual(expect.arrayContaining([HOTEL_OPERATIONAL_CAPABILITIES.HOUSEKEEPING_VIEW, HOTEL_OPERATIONAL_CAPABILITIES.HOUSEKEEPING_MANAGE, 'financial.document.view']));
    expect(new Set(caps).size).toBe(caps.length);
  });

  test('hotel_manager n’obtient jamais l’override financier de check-out par défaut', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'hotel_manager', capabilities: [] });
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.CHECKOUT_FINANCIAL_OVERRIDE);
  });

  test('chaque rôle local de la matrice a au moins hotel.view', () => {
    Object.values(DEFAULT_CAPABILITIES_BY_ASSIGNMENT_ROLE).forEach((caps) => expect(caps).toContain(HOTEL_OPERATIONAL_CAPABILITIES.HOTEL_VIEW));
  });

  // F2.6.1
  test('reception obtient room_assignment.view et .manage par défaut', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'reception', capabilities: [] });
    expect(caps).toEqual(expect.arrayContaining([HOTEL_OPERATIONAL_CAPABILITIES.ROOM_ASSIGNMENT_VIEW, HOTEL_OPERATIONAL_CAPABILITIES.ROOM_ASSIGNMENT_MANAGE]));
  });
  test('housekeeping n’obtient jamais inspection.approve ni maintenance.manage par défaut', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'housekeeping', capabilities: [] });
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.INSPECTION_APPROVE);
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.MAINTENANCE_MANAGE);
  });
  test('maintenance n’obtient jamais housekeeping.complete ni inspection.manage par défaut', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'maintenance', capabilities: [] });
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.HOUSEKEEPING_COMPLETE);
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.INSPECTION_MANAGE);
  });
  test('inspector obtient approve et reject mais jamais maintenance.close', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'inspector', capabilities: [] });
    expect(caps).toEqual(expect.arrayContaining([HOTEL_OPERATIONAL_CAPABILITIES.INSPECTION_APPROVE, HOTEL_OPERATIONAL_CAPABILITIES.INSPECTION_REJECT]));
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.MAINTENANCE_CLOSE);
  });

  // F2.6.2
  test('hotel_manager obtient hotel.manage (entité Hotel elle-même)', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'hotel_manager', capabilities: [] });
    expect(caps).toContain(HOTEL_OPERATIONAL_CAPABILITIES.HOTEL_MANAGE);
  });
  test('reception/housekeeping/inspector/maintenance n’obtiennent jamais hotel.manage par défaut', () => {
    ['reception', 'housekeeping', 'inspector', 'maintenance', 'viewer'].forEach((role) => {
      const caps = effectiveCapabilities({ assignmentRole: role, capabilities: [] });
      expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.HOTEL_MANAGE);
    });
  });

  // F2.6.3 (volet D §7.4) — invariants de la matrice de rôles locaux
  test('viewer n’a aucune capacité d’écriture (manage/create/execute/complete/approve/reject/close)', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'viewer', capabilities: [] });
    const writeLike = /manage|create|execute|complete|approve|reject|close|cancel|update/i;
    expect(caps.every((cap) => !writeLike.test(cap))).toBe(true);
  });
  test('finance n’obtient jamais hotel.checkout.financial_override', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'finance', capabilities: [] });
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.CHECKOUT_FINANCIAL_OVERRIDE);
  });
  test('reception n’obtient jamais la gestion du personnel (staff_assignment.*)', () => {
    const caps = effectiveCapabilities({ assignmentRole: 'reception', capabilities: [] });
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_VIEW);
    expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.STAFF_ASSIGNMENT_MANAGE);
  });
  test('aucun rôle local n’obtient hotel.checkout.financial_override (réservé Admin global)', () => {
    ['hotel_manager', 'reception', 'housekeeping', 'inspector', 'maintenance', 'finance', 'viewer'].forEach((role) => {
      const caps = effectiveCapabilities({ assignmentRole: role, capabilities: [] });
      expect(caps).not.toContain(HOTEL_OPERATIONAL_CAPABILITIES.CHECKOUT_FINANCIAL_OVERRIDE);
    });
  });
});

describe('hotelStaffAssignmentService — validateCapabilities', () => {
  test('déduplique les capacités', () => {
    expect(validateCapabilities(['hotel.view', 'hotel.view', 'hotel.room.view'])).toEqual(['hotel.view', 'hotel.room.view']);
  });
  test('rejette une capacité inconnue', () => {
    expect(() => validateCapabilities(['hotel.view', 'capacite.inexistante'])).toThrow(/Capacités inconnues/);
  });
  test('accepte une capacité financière déjà établie F2.1-F2.5', () => {
    expect(() => validateCapabilities(['financial.document.view', 'financial.hotel.dashboard.view'])).not.toThrow();
  });
});

describe('hotelStaffAssignmentService — validatePeriod', () => {
  test('rejette validUntil <= validFrom', () => {
    expect(() => validatePeriod('2026-02-01', '2026-01-01')).toThrow(/validUntil doit être postérieur/);
  });
  test('rejette une date invalide', () => {
    expect(() => validatePeriod('pas-une-date')).toThrow(/validFrom invalide/);
  });
  test('accepte une période valide et retourne des Date', () => {
    const { from, until } = validatePeriod('2026-01-01', '2026-02-01');
    expect(from).toBeInstanceOf(Date);
    expect(until).toBeInstanceOf(Date);
  });
  test('validUntil est optionnel', () => {
    const { until } = validatePeriod(new Date());
    expect(until).toBeNull();
  });
});
