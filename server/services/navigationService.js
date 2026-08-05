'use strict';

const navigation = require('../../shared/navigation');

const USER_DESTINATIONS = {
  new_property: 'PROPERTY_LIST', bien_valide: 'PROPERTY_LIST', bien_rejete: 'PROFILE',
  new_message: 'MESSAGES', new_staff_message: 'MESSAGES', message_staff: 'MESSAGES',
  visite_status: 'VISITS', visite_cancelled: 'VISITS', visite_auto_cancelled: 'VISITS',
  visite_confirmee: 'VISITS', visite_demandee: 'VISITS', visite_a_confirmer: 'VISITS',
  visite_reprogrammee: 'VISITS', visite_rappel: 'VISITS', visite_en_cours: 'VISITS',
  visite_terminee: 'VISITS', paiement_confirme: 'VISITS', paiement_echoue: 'VISITS',
  visite_auto_cancelled_owner: 'OWNER_VISITS', visite_sur_mon_bien: 'OWNER_VISITS',
  visite_annulation_demandee: 'OWNER_VISITS', visite_client_absent: 'OWNER_VISITS', visite_incident: 'OWNER_VISITS',
  transaction_created: 'PAYMENTS', transaction_finalized: 'PAYMENTS', payment_success: 'PAYMENTS',
  payment_failed: 'PAYMENTS', rental_payment_overdue: 'PAYMENTS',
  real_estate_application_submitted: 'APPLICATIONS', real_estate_application_under_review: 'APPLICATION_DETAILS',
  real_estate_application_accepted: 'APPLICATION_DETAILS', real_estate_application_rejected: 'APPLICATION_DETAILS',
  real_estate_application_withdrawn: 'APPLICATIONS', real_estate_reservation_created: 'APPLICATIONS',
  real_estate_reservation_expiring: 'APPLICATIONS', real_estate_reservation_expired: 'APPLICATIONS',
  real_estate_reservation_cancelled: 'APPLICATIONS', real_estate_reservation_converted: 'APPLICATIONS',
  rental_ready_to_publish: 'MY_PROPERTIES', rental_listing_submitted: 'MY_PROPERTIES',
  rental_listing_published: 'MY_PROPERTIES', rental_listing_suspended: 'MY_PROPERTIES',
  rental_property_occupied: 'MY_PROPERTIES', rental_notice_started: 'MY_PROPERTIES',
  rental_exit_scheduled: 'MY_PROPERTIES', rental_inspection_required: 'MY_PROPERTIES',
  rental_maintenance: 'MY_PROPERTIES', rental_maintenance_started: 'MY_PROPERTIES',
  rental_maintenance_completed: 'MY_PROPERTIES', rental_property_available: 'MY_PROPERTIES',
  rental_contract_expiring: 'MY_PROPERTIES', contrat_new: 'PROFILE', contrat_updated: 'PROFILE',
  quote_status: 'PROFILE', quote_response: 'PROFILE', account_verified: 'PROFILE', account_suspended: 'PROFILE',
  hotel_reservation_confirmed: 'HOTEL_RESERVATIONS', hotel_reservation_rejected: 'HOTEL_RESERVATIONS',
  hotel_reservation_cancelled: 'HOTEL_RESERVATIONS', hotel_reservation_expired: 'HOTEL_RESERVATIONS',
  accommodation_reservation_pending: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_reservation_confirmed: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_reservation_cancelled: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_reservation_checked_in: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_reservation_checked_out: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_reservation_no_show: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_arrival_reminder: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_checkin_today: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_checkout_today: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_payment_received: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_payment_due: 'ACCOMMODATION_RESERVATION_DETAILS',
  accommodation_payment_completed: 'ACCOMMODATION_RESERVATION_DETAILS',
  tenant_invitation_received: 'TENANT_PORTAL', tenant_invitation_accepted: 'TENANT_PORTAL', tenant_invitation_rejected: 'TENANT_PORTAL',
  tenant_link_requested: 'TENANT_PORTAL', tenant_link_approved: 'TENANT_PORTAL', tenant_link_rejected: 'TENANT_PORTAL',
  tenant_document_added: 'MY_DOCUMENT_DETAILS', tenant_receipt_added: 'MY_DOCUMENT_DETAILS', tenant_payment_recorded: 'TENANT_PAYMENTS',
  tenant_maintenance_created: 'TENANT_MAINTENANCE', tenant_maintenance_scheduled: 'TENANT_MAINTENANCE', tenant_maintenance_resolved: 'TENANT_MAINTENANCE',
  tenant_notice_recorded: 'TENANT_NOTICE', tenant_notice_acknowledged: 'TENANT_NOTICE', tenant_notice_cancelled: 'TENANT_NOTICE', tenant_notice_closed: 'TENANT_NOTICE',
};

