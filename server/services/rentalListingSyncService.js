const mongoose = require('mongoose');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Locataire = require('../models/Locataire');
const { notify, notifyStaff } = require('./notificationService');

const DISPLAY = {
  vacant: 'Vacant', preavis: 'Préavis', occupe: 'Occupé', sortie_programmee: 'Sortie programmée',
  travaux: 'Travaux', indisponible: 'Indisponible',
};

const evaluatePublicationReadiness = (property) => {
  const missingFields = [];
  const required = [
    ['title', property?.title], ['type', property?.type], ['city', property?.address?.city],
    ['arrondissement', property?.address?.arrondissement], ['neighborhood', property?.address?.neighborhood],
    ['price', Number(property?.price) > 0], ['surface', Number(property?.surface) > 0],
    ['images', Array.isArray(property?.images) && property.images.filter(Boolean).length > 0],
    ['description', property?.description], ['owner', property?.owner],
    ['transaction', property?.status === 'location'],
  ];
  required.forEach(([field, present]) => { if (!present) missingFields.push(field); });
  const warnings = [];
  if (property?.statusAdmin !== 'Validée') warnings.push('moderation_required');
  return { ready: missingFields.length === 0, missingFields, warnings };
};

const allowedActionsFor = (management, role = 'staff') => {
  if (role === 'owner') {
    const actions = ['view', 'view_history'];
    if (management.occupancyStatus === 'vacant' && management.publicationStatus !== 'publie') actions.push('request_publish');
    if (['publie', 'en_attente_moderation'].includes(management.publicationStatus)) actions.push('request_suspension');
    if (management.availabilityStatus !== 'maintenance') actions.push('report_maintenance');
    if (management.occupancyStatus === 'occupe') actions.push('declare_future_availability');
    return actions;
  }
  const actions = ['open', 'view_history'];
  if (!management.active) return actions;
  if (management.occupancyStatus === 'vacant' && management.availabilityStatus === 'disponible') actions.push('publish', 'start_maintenance');
  if (['publie', 'en_attente_moderation'].includes(management.publicationStatus)) actions.push('suspend_listing');
  if (management.occupancyStatus === 'occupe') actions.push('start_notice');
  if (management.occupancyStatus === 'sortie_programmee') {
    actions.push('validate_exit', 'start_maintenance', 'cancel_notice');
    if (!management.noticeAcknowledgedAt) actions.push('acknowledge_notice');
  }
  if (management.availabilityStatus === 'maintenance') actions.push('complete_maintenance');
  return actions;
};

const appendHistory = (management, { from, to, action, actor, source = 'api', comment = '' }) => {
  management.workflowHistory.push({ from, to, action, actor, source, comment });
};

const notifyTransition = async (management, property, type, title, body) => {
  const sequence = management.workflowHistory.length;
  const payload = {
    type, title, body, entityType: 'RentalManagement', entityId: management._id,
    metadata: { rentalManagementId: management._id, propertyId: property._id, eventType: type, updatedAt: new Date() },
    dedupeKey: `rental:${management._id}:${type}:${sequence}`,
  };
  await Promise.allSettled([
    notifyStaff(payload),
    management.owner ? notify({ ...payload, recipient: management.owner, link: '/mes-biens' }) : Promise.resolve(),
  ]);
};

const notifyCurrentTenant = async (management, type, title, body, suffix, tenantId = management.currentTenant) => {
  if (!tenantId) return;
  const tenant = await Locataire.findById(tenantId).select('user').lean();
  if (!tenant?.user) return;
  await notify({ recipient: tenant.user, type, title, body, link: '/espace-locataire', entityType: 'RentalManagement', entityId: management._id, dedupeKey: `tenant:notice:${management._id}:${suffix}:${management.workflowHistory.length}`, metadata: { rentalManagementId: String(management._id) } }).catch(() => {});
};

const loadContext = async (managementId) => {
  if (!mongoose.isValidObjectId(managementId)) {
    const error = new Error('Identifiant de gestion locative invalide.'); error.statusCode = 400; throw error;
  }
  const management = await RentalManagement.findById(managementId);
  if (!management) { const error = new Error('Dossier de gestion locative introuvable.'); error.statusCode = 404; throw error; }
  const property = await Property.findById(management.property);
  if (!property) { const error = new Error('Bien lié introuvable.'); error.statusCode = 409; throw error; }
  return { management, property };
};

const refreshReadiness = (management, property) => {
  const readiness = evaluatePublicationReadiness(property);
  management.publicationReadiness = { ...readiness, evaluatedAt: new Date() };
  return readiness;
};

