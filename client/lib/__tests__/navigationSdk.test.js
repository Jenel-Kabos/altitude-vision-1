import { describe, expect, it } from 'vitest';
import { canAccessDestination, getDestination, resolveNotificationWebRoute, resolveWebDestination } from '../navigation/navigationSdk';

describe('SDK de navigation Web', () => {
  it('résout une destination canonique avec paramètres', () => {
    expect(resolveWebDestination('PROPERTY_DETAILS', { id: 12 })).toBe('/immobilier/property/12');
  });

  it('privilégie destination puis conserve les anciens replis', () => {
    expect(resolveNotificationWebRoute({ destination: 'VISITS', link: '/ancienne' })).toBe('/mes-visites');
    expect(resolveNotificationWebRoute({ link: '/ancienne' })).toBe('/ancienne');
  });

  it('expose le contrat RBAC partagé', () => {
    expect(canAccessDestination(getDestination('ADMIN_VISITS'), { authenticated: true, role: 'Client' })).toBe(false);
  });
});
