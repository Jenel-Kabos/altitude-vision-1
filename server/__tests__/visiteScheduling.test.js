const {
  VISIT_DURATION_MINUTES,
  computeVisitEnd,
  computeConflictWindow,
  slotsOverlap,
  isWithinOpeningHours,
  localParts,
  parseHHmmToMinutes,
  formatMinutesToHHmm,
} = require('../config/visiteScheduling');

// Africa/Brazzaville = UTC+1 fixe — on construit les horaires locaux en UTC-1h.
const brazzaville = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 1, min));

describe('VISIT_DURATION_MINUTES', () => {
  test('durée centralisée à 120 minutes (2h)', () => {
    expect(VISIT_DURATION_MINUTES).toBe(120);
  });
});

describe('computeVisitEnd', () => {
  test('ajoute exactement la durée configurée', () => {
    const start = brazzaville(2026, 7, 22, 10, 0);
    const end = computeVisitEnd(start);
    expect(end.getTime() - start.getTime()).toBe(VISIT_DURATION_MINUTES * 60000);
  });
});

describe('slotsOverlap — détection de chevauchement (Phase 4 / Phase 11 pts 3-8, 15)', () => {
  // Visite existante référence : 10:00–12:00
  const existing = brazzaville(2026, 7, 22, 10, 0);

  test('08:00–10:00 juste avant : acceptée (pas de chevauchement)', () => {
    const newStart = brazzaville(2026, 7, 22, 8, 0);
    expect(slotsOverlap(existing, newStart)).toBe(false);
  });

  test('10:00–12:00 même créneau exact : refusée', () => {
    const newStart = brazzaville(2026, 7, 22, 10, 0);
    expect(slotsOverlap(existing, newStart)).toBe(true);
  });

  test('11:00–13:00 chevauchement partiel : refusée', () => {
    const newStart = brazzaville(2026, 7, 22, 11, 0);
    expect(slotsOverlap(existing, newStart)).toBe(true);
  });

  test('12:00–14:00 immédiatement après : acceptée (contiguë, pas de chevauchement)', () => {
    const newStart = brazzaville(2026, 7, 22, 12, 0);
    expect(slotsOverlap(existing, newStart)).toBe(false);
  });

  test('14:00–16:00 largement après : acceptée', () => {
    const newStart = brazzaville(2026, 7, 22, 14, 0);
    expect(slotsOverlap(existing, newStart)).toBe(false);
  });

  test('deux clients différents sur des créneaux différents le même jour : acceptés', () => {
    const clientB = brazzaville(2026, 7, 22, 8, 0);
    const clientC = brazzaville(2026, 7, 22, 12, 0);
    const clientD = brazzaville(2026, 7, 22, 14, 0);
    expect(slotsOverlap(existing, clientB)).toBe(false);
    expect(slotsOverlap(existing, clientC)).toBe(false);
    expect(slotsOverlap(existing, clientD)).toBe(false);
  });
});

describe('isWithinOpeningHours — Phase 3 (horaires réels du site, AltimmoContact.jsx)', () => {
  test('Lun-Ven 16:00–18:00 : accepté (se termine exactement à la fermeture)', () => {
    const start = brazzaville(2026, 7, 22, 16, 0); // mercredi
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(true);
  });

  test('Lun-Ven 17:00–19:00 : refusé (dépasse la fermeture de 18h)', () => {
    const start = brazzaville(2026, 7, 22, 17, 0);
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(false);
  });

  test('Lun-Ven avant ouverture (07:00) : refusé', () => {
    const start = brazzaville(2026, 7, 22, 7, 0);
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(false);
  });

  test('Lun-Ven pile à l\'ouverture (08:00) : accepté', () => {
    const start = brazzaville(2026, 7, 22, 8, 0);
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(true);
  });

  test('Samedi 12:00–14:00 : accepté (horaires réduits 9h-14h)', () => {
    const start = brazzaville(2026, 7, 25, 12, 0); // samedi
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(true);
  });

  test('Samedi 13:00–15:00 : refusé (dépasse la fermeture de 14h le samedi)', () => {
    const start = brazzaville(2026, 7, 25, 13, 0);
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(false);
  });

  test('Dimanche : toujours refusé (agence fermée)', () => {
    const start = brazzaville(2026, 7, 26, 10, 0); // dimanche
    expect(isWithinOpeningHours(start, computeVisitEnd(start))).toBe(false);
  });
});

describe('localParts / parseHHmmToMinutes / formatMinutesToHHmm', () => {
  test('parseHHmmToMinutes convertit correctement', () => {
    expect(parseHHmmToMinutes('08:00')).toBe(480);
    expect(parseHHmmToMinutes('18:00')).toBe(1080);
  });

  test('formatMinutesToHHmm est l\'inverse de parseHHmmToMinutes', () => {
    expect(formatMinutesToHHmm(480)).toBe('08:00');
    expect(formatMinutesToHHmm(1080)).toBe('18:00');
    expect(formatMinutesToHHmm(600)).toBe('10:00');
  });

  test('localParts lit l\'heure/jour locaux Africa/Brazzaville indépendamment du fuseau serveur', () => {
    const wednesday10am = brazzaville(2026, 7, 22, 10, 0);
    const { dayKey, minutesOfDay } = localParts(wednesday10am);
    expect(dayKey).toBe('wednesday');
    expect(minutesOfDay).toBe(600);
  });
});