const STAFF_DESTINATIONS = {
  new_staff_message: 'ADMIN_CONVERSATIONS', visite_new: 'ADMIN_VISITS', visite_cancelled: 'ADMIN_VISITS',
  visite_payee: 'ADMIN_VISITS', transaction_created: 'ADMIN_TRANSACTIONS',
  real_estate_application_submitted: 'ADMIN_APPLICATIONS',
  rental_ready_to_publish: 'ADMIN_RENTALS', rental_listing_submitted: 'ADMIN_RENTALS',
  rental_listing_published: 'ADMIN_RENTALS', rental_listing_suspended: 'ADMIN_RENTALS',
  rental_property_occupied: 'ADMIN_RENTALS', rental_notice_started: 'ADMIN_RENTALS',
  rental_exit_scheduled: 'ADMIN_RENTALS', rental_inspection_required: 'ADMIN_RENTALS',
  rental_maintenance: 'ADMIN_RENTALS', rental_maintenance_started: 'ADMIN_RENTALS',
  rental_maintenance_completed: 'ADMIN_RENTALS', rental_property_available: 'ADMIN_RENTALS',
  rental_payment_overdue: 'ADMIN_RENTALS', rental_contract_expiring: 'ADMIN_RENTALS', rental_owner_request: 'ADMIN_RENTALS',
  contrat_updated: 'LEASES', rental_lease_renewed: 'LEASES', rental_amendment_created: 'LEASES',
  rental_deposit_encashed: 'LEASES', rental_deposit_blocked: 'LEASES', rental_deposit_withheld: 'LEASES',
  rental_deposit_returned: 'LEASES', rental_exit_inspection_cleared: 'LEASES', rental_lease_archived: 'LEASES',
  rental_maintenance_ticket_created: 'RENTAL_MAINTENANCE', rental_maintenance_ticket_resolved: 'RENTAL_MAINTENANCE'
};

function destinationForNotification(type, audience = 'user') {
  return (audience === 'staff' ? STAFF_DESTINATIONS : USER_DESTINATIONS)[type] || null;
}

function buildNotificationNavigation({ type, destination, entityType, entityId, data = {}, audience = 'user' }) {
  const destinationId = destination || destinationForNotification(type, audience);
  const definition = navigation.getDestination(destinationId);
  if (!definition || !definition.supportsNotification) {
    return { destination: destinationId, entityType: entityType || null, entityId: entityId || null, data };
  }
  const id = entityId?.toString?.() || entityId || data.applicationId || data.conversationId || data.id;
  const params = { ...data, id };
  const mobile = navigation.resolve(destinationId, 'mobile', params);
  return {
    destination: destinationId,
    entityType: entityType || definition.entityType,
    entityId: entityId || null,
    link: navigation.resolve(destinationId, 'web', params),
    data: {
      ...data,
      destination: destinationId,
      entityType: entityType || definition.entityType,
      entityId: entityId?.toString?.() || entityId || null,
      webPath: navigation.resolve(destinationId, 'web', params),
      deepLink: navigation.buildDeepLink(destinationId, params),
      universalLink: navigation.buildDeepLink(destinationId, params, true),
      ...(mobile ? { screen: mobile.screen, params: mobile.params } : {})
    }
  };
}

module.exports = { ...navigation, USER_DESTINATIONS, STAFF_DESTINATIONS, destinationForNotification, buildNotificationNavigation };
