const { validateDashboardFilters } = require('../services/finance/hotelFinancialDashboardService');

describe('hotelFinancialDashboardService — validateDashboardFilters', () => {
  test('applique une période par défaut de 30 jours quand aucune date n’est fournie', () => {
    const filters = validateDashboardFilters({});
    expect(filters.dateFrom.getTime()).toBeLessThan(filters.dateTo.getTime());
    expect(Math.round(filters.spanDays)).toBe(30);
  });

  test('rejette une date invalide', () => {
    expect(() => validateDashboardFilters({ dateFrom: 'pas-une-date' })).toThrow(/dateFrom/);
  });

  test('rejette dateFrom postérieure à dateTo', () => {
    expect(() => validateDashboardFilters({ dateFrom: '2026-02-01', dateTo: '2026-01-01' })).toThrow(/dateFrom doit précéder/);
  });

  test('rejette une période excessive', () => {
    expect(() => validateDashboardFilters({ dateFrom: '2020-01-01', dateTo: '2026-01-01' })).toThrow(/FINANCIAL_DASHBOARD_PERIOD_TOO_LARGE|excéder/);
  });

  test('rejette un hotelId invalide', () => {
    expect(() => validateDashboardFilters({ hotelId: 'pas-un-object-id' })).toThrow(/hotelId invalide/);
  });

  test('accepte un hotelId ObjectId valide', () => {
    const filters = validateDashboardFilters({ hotelId: '507f1f77bcf86cd799439011' });
    expect(filters.hotelId).toBe('507f1f77bcf86cd799439011');
  });

  test('rejette un documentStatus inconnu', () => {
    expect(() => validateDashboardFilters({ documentStatus: 'inexistant' })).toThrow(/documentStatus inconnu/);
  });

  test('accepte un documentStatus valide', () => {
    const filters = validateDashboardFilters({ documentStatus: 'issued' });
    expect(filters.documentStatus).toBe('issued');
  });

  test('rejette un paymentStatus inconnu', () => {
    expect(() => validateDashboardFilters({ paymentStatus: 'inexistant' })).toThrow(/paymentStatus inconnu/);
  });

  test('rejette un deliveryStatus inconnu', () => {
    expect(() => validateDashboardFilters({ deliveryStatus: 'inexistant' })).toThrow(/deliveryStatus inconnu/);
  });

  test('choisit automatiquement une granularité cohérente avec la durée de la période', () => {
    expect(validateDashboardFilters({ dateFrom: '2026-01-01', dateTo: '2026-01-10' }).granularity).toBe('day');
    expect(validateDashboardFilters({ dateFrom: '2026-01-01', dateTo: '2026-04-01' }).granularity).toBe('week');
    expect(validateDashboardFilters({ dateFrom: '2025-01-01', dateTo: '2026-01-01' }).granularity).toBe('month');
  });

  test('rejette une granularité explicite inconnue', () => {
    expect(() => validateDashboardFilters({ granularity: 'annee' })).toThrow(/granularity inconnue/);
  });

  test('respecte une granularité explicite valide même si elle diffère de la suggestion automatique', () => {
    const filters = validateDashboardFilters({ dateFrom: '2026-01-01', dateTo: '2026-01-10', granularity: 'month' });
    expect(filters.granularity).toBe('month');
  });

  test('clampe la pagination (page/limit) dans les bornes attendues', () => {
    const filters = validateDashboardFilters({ page: 3, limit: 500 });
    expect(filters.page).toBe(3);
    expect(filters.limit).toBe(100);
  });

  test('rejette une pagination négative', () => {
    expect(() => validateDashboardFilters({ page: -1 })).toThrow(/page\/limit ne peuvent être négatifs/);
  });

  test('échappe les caractères regex dans la recherche et tronque la longueur', () => {
    const filters = validateDashboardFilters({ search: `a.*b${'x'.repeat(200)}` });
    expect(filters.search).not.toContain('.*');
    expect(filters.search.length).toBeLessThanOrEqual(200);
  });

  test('ne modifie pas la devise de référence (XAF) exposée par défaut', () => {
    const filters = validateDashboardFilters({});
    expect(filters).not.toHaveProperty('currency');
  });
});
