const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');

const PROPERTY_PUBLIC_STATE = Object.freeze({
  status: 'hebergement',
  pole: 'Altimmo',
  statusAdmin: 'Validée',
  availability: 'Disponible',
  internalManagedOnly: { $ne: true },
});

const safe = ({ result, hotelId, propertyId = null, hotelPublicationState = null, currentIsPublished = null, wouldUpdate = false, writes = 0, reason = null }) => ({
  result,
  hotelId: String(hotelId),
  propertyId: propertyId ? String(propertyId) : null,
  hotelPublicationState,
  currentIsPublished,
  expectedIsPublished: true,
  eligible: ['ELIGIBLE', 'UPDATED', 'ALREADY_SYNCED'].includes(result),
  wouldUpdate,
  writes,
  ...(reason ? { reason } : {}),
});

function sameId(left, right) {
  return left && right && String(left) === String(right);
}

async function qualifyValidatedHotelPublication({ hotelId }) {
  if (!mongoose.isValidObjectId(hotelId)) {
    return safe({ result: 'NOT_FOUND', hotelId, reason: 'INVALID_HOTEL_ID' });
  }

  const hotel = await Hotel.findById(hotelId)
    .select('_id tenant property publicationStatus status active')
    .lean();
  if (!hotel) return safe({ result: 'NOT_FOUND', hotelId, reason: 'HOTEL_NOT_FOUND' });
  const hotelResult = (values) => safe({ hotelPublicationState: hotel.publicationStatus, ...values });
  if (hotel.publicationStatus !== 'publie' || hotel.status !== 'actif' || hotel.active === false) {
    return hotelResult({ result: 'NOT_ELIGIBLE', hotelId, propertyId: hotel.property, reason: 'HOTEL_NOT_PUBLISHED_AND_ACTIVE' });
  }
  if (!hotel.property) return hotelResult({ result: 'NOT_FOUND', hotelId, reason: 'PROPERTY_LINK_MISSING' });

  const property = await Property.findById(hotel.property)
    .select('_id tenant status pole statusAdmin availability internalManagedOnly isPublished updatedAt')
    .lean();
  if (!property) return hotelResult({ result: 'NOT_FOUND', hotelId, propertyId: hotel.property, reason: 'PROPERTY_NOT_FOUND' });
  if (!hotel.tenant || !property.tenant || !sameId(hotel.tenant, property.tenant)) {
    return hotelResult({ result: 'TENANT_MISMATCH', hotelId, propertyId: property._id, currentIsPublished: property.isPublished === true, reason: 'HOTEL_PROPERTY_TENANT_MISMATCH' });
  }
  if (property.status !== 'hebergement'
    || property.pole !== 'Altimmo'
    || property.statusAdmin !== 'Validée'
    || property.availability !== 'Disponible'
    || property.internalManagedOnly === true) {
    return hotelResult({ result: 'NOT_ELIGIBLE', hotelId, propertyId: property._id, currentIsPublished: property.isPublished === true, reason: 'PROPERTY_NOT_PUBLICABLE' });
  }

  const accommodations = await Accommodation.find({ hotel: hotel._id })
    .select('_id tenant property hotel accommodationType publicationStatus active')
    .limit(2)
    .lean();
  if (accommodations.length !== 1) {
    return hotelResult({ result: 'AMBIGUOUS_LINK', hotelId, propertyId: property._id, currentIsPublished: property.isPublished === true, reason: accommodations.length ? 'MULTIPLE_ACCOMMODATIONS' : 'ACCOMMODATION_NOT_FOUND' });
  }
  const accommodation = accommodations[0];
  if (!sameId(accommodation.hotel, hotel._id)
    || !sameId(accommodation.property, property._id)
    || accommodation.accommodationType !== 'hotel') {
    return hotelResult({ result: 'AMBIGUOUS_LINK', hotelId, propertyId: property._id, currentIsPublished: property.isPublished === true, reason: 'ACCOMMODATION_LINK_MISMATCH' });
  }
  if (!accommodation.tenant || !sameId(accommodation.tenant, hotel.tenant)) {
    return hotelResult({ result: 'TENANT_MISMATCH', hotelId, propertyId: property._id, currentIsPublished: property.isPublished === true, reason: 'ACCOMMODATION_TENANT_MISMATCH' });
  }
  if (accommodation.publicationStatus !== 'publie' || accommodation.active === false) {
    return hotelResult({ result: 'NOT_ELIGIBLE', hotelId, propertyId: property._id, currentIsPublished: property.isPublished === true, reason: 'ACCOMMODATION_NOT_PUBLISHED_AND_ACTIVE' });
  }
  if (property.isPublished === true) {
    return hotelResult({ result: 'ALREADY_SYNCED', hotelId, propertyId: property._id, currentIsPublished: true });
  }

  return {
    ...hotelResult({ result: 'ELIGIBLE', hotelId, propertyId: property._id, currentIsPublished: false, wouldUpdate: true }),
    qualification: { propertyUpdatedAt: property.updatedAt, propertyTenant: property.tenant },
  };
}

async function resyncValidatedHotelPublication({ hotelId, apply = false, beforeWrite } = {}) {
  const qualification = await qualifyValidatedHotelPublication({ hotelId });
  if (!apply || qualification.result !== 'ELIGIBLE') {
    const { qualification: _private, ...output } = qualification;
    return output;
  }

  if (beforeWrite) await beforeWrite(qualification);
  const requalified = await qualifyValidatedHotelPublication({ hotelId });
  if (requalified.result !== 'ELIGIBLE') {
    return safe({
      result: 'STATE_CHANGED', hotelId, propertyId: qualification.propertyId,
      hotelPublicationState: requalified.hotelPublicationState,
      currentIsPublished: requalified.currentIsPublished, reason: requalified.reason || requalified.result,
    });
  }
  const update = await Property.updateOne(
    {
      _id: qualification.propertyId,
      isPublished: { $ne: true },
      tenant: qualification.qualification.propertyTenant,
      updatedAt: qualification.qualification.propertyUpdatedAt,
      ...PROPERTY_PUBLIC_STATE,
    },
    { $set: { isPublished: true } },
    { timestamps: false },
  );
  if ((update.modifiedCount ?? update.nModified ?? 0) === 1) {
    return safe({ result: 'UPDATED', hotelId, propertyId: qualification.propertyId, hotelPublicationState: 'publie', currentIsPublished: true, writes: 1 });
  }

  const current = await qualifyValidatedHotelPublication({ hotelId });
  if (current.result === 'ALREADY_SYNCED') return current;
  return safe({
    result: 'STATE_CHANGED', hotelId, propertyId: qualification.propertyId,
    hotelPublicationState: current.hotelPublicationState,
    currentIsPublished: current.currentIsPublished, reason: current.reason || current.result,
  });
}

module.exports = { PROPERTY_PUBLIC_STATE, qualifyValidatedHotelPublication, resyncValidatedHotelPublication };
