const mongoose = require('mongoose');
const Property = require('../../models/Property');
const Hotel = require('../../models/Hotel');
const Accommodation = require('../../models/Accommodation');
const Conversation = require('../../models/Conversation');
const HotelReservation = require('../../models/HotelReservation');
const AccommodationReservation = require('../../models/AccommodationReservation');
const Contrat = require('../../models/Contrat');
const { resolveAvailableTenantsForUser } = require('./tenantContextService');

const rawId = (value) => value?._id || value?.id || value || null;
const validId = (value) => (mongoose.isValidObjectId(rawId(value)) ? rawId(value) : null);
const resolved = (tenantId, proof, confidence = 1) => ({ status: 'resolved', tenantId: String(tenantId), proof, confidence });
const unresolved = (proof = []) => ({ status: 'unresolved', tenantId: null, proof, confidence: 0 });

function mergeProofs(proofs) {
  const valid = proofs.filter((item) => item?.status === 'resolved');
  const tenantIds = [...new Set(valid.map((item) => String(item.tenantId)))];
  const proof = proofs.flatMap((item) => item?.proof || []);
  if (tenantIds.length > 1) return { status: 'ambiguous', tenantId: null, proof, confidence: 0 };
  if (tenantIds.length === 1) return resolved(tenantIds[0], proof, valid.length > 1 ? 1 : valid[0].confidence);
  return unresolved(proof);
}

async function fromUser(userId, label = 'user') {
  if (!validId(userId)) return unresolved([`${label}:missing`]);
  const tenants = await resolveAvailableTenantsForUser(userId);
  if (tenants?.length === 1) return resolved(tenants[0]._id, [`${label}:${userId}→membership→${tenants[0]._id}`]);
  if (tenants?.length > 1) return { status: 'ambiguous', tenantId: null, proof: [`${label}:${userId}→${tenants.length}_tenants`], confidence: 0 };
  return unresolved([`${label}:${userId}→no_tenant`]);
}

// Accepte soit un ObjectId, soit un document déjà chargé exposant `owner`
// (même patron que `fromHotel` ci-dessous) — évite une re-requête Property
// redondante quand l'appelant a déjà le document en main (perf, §37 du
// sprint de certification), et permet aux appelants de fournir une
// projection minimale sans dépendre d'un `Property.findById` non mocké
// dans les tests unitaires qui contrôlent déjà l'accès par d'autres moyens.
async function fromProperty(propertyOrId, label = 'property') {
  // Un document déjà chargé (Mongoose ou objet simple portant plus que le
  // seul `_id`) est utilisé tel quel ; un ObjectId/chaîne brute déclenche la
  // requête. `mongoose.isValidObjectId` distingue correctement les deux cas
  // — une instance ObjectId passe le test, un document complet jamais.
  const property = propertyOrId && typeof propertyOrId === 'object' && !mongoose.isValidObjectId(propertyOrId)
    ? propertyOrId
    : validId(propertyOrId) && await Property.findById(validId(propertyOrId)).select('owner').lean();
  if (!property) return unresolved([`${label}:${rawId(propertyOrId)}→missing`]);
  return fromUser(property.owner, `${label}:${property._id || rawId(propertyOrId)}.owner`);
}

async function fromHotel(hotelOrId) {
  const hotel = hotelOrId && typeof hotelOrId === 'object' && hotelOrId.manager !== undefined
    ? hotelOrId
    : validId(hotelOrId) && await Hotel.findById(validId(hotelOrId)).select('tenant manager property createdBy').lean();
  if (!hotel) return unresolved([`hotel:${rawId(hotelOrId)}→missing`]);
  return mergeProofs(await Promise.all([
    hotel.tenant ? resolved(hotel.tenant, [`hotel:${hotel._id}.tenant`]) : unresolved(),
    fromUser(hotel.manager, `hotel:${hotel._id}.manager`),
    fromProperty(hotel.property, `hotel:${hotel._id}.property`),
    fromUser(hotel.createdBy, `hotel:${hotel._id}.createdBy`),
  ]));
}

