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

  // SYNC-2C — notifications hospitality opérationnelles (housekeeping/inspection/
  // maintenance/réservation propriétaire), envoyées par `notify`/`notifyStaff` avec
  // les `type` réels de server/services/housekeepingService.js, inspectionService.js,
  // maintenanceService.js, hotelReservationService.js — jamais un type inventé.
  test('une notification housekeeping/inspection (audience staff) ouvre HotelHousekeepingScreen contextualisé', () => {
    ['housekeeping_task_created', 'housekeeping_task_assigned', 'housekeeping_task_completed', 'room_inspection_failed', 'room_returned_to_service'].forEach((type) => {
      const result = buildNotificationNavigation({ type, audience: 'staff', entityId: 'task-1', data: { hotelId: 'hotel-1' } });
      expect(result.destination).toBe('HOUSEKEEPING');
      expect(result.data.params).toEqual({ screen: 'HotelHousekeeping', params: { hotelId: 'hotel-1' } });
    });
  });

  test('une notification maintenance hôtelière (audience staff) ouvre HotelMaintenanceScreen, jamais RENTAL_MAINTENANCE', () => {
    ['maintenance_ticket_created', 'maintenance_ticket_assigned', 'maintenance_ticket_resolved'].forEach((type) => {
      const result = buildNotificationNavigation({ type, audience: 'staff', entityId: 'ticket-1', data: { hotelId: 'hotel-1' } });
      expect(result.destination).toBe('HOTEL_MAINTENANCE');
      expect(result.data.params).toEqual({ screen: 'HotelMaintenance', params: { hotelId: 'hotel-1' } });
    });
    // Non-régression : la maintenance LOCATIVE reste sur sa propre destination.
    const rental = buildNotificationNavigation({ type: 'rental_maintenance_ticket_created', audience: 'staff', entityId: 'ticket-2' });
    expect(rental.destination).toBe('RENTAL_MAINTENANCE');
  });

  test('hotel_reservation_pending (propriétaire, audience user par défaut) ouvre HotelOperationsScreen, jamais l’écran voyageur', () => {
    const result = buildNotificationNavigation({ type: 'hotel_reservation_pending', entityId: 'res-1', data: { hotelId: 'hotel-1' } });
    expect(result.destination).toBe('HOTEL_OPERATIONS');
    expect(result.data.params).toEqual({ screen: 'HotelOperations', params: { hotelId: 'hotel-1' } });
  });

  test('les événements voyageur hotel_reservation_* restent sur HOTEL_RESERVATIONS (écran voyageur)', () => {
    ['hotel_reservation_created', 'hotel_reservation_checked_in', 'hotel_reservation_checked_out', 'hotel_reservation_modified', 'hotel_reservation_confirmed'].forEach((type) => {
      const result = buildNotificationNavigation({ type, entityId: 'res-1' });
      expect(result.destination).toBe('HOTEL_RESERVATIONS');
      expect(result.data.params).toEqual({ screen: 'MyHotelReservations' });
    });
  });

  test('hotel_financial_draft_failed reste volontairement sans destination (finance Web/Admin-only)', () => {
    const result = buildNotificationNavigation({ type: 'hotel_financial_draft_failed', audience: 'staff', data: { hotelId: 'hotel-1' } });
    expect(result.destination).toBeNull();
    expect(result.data.screen).toBeUndefined();
  });

  // POST-E2E-2 — bug réel démontré (POST_E2E1_REPORT.md §23,
  // POST_E2E2_ETAT_INITIAL.md §3) : ces 3 types pointaient vers `MESSAGES`
  // (liste générique) au lieu de `CONVERSATION` (chat précis), perdant le
  // `conversationId` et empêchant systématiquement l'ouverture de LA
  // conversation concernée depuis une notification. `CONVERSATION` doit
  // interpoler `:id` depuis `data.conversationId`.
  test('new_message/new_staff_message/message_staff ouvrent la conversation précise, jamais la liste générique', () => {
    ['new_message', 'new_staff_message', 'message_staff'].forEach((type) => {
      const result = buildNotificationNavigation({ type, data: { conversationId: 'conv-1' } });
      expect(result.destination).toBe('CONVERSATION');
      expect(result.data.params).toEqual({ screen: 'Chat', params: { conversationId: 'conv-1' } });
      expect(result.data.deepLink).toBe('altimmo://messages/conv-1');
    });
  });
});
