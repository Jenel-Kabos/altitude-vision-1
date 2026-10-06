import {
  INDIVIDUAL_RENTAL_CONTEXT,
  ORGANIZATION_RENTAL_CONTEXT,
  rentalBasePath,
  rentalRequestConfig,
} from '../services/rentalRequestContext';

describe('C2.10C rental request context', () => {
  test('individual injecte scope=individual et supprime tout header tenant résiduel', () => {
    expect(rentalRequestConfig(
      INDIVIDUAL_RENTAL_CONTEXT,
      { page: 2 },
      { headers: { 'X-Platform-Tenant-Id': 'stale', 'X-Tenant-Id': 'stale-tenant' }, responseType: 'blob' },
    )).toEqual({
      params: { page: 2, scope: 'individual' },
      headers: {},
      responseType: 'blob',
      platformScoped: true,
    });
  });

  test('organization conserve son contexte HTTP et ne force jamais scope=individual', () => {
    expect(rentalRequestConfig(
      ORGANIZATION_RENTAL_CONTEXT,
      { page: 3 },
      { headers: { 'X-Platform-Tenant-Id': 'tenant-x' } },
    )).toEqual({ params: { page: 3 }, headers: { 'X-Platform-Tenant-Id': 'tenant-x' } });
  });

  test('les chemins opérationnels partagent le métier mais pas le préfixe UI', () => {
    expect(rentalBasePath(INDIVIDUAL_RENTAL_CONTEXT)).toBe('/mes-biens/gestion-locative');
    expect(rentalBasePath(ORGANIZATION_RENTAL_CONTEXT)).toBe('/dashboard/gestion-locative');
  });
});