const evaluateVacancyReadiness = (management) => {
  const blockers = [];
  const warnings = [];
  if (!management.exitInspectionClearedAt) blockers.push('exit_inspection_not_validated');
  if (['signalee', 'en_cours', 'controle_requis'].includes(management.maintenanceStatus)) blockers.push('maintenance_active');
  if (management.activeLease) blockers.push('active_lease');
  if (management.occupancyStatus !== 'sortie_programmee' && management.occupancyStatus !== 'travaux') warnings.push('unexpected_occupancy_status');
  return { ready: blockers.length === 0, blockers, warnings };
};

const publishRentalProperty = async (managementId, actor, comment = '') => {
  const { management, property } = await loadContext(managementId);
  if (management.publicationStatus === 'publie' && property.isPublished && property.availability === 'Disponible') {
    return { management, property, readiness: refreshReadiness(management, property) };
  }
  const readiness = refreshReadiness(management, property);
  const eligible = management.active && management.occupancyStatus === 'vacant'
    && management.availabilityStatus === 'disponible' && management.publicationAuthorized;
  if (!eligible || !readiness.ready) {
    await management.save();
    const error = new Error('Le bien n’est pas prêt à être publié.');
    error.statusCode = 422; error.readiness = readiness; throw error;
  }

  const from = management.publicationStatus;
  property.status = 'location';
  property.availability = 'Disponible';
  property.price = management.monthlyRent ?? property.price;
  if (property.statusAdmin === 'Validée') {
    property.isPublished = true;
    management.publicationStatus = 'publie';
    management.lastPublishedAt = new Date();
  } else {
    property.isPublished = false;
    if (property.statusAdmin !== 'En attente') property.statusAdmin = 'En attente';
    management.publicationStatus = 'en_attente_moderation';
  }
  appendHistory(management, { from, to: management.publicationStatus, action: 'publish', actor, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(
    management, property,
    management.publicationStatus === 'publie' ? 'rental_listing_published' : 'rental_listing_submitted',
    management.publicationStatus === 'publie' ? 'Annonce locative publiée' : 'Annonce soumise à modération',
    `Le bien « ${property.title} » a changé de statut de publication.`,
  );
  return { management, property, readiness };
};

const suspendRentalListing = async (managementId, actor, comment = '') => {
  const { management, property } = await loadContext(managementId);
  if (management.publicationStatus === 'suspendu' && !property.isPublished) return { management, property };
  const from = management.publicationStatus;
  property.isPublished = false;
  management.publicationStatus = 'suspendu';
  appendHistory(management, { from, to: 'suspendu', action: 'suspend_listing', actor, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_listing_suspended', 'Annonce locative suspendue', `L’annonce « ${property.title} » a été suspendue.`);
  return { management, property };
};

const markPropertyRented = async (managementId, { leaseId, tenantId, actor, comment = '', source = 'contract' } = {}) => {
  const { management, property } = await loadContext(managementId);
  if (management.occupancyStatus === 'occupe' && (!leaseId || management.activeLease?.toString() === leaseId.toString())) return { management, property };
  const from = management.occupancyStatus;
  management.occupancyStatus = 'occupe';
  management.availabilityStatus = 'loue';
  management.publicationStatus = 'suspendu';
  management.activeLease = leaseId || management.activeLease;
  management.currentTenant = tenantId || management.currentTenant;
  property.availability = 'Loué';
  property.isPublished = false;
  appendHistory(management, { from, to: 'occupe', action: 'lease_activated', actor, source, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_property_occupied', 'Bien désormais occupé', `Le bien « ${property.title} » est occupé et son annonce est suspendue.`);
  // GL-ASSET-1 — best-effort : fait avancer le cycle de vie patrimonial du
  // bien (indépendant du bail) sans jamais faire échouer l'activation
  // locative elle-même.
  await require('./propertyAssetLifecycleService').transition(property._id, 'en_location', { actor, comment: 'Bail activé', action: 'lease_activated', bestEffort: true }).catch(() => {});
  return { management, property };
};

const schedulePropertyExit = async (managementId, { actor, comment = '', source = 'contract' } = {}) => {
  const { management, property } = await loadContext(managementId);
  if (management.occupancyStatus === 'sortie_programmee' && !management.activeLease) return { management, property };
  const from = management.occupancyStatus;
  management.occupancyStatus = 'sortie_programmee';
  management.availabilityStatus = 'indisponible';
  management.publicationStatus = 'suspendu';
  management.activeLease = null;
  property.availability = 'Indisponible';
  property.isPublished = false;
  appendHistory(management, { from, to: 'sortie_programmee', action: 'lease_ended', actor, source, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_exit_scheduled', 'Sortie locative programmée', `Une sortie et un état des lieux sont requis pour « ${property.title} ».`);
  await notifyTransition(management, property, 'rental_inspection_required', 'État des lieux de sortie requis', `Le bien « ${property.title} » restera indisponible jusqu’à validation de sa sortie.`);
  return { management, property };
};

const startNotice = async (managementId, { actor, comment = '', plannedExitAt, source = 'api' } = {}) => {
  const { management, property } = await loadContext(managementId);
  const planned = new Date(plannedExitAt);
  if (!plannedExitAt || Number.isNaN(planned.getTime()) || planned <= new Date()) {
    const error = new Error('Une date de sortie future valide est obligatoire.'); error.statusCode = 422; throw error;
  }
  if (management.occupancyStatus === 'sortie_programmee' && management.plannedExitAt?.getTime() === planned.getTime()) return { management, property };
  const from = management.occupancyStatus;
  management.noticeStartedAt = new Date(); management.plannedExitAt = planned;
  management.occupancyStatus = 'sortie_programmee'; management.availabilityStatus = 'indisponible';
  management.publicationStatus = 'suspendu'; property.availability = 'Indisponible'; property.isPublished = false;
  appendHistory(management, { from, to: 'sortie_programmee', action: 'notice_started', actor, source, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_notice_started', 'Préavis enregistré', `Une sortie est programmée pour le bien « ${property.title} ».`);
  await notifyCurrentTenant(management, 'tenant_notice_recorded', 'Préavis enregistré', `Votre départ est programmé le ${planned.toLocaleDateString('fr-FR')}.`, 'started');
  // GL-LIFE-1 — le préavis fait avancer le cycle de vie du bail
  // (actif → preavis) et bloque la caution si elle avait été encaissée.
  // Best-effort : un bail non 'actif' (legacy, ou cycle déjà avancé) ne doit
  // jamais faire échouer la prise de préavis elle-même.
  if (management.activeLease) {
    require('./rentalLeaseLifecycleService').transition(management.activeLease, 'preavis', { actor, comment: 'Préavis démarré', action: 'notice_started' }).catch(() => {});
    require('./rentalLeaseCautionService').bloquerCaution(management.activeLease, { actor, comment: 'Préavis démarré' }).catch(() => {});
  }
  // GL-ASSET-1 — best-effort : le préavis fait aussi avancer le cycle de vie
  // patrimonial du bien lui-même (indépendant du bail).
  await require('./propertyAssetLifecycleService').transition(property._id, 'preavis', { actor, comment: 'Préavis démarré', action: 'notice_started', bestEffort: true }).catch(() => {});
  return { management, property };
};

// ─────────────────────────────────────────────
// Sprint GL-B2 — accusé de réception et annulation d'un préavis en cours.
// `startNotice` (ci-dessus) fait déjà "création" ; ces deux fonctions
// complètent le cycle demandé par la mission (§Préavis) sans dupliquer la
// logique de transition déjà centralisée ici.
// ─────────────────────────────────────────────
const acknowledgeNotice = async (managementId, { actor, comment = '' } = {}) => {
  const { management, property } = await loadContext(managementId);
  if (management.occupancyStatus !== 'sortie_programmee') {
    const error = new Error("Aucun préavis en cours pour ce dossier."); error.statusCode = 409; throw error;
  }
  if (management.noticeAcknowledgedAt) return { management, property };
  management.noticeAcknowledgedAt = new Date();
  appendHistory(management, {
    from: management.occupancyStatus, to: management.occupancyStatus,
    action: 'notice_acknowledged', actor, comment,
  });
  await management.save();
  await notifyTransition(management, property, 'rental_notice_acknowledged', 'Préavis accusé réception', `Le préavis pour « ${property.title} » a été accusé réception.`);
  await notifyCurrentTenant(management, 'tenant_notice_acknowledged', 'Préavis validé', 'Votre préavis a été accusé réception par le gestionnaire.', 'acknowledged');
  return { management, property };
};

const cancelNotice = async (managementId, { actor, comment = '' } = {}) => {
  const { management, property } = await loadContext(managementId);
  if (management.occupancyStatus !== 'sortie_programmee') {
    const error = new Error("Aucun préavis en cours pour ce dossier."); error.statusCode = 409; throw error;
  }
  const from = management.occupancyStatus;
  management.occupancyStatus = 'occupe';
  management.availabilityStatus = 'indisponible';
  management.publicationStatus = 'suspendu';
  management.noticeStartedAt = null;
  management.plannedExitAt = null;
  management.noticeAcknowledgedAt = null;
  property.availability = 'Loué';
  appendHistory(management, { from, to: 'occupe', action: 'notice_cancelled', actor, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_notice_cancelled', 'Préavis annulé', `Le préavis pour « ${property.title} » a été annulé — le locataire reste en place.`);
  await notifyCurrentTenant(management, 'tenant_notice_cancelled', 'Préavis annulé', 'Votre préavis a été annulé.', 'cancelled');
  await require('./propertyAssetLifecycleService').transition(property._id, 'en_location', { actor, comment: 'Préavis annulé', action: 'notice_cancelled', bestEffort: true }).catch(() => {});
  return { management, property };
};

const markPropertyVacant = async (managementId, { actor, comment = '' } = {}) => {
  const { management, property } = await loadContext(managementId);
  const departingTenant = management.currentTenant;
  const vacancyReadiness = evaluateVacancyReadiness(management);
  if (!vacancyReadiness.ready) {
    const error = new Error('La sortie doit être validée et sans blocage avant remise en disponibilité.'); error.statusCode = 422; error.vacancyReadiness = vacancyReadiness; throw error;
  }
  const from = management.occupancyStatus;
  management.occupancyStatus = 'vacant';
  management.availabilityStatus = 'disponible';
  management.currentTenant = null;
  management.lastVacatedAt = new Date();
  property.availability = 'Disponible';
  property.isPublished = false;
  if (management.publicationStatus === 'publie') management.publicationStatus = 'suspendu';
  appendHistory(management, { from, to: 'vacant', action: 'mark_vacant', actor, comment });
  const readiness = refreshReadiness(management, property);
  await Promise.all([property.save(), management.save()]);
  if (departingTenant) await notifyCurrentTenant(management, 'tenant_notice_closed', 'Départ locatif clôturé', 'Votre sortie locative a été clôturée.', 'closed', departingTenant);
  await notifyTransition(management, property, 'rental_property_available', 'Bien disponible', `Le bien « ${property.title} » est de nouveau disponible.`);
  await require('./propertyAssetLifecycleService').transition(property._id, 'disponible', { actor, comment: 'Bien remis en disponibilité', action: 'mark_vacant', bestEffort: true }).catch(() => {});
  if (management.publicationPolicy === 'automatique' && management.publicationAuthorized) {
    return publishRentalProperty(management._id, actor, 'Republication après validation de sortie');
  }
  return { management, property, readiness };
};

const markMaintenance = async (managementId, { actor, comment = '' } = {}) => {
  const { management, property } = await loadContext(managementId);
  if (management.availabilityStatus === 'maintenance' && management.maintenanceStatus === 'en_cours') return { management, property };
  const from = management.occupancyStatus;
  management.occupancyStatus = 'travaux'; management.availabilityStatus = 'maintenance';
  management.maintenanceStatus = 'en_cours'; management.maintenanceReason = comment; management.publicationStatus = 'suspendu';
  property.availability = 'En maintenance'; property.isPublished = false;
  appendHistory(management, { from, to: 'travaux', action: 'maintenance_started', actor, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_maintenance_started', 'Maintenance démarrée', `Le bien « ${property.title} » est indisponible pendant la maintenance.`);
  await require('./propertyAssetLifecycleService').transition(property._id, 'travaux', { actor, comment, action: 'maintenance_started', bestEffort: true }).catch(() => {});
  return { management, property };
};

const completeMaintenance = async (managementId, { actor, comment = '', controlValidated = false } = {}) => {
  const { management, property } = await loadContext(managementId);
  if (!controlValidated) { const error = new Error('Le contrôle de fin de maintenance doit être validé.'); error.statusCode = 422; throw error; }
  if (management.maintenanceStatus === 'validee' && management.occupancyStatus === 'vacant') return { management, property, readiness: refreshReadiness(management, property) };
  const from = management.occupancyStatus;
  management.maintenanceStatus = 'aucune'; management.maintenanceReason = '';
  management.occupancyStatus = 'vacant'; management.availabilityStatus = 'disponible';
  property.availability = 'Disponible'; property.isPublished = false;
  const readiness = refreshReadiness(management, property);
  appendHistory(management, { from, to: 'vacant', action: 'maintenance_completed', actor, comment });
  await Promise.all([property.save(), management.save()]);
  await notifyTransition(management, property, 'rental_maintenance_completed', 'Maintenance terminée', `La maintenance du bien « ${property.title} » a été validée.`);
  await require('./propertyAssetLifecycleService').transition(property._id, 'disponible', { actor, comment, action: 'maintenance_completed', bestEffort: true }).catch(() => {});
  if (management.publicationPolicy === 'automatique' && management.publicationAuthorized && readiness.ready) {
    return publishRentalProperty(management._id, actor, 'Republication après maintenance validée');
  }
  return { management, property, readiness };
};

const serializeRentalManagement = (management, role = 'staff') => ({
  ...management.toObject(),
  displayStatus: DISPLAY[management.occupancyStatus] || management.occupancyStatus,
  allowedActions: allowedActionsFor(management, role),
});

module.exports = {
  evaluatePublicationReadiness, evaluateVacancyReadiness, allowedActionsFor, refreshReadiness, publishRentalProperty,
  suspendRentalListing, markPropertyRented, schedulePropertyExit, markPropertyVacant,
  startNotice, acknowledgeNotice, cancelNotice, markMaintenance, completeMaintenance, serializeRentalManagement,
};
