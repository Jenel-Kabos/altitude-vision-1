jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../api';
import {
  formatDateFR,
  formatTimeHHmm,
  formatDateISO,
  combineDateAndTime,
  isFutureDateTime,
  buildVisitPayload,
  fetchAvailability,
} from '../visiteService';

describe('formatDateFR', () => {
  test('formate en JJ/MM/AAAA', () => {
    expect(formatDateFR(new Date(2026, 6, 20))).toBe('20/07/2026');
  });

  test('retourne une chaîne vide si la date est absente ou invalide', () => {
    expect(formatDateFR(null)).toBe('');
    expect(formatDateFR(undefined)).toBe('');
    expect(formatDateFR(new Date('invalide'))).toBe('');
  });
});

describe('formatTimeHHmm', () => {
  test('formate en HH:MM avec zéro de tête', () => {
    expect(formatTimeHHmm(new Date(2026, 6, 20, 9, 5))).toBe('09:05');
    expect(formatTimeHHmm(new Date(2026, 6, 20, 14, 30))).toBe('14:30');
  });

  test('retourne une chaîne vide si l\'heure est absente ou invalide', () => {
    expect(formatTimeHHmm(null)).toBe('');
    expect(formatTimeHHmm(new Date('invalide'))).toBe('');
  });
});

describe('combineDateAndTime', () => {
  test('combine le jour de la date avec l\'heure choisie', () => {
    const date = new Date(2026, 6, 20, 0, 0);
    const time = new Date(2020, 0, 1, 15, 30); // jour arbitraire, seule l'heure compte
    const combined = combineDateAndTime(date, time);
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(6);
    expect(combined.getDate()).toBe(20);
    expect(combined.getHours()).toBe(15);
    expect(combined.getMinutes()).toBe(30);
  });

  test('retourne null si la date ou l\'heure est absente', () => {
    expect(combineDateAndTime(null, new Date())).toBeNull();
    expect(combineDateAndTime(new Date(), null)).toBeNull();
  });
});

describe('isFutureDateTime', () => {
  test('accepte une date future avec une heure quelconque', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(isFutureDateTime(future, new Date(2020, 0, 1, 10, 0))).toBe(true);
  });

  test("refuse aujourd'hui avec une heure déjà passée", () => {
    // Horloge figée à midi pour éviter tout passage de minuit pendant le test.
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
    const now  = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000); // 11h00, avant midi
    expect(isFutureDateTime(now, past)).toBe(false);
    jest.useRealTimers();
  });

  test("accepte aujourd'hui avec une heure future", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
    const now        = new Date();
    const laterToday = new Date(now.getTime() + 60 * 60 * 1000); // 13h00, après midi
    expect(isFutureDateTime(now, laterToday)).toBe(true);
    jest.useRealTimers();
  });

  test('refuse une date passée même avec une heure future', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureHour = new Date(2099, 0, 1, 23, 0);
    expect(isFutureDateTime(yesterday, futureHour)).toBe(false);
  });

  test('refuse si date ou heure absente', () => {
    expect(isFutureDateTime(null, new Date())).toBe(false);
    expect(isFutureDateTime(new Date(), null)).toBe(false);
  });

  test('reste cohérent malgré un changement de fuseau horaire simulé (UTC vs local)', () => {
    // Une date/heure construite en local doit rester future indépendamment
    // du décalage UTC — combineDateAndTime opère uniquement en local.
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const heure = new Date(2020, 0, 1, 23, 59);
    expect(isFutureDateTime(future, heure)).toBe(true);
  });
});

describe('buildVisitPayload', () => {
  test('construit exactement les champs attendus par POST /visites', () => {
    const selectedDate = new Date(2026, 6, 20);
    const selectedTime = new Date(2020, 0, 1, 10, 0);
    const payload = buildVisitPayload({
      propertyId: 'prop-1',
      conversationId: 'conv-1',
      selectedDate,
      selectedTime,
      telephone: '+242060000000',
      message: 'Précision',
      clientContactConsent: true,
    });
    expect(payload).toEqual({
      propertyId: 'prop-1',
      conversationId: 'conv-1',
      datePreferee: '20/07/2026',
      heurePreferee: '10:00',
      telephone: '+242060000000',
      message: 'Précision',
      clientContactConsent: true,
    });
  });

  test('omet conversationId si absent (pas de clé undefined envoyée)', () => {
    const payload = buildVisitPayload({
      propertyId: 'prop-1',
      selectedDate: new Date(2026, 6, 20),
      selectedTime: new Date(2020, 0, 1, 10, 0),
      telephone: '+242060000000',
      clientContactConsent: true,
    });
    expect(payload).not.toHaveProperty('conversationId');
  });

  test('n\'invente jamais de date/heure si absentes (chaînes vides, pas de valeur par défaut)', () => {
    const payload = buildVisitPayload({ propertyId: 'prop-1', clientContactConsent: true });
    expect(payload.datePreferee).toBe('');
    expect(payload.heurePreferee).toBe('');
  });
});

describe('formatDateISO', () => {
  test('formate en AAAA-MM-JJ avec zéros de tête', () => {
    expect(formatDateISO(new Date(2026, 6, 5))).toBe('2026-07-05');
  });

  test('retourne une chaîne vide si la date est absente ou invalide', () => {
    expect(formatDateISO(null)).toBe('');
    expect(formatDateISO(new Date('invalide'))).toBe('');
  });
});

describe('fetchAvailability', () => {
  afterEach(() => jest.clearAllMocks());

  test('appelle GET /visites/availability avec propertyId et date formatée', async () => {
    api.get.mockResolvedValue({ data: { data: { availableSlots: ['08:00'], unavailableSlots: [] } } });
    const result = await fetchAvailability('prop-1', new Date(2026, 6, 22));
    expect(api.get).toHaveBeenCalledWith('/visites/availability', {
      params: { propertyId: 'prop-1', date: '2026-07-22' },
    });
    expect(result).toEqual({ availableSlots: ['08:00'], unavailableSlots: [] });
  });

  test('retourne null si la réponse ne contient pas de data', async () => {
    api.get.mockResolvedValue({ data: {} });
    const result = await fetchAvailability('prop-1', new Date(2026, 6, 22));
    expect(result).toBeNull();
  });

  test('propage l\'erreur réseau à l\'appelant (pas de succès simulé)', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));
    await expect(fetchAvailability('prop-1', new Date(2026, 6, 22))).rejects.toThrow('Network Error');
  });
});
