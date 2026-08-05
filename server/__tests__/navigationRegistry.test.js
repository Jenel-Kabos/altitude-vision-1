const {
  registry, getDestination, resolve, buildDeepLink, canAccess,
  buildNotificationNavigation,
} = require('../services/navigationService');

describe('registre de navigation NAV-CORE-1', () => {
  test('chaque destination respecte le contrat et possède un identifiant unique', () => {
    const ids = registry.destinations.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    registry.destinations.forEach((destination) => {
      expect(destination).toEqual(expect.objectContaining({
        id: expect.any(String), entityType: expect.any(String), webRoute: expect.any(String),
        requiresAuth: expect.any(Boolean), roles: expect.any(Array),
        supportsNotification: expect.any(Boolean), supportsDocuments: expect.any(Boolean),
      }));
      expect(Object.prototype.hasOwnProperty.call(destination, 'mobileRoute')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(destination, 'deepLink')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(destination, 'universalLink')).toBe(true);
    });
  });

  test('résout les routes Web, Mobile et les deux formes de lien', () => {
    expect(resolve('PROPERTY_DETAILS', 'web', { id: 'abc 1' })).toBe('/immobilier/property/abc%201');
    expect(resolve('PROPERTY_DETAILS', 'mobile', { id: '42' })).toEqual({
      screen: 'Annonces', params: { screen: 'DetailAnnonce', params: { propertyId: '42' } },
    });
    expect(buildDeepLink('PROPERTY_DETAILS', { id: '42' })).toBe('altimmo://annonces/42');
    expect(buildDeepLink('PROPERTY_DETAILS', { id: '42' }, true)).toBe('https://altitudevision.agency/annonces/42');
  });

  test('n invente pas de route mobile pour la gestion locative', () => {
    expect(resolve('LEASES', 'mobile')).toBeNull();
  });

  test('applique authentification et RBAC', () => {
    const leases = getDestination('LEASES');
    expect(canAccess(leases, { authenticated: false, role: 'Admin' })).toBe(false);
    expect(canAccess(leases, { authenticated: true, role: 'Client' })).toBe(false);
    expect(canAccess(leases, { authenticated: true, role: 'GestionnaireImmobilier' })).toBe(true);
  });

  test('enrichit un payload notification sans retirer les données historiques', () => {
    const result = buildNotificationNavigation({
      type: 'real_estate_application_accepted', entityId: 'app-1', data: { legacy: true },
    });
    expect(result).toEqual(expect.objectContaining({
      destination: 'APPLICATION_DETAILS', entityType: 'realEstateApplication', entityId: 'app-1',
      link: '/immobilier/dossiers',
    }));
    expect(result.data).toEqual(expect.objectContaining({
      legacy: true, destination: 'APPLICATION_DETAILS', entityId: 'app-1',
      deepLink: 'altimmo://dossiers-immobiliers/app-1',
      screen: 'Profil',
    }));
  });

  test('relie les notifications locatives exclusivement au portail natif', () => {
    const maintenance = buildNotificationNavigation({ type: 'tenant_maintenance_scheduled', entityId: 'ticket-1' });
    expect(maintenance.destination).toBe('TENANT_MAINTENANCE');
    expect(maintenance.data.screen).toBe('Profil');
    expect(maintenance.data.params).toEqual({ screen: 'TenantPortal', params: { section: 'maintenance' } });
  });

  test('ouvre un nouveau document locatif dans le coffre personnel via NAV-CORE', () => {
    const result = buildNotificationNavigation({ type: 'tenant_document_added', entityId: 'doc-1' });
    expect(result.destination).toBe('MY_DOCUMENT_DETAILS');
    expect(result.data.params).toEqual({ screen: 'PersonalDocumentDetail', params: { documentId: 'doc-1' } });
    expect(result.data.deepLink).toBe('altimmo://mes-documents/doc-1');
  });

  test('relie toutes les notifications ACC-1 au détail canonique du séjour', () => {
    ['accommodation_reservation_confirmed', 'accommodation_payment_received', 'accommodation_checkout_today'].forEach((type) => {
      const result = buildNotificationNavigation({ type, entityId: 'reservation-1' });
      expect(result.destination).toBe('ACCOMMODATION_RESERVATION_DETAILS');
      expect(result.data.screen).toBe('Profil');
      expect(result.data.params).toEqual({ screen: 'AccommodationReservationDetail', params: { reservationId: 'reservation-1' } });
      expect(result.data.deepLink).toBe('altimmo://mes-hebergements/reservation-1');
    });
  });
});