async function fromAccommodation(accommodationId) {
  if (!validId(accommodationId)) return unresolved(['accommodation:missing']);
  const accommodation = await Accommodation.findById(validId(accommodationId)).select('tenant property hotel createdBy').lean();
  if (!accommodation) return unresolved([`accommodation:${accommodationId}→missing`]);
  return mergeProofs(await Promise.all([
    accommodation.tenant ? resolved(accommodation.tenant, [`accommodation:${accommodation._id}.tenant`]) : unresolved(),
    fromProperty(accommodation.property, `accommodation:${accommodation._id}.property`),
    accommodation.hotel ? fromHotel(accommodation.hotel) : unresolved(),
    fromUser(accommodation.createdBy, `accommodation:${accommodation._id}.createdBy`),
  ]));
}

async function fromContract(contractId) {
  if (!validId(contractId)) return unresolved(['contract:missing']);
  const contract = await Contrat.findById(validId(contractId)).select('bien').lean();
  return contract?.bien ? fromProperty(contract.bien, `contract:${contractId}.property`) : unresolved([`contract:${contractId}→no_property`]);
}

async function resolveResourceTenant({ resourceType, resource }) {
  if (!resource) return unresolved([`${resourceType}:missing`]);
  const direct = resource.tenant || resource.platformTenant
    ? resolved(resource.tenant || resource.platformTenant, [`${resourceType}.tenant`])
    : unresolved();
  if (resourceType === 'User') return fromUser(rawId(resource));
  if (resourceType === 'Property') return fromProperty(resource);
  if (resourceType === 'Hotel') return fromHotel(resource);
  if (resourceType === 'Accommodation') return fromAccommodation(rawId(resource));
  if (resourceType === 'HotelReservation') {
    const reservation = resource.hotel ? resource : validId(resource) && await HotelReservation.findById(validId(resource)).select('hotel').lean();
    return reservation?.hotel ? mergeProofs([direct, await fromHotel(reservation.hotel)]) : mergeProofs([direct, unresolved(['hotelReservation.hotel:missing'])]);
  }
  if (resourceType === 'AccommodationReservation') {
    const reservation = resource.accommodation ? resource : validId(resource) && await AccommodationReservation.findById(validId(resource)).select('accommodation owner createdBy').lean();
    if (!reservation) return unresolved(['accommodationReservation:missing']);
    return mergeProofs([direct, ...await Promise.all([
      fromAccommodation(reservation.accommodation),
      fromUser(reservation.owner, 'accommodationReservation.owner'),
      fromUser(reservation.createdBy, 'accommodationReservation.createdBy'),
    ])]);
  }
  if (resourceType === 'Room' || resourceType === 'HotelStaffAssignment') return fromHotel(resource.hotel);
  if (resourceType === 'RentalManagement') return mergeProofs(await Promise.all([
    fromProperty(resource.property, 'rentalManagement.property'),
    fromUser(resource.owner, 'rentalManagement.owner'),
    fromUser(resource.manager, 'rentalManagement.manager'),
  ]));
  if (resourceType === 'Contrat') return resource.bien ? fromProperty(resource.bien, 'contract.property') : fromContract(rawId(resource));
  if (resourceType === 'Paiement') return fromContract(resource.contrat);
  if (resourceType === 'Conversation') {
    const conversation = resource.participants ? resource : validId(resource) && await Conversation.findById(validId(resource)).select('tenant participants relatedProperty').lean();
    if (!conversation) return unresolved([`conversation:${rawId(resource)}→missing`]);
    const proofs = [conversation.tenant ? resolved(conversation.tenant, [`conversation:${conversation._id}.tenant`]) : unresolved(),
      ...await Promise.all((conversation.participants || []).map((userId) => fromUser(userId, `conversation:${conversation._id}.participant`)))];
    if (conversation.relatedProperty) proofs.push(await fromProperty(conversation.relatedProperty, `conversation:${conversation._id}.property`));
    return mergeProofs(proofs);
  }
  if (resourceType === 'Message') {
    if (resource.conversation) return mergeProofs([direct, await resolveResourceTenant({ resourceType: 'Conversation', resource: resource.conversation })]);
    return mergeProofs([direct, ...await Promise.all([fromUser(resource.sender, 'message.sender'), fromUser(resource.receiver, 'message.receiver')])]);
  }
  if (resourceType === 'Document') {
    const proofs = await Promise.all([
      fromUser(resource.createdBy, 'document.createdBy'), fromUser(resource.client, 'document.client'),
      fromProperty(resource.relatedProperty, 'document.relatedProperty'),
    ]);
    if (resource.entityType === 'Property') proofs.push(await fromProperty(resource.entityId, 'document.entity'));
    if (resource.entityType === 'Hotel') proofs.push(await fromHotel(resource.entityId));
    if (resource.entityType === 'Accommodation') proofs.push(await fromAccommodation(resource.entityId));
    if (resource.entityType === 'Contrat') proofs.push(await fromContract(resource.entityId));
    return mergeProofs([direct, ...proofs]);
  }
  if (['FinancialDocument', 'FinancialPayment', 'PaymentAllocation'].includes(resourceType)) {
    if (resource.establishmentType === 'Hotel') return mergeProofs([direct, await fromHotel(resource.establishmentId)]);
    if (resource.establishmentType === 'Accommodation') return mergeProofs([direct, await fromAccommodation(resource.establishmentId)]);
    if (resource.establishmentType === 'Property') return mergeProofs([direct, await fromProperty(resource.establishmentId, 'financial.property')]);
    return unresolved([`${resourceType}.establishment:unsupported`]);
  }
  return unresolved([`${resourceType}:unsupported`]);
}

