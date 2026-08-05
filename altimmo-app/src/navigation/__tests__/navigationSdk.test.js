import { linking, resolveMobileDestination, resolveNotificationMobileTarget } from '../navigationSdk';

describe('SDK de navigation Mobile', () => {
  test('résout les destinations imbriquées React Navigation', () => {
    expect(resolveMobileDestination('PROPERTY_DETAILS', { id: 'p-1' })).toEqual({
      screen: 'Annonces', params: { screen: 'DetailAnnonce', params: { propertyId: 'p-1' } },
    });
  });

  test('résout un payload de notification canonique', () => {
    expect(resolveNotificationMobileTarget({ destination: 'APPLICATION_DETAILS', entityId: 'a-1' }))
      .toEqual({ screen: 'Profil', params: { screen: 'RealEstateApplicationDetail', params: { applicationId: 'a-1' } } });
  });

  test('conserve les préfixes et chemins entrants historiques', () => {
    expect(linking.prefixes).toEqual(['altimmo://', 'https://altitudevision.agency']);
    expect(linking.config.screens.Main.screens.Profil.screens.Transactions).toBe('paiement/success');
    expect(linking.config.screens.Main.screens.Profil.screens.PaiementCancel).toBe('paiement/cancel');
  });

  test('résout toutes les sections du portail locataire depuis le registre', () => {
    expect(resolveMobileDestination('TENANT_DOCUMENTS')).toEqual({
      screen: 'Profil', params: { screen: 'TenantPortal', params: { section: 'documents' } },
    });
    expect(linking.config.screens.Main.screens.Profil.screens.TenantPortal.path).toBe('espace-locataire/:section?');
  });

  test('résout liste, détail et réservation Accommodation via NAV-CORE', () => {
    expect(resolveMobileDestination('ACCOMMODATION_RESERVATIONS')).toEqual({
      screen: 'Profil', params: { screen: 'MyAccommodationReservations' },
    });
    expect(resolveNotificationMobileTarget({ destination: 'ACCOMMODATION_RESERVATION_DETAILS', entityId: 'acc-r-1' }))
      .toEqual({ screen: 'Profil', params: { screen: 'AccommodationReservationDetail', params: { reservationId: 'acc-r-1' } } });
    expect(linking.config.screens.Main.screens.Profil.screens.AccommodationBooking).toBe('hebergements/:id/reserver');
  });

  test('résout le coffre et un document personnel via NAV-CORE', () => {
    expect(resolveMobileDestination('MY_DOCUMENTS')).toEqual({ screen: 'Profil', params: { screen: 'MyDocuments' } });
    expect(resolveNotificationMobileTarget({ destination: 'MY_DOCUMENT_DETAILS', entityId: 'doc-1' }))
      .toEqual({ screen: 'Profil', params: { screen: 'PersonalDocumentDetail', params: { documentId: 'doc-1' } } });
    expect(linking.config.screens.Main.screens.Profil.screens.PersonalDocumentDetail).toBe('mes-documents/:id');
  });
});