async function assertResourceTenant({ resourceType, resource, tenantId }) {
  const attribution = await resolveResourceTenant({ resourceType, resource });
  if (attribution.status !== 'resolved' || String(attribution.tenantId) !== String(tenantId)) {
    const error = new Error('Ressource inaccessible dans ce contexte tenant.');
    error.statusCode = 404;
    error.code = attribution.status === 'ambiguous' ? 'TENANT_ATTRIBUTION_AMBIGUOUS' : 'TENANT_RESOURCE_NOT_FOUND';
    error.attribution = attribution;
    throw error;
  }
  return attribution;
}

// TENANT-CERT-2 (GL — Contrat/Paiement/RentalManagement) — variante pour les
// ressources qui peuvent légitimement n'avoir AUCUNE attribution tenant
// traçable (ex. un Contrat créé avec seulement `adresseBien` en texte libre,
// sans `bien` réellement lié à une Property — cas réel couvert par des
// suites GL-DEBT-1/GL-LIFE-1 antérieures à PlatformTenant). Dans ce cas
// précis, il n'existe AUCUNE frontière tenant à faire respecter (rien ne
// rattache la ressource à un tenant, donc aucune fuite possible) : l'accès
// reste autorisé, exactement comme avant l'introduction de PlatformTenant.
// Dès que la ressource EST attribuable (`resolved`), la frontière stricte
// s'applique normalement — jamais un accès élargi une fois l'attribution
// prouvée. `ambiguous` reste toujours refusé (fail-closed).
async function assertResourceTenantOrUnattributed({ resourceType, resource, tenantId }) {
  const attribution = await resolveResourceTenant({ resourceType, resource });
  if (attribution.status === 'unresolved') return attribution;
  if (attribution.status !== 'resolved' || String(attribution.tenantId) !== String(tenantId)) {
    const error = new Error('Ressource inaccessible dans ce contexte tenant.');
    error.statusCode = 404;
    error.code = attribution.status === 'ambiguous' ? 'TENANT_ATTRIBUTION_AMBIGUOUS' : 'TENANT_RESOURCE_NOT_FOUND';
    error.attribution = attribution;
    throw error;
  }
  return attribution;
}

module.exports = { resolveResourceTenant, assertResourceTenant, assertResourceTenantOrUnattributed, mergeProofs };
