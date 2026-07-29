const CLASSIC_PROPERTY_STATUSES = Object.freeze(['vente', 'location']);

const classicPropertyModerationFilter = (extra = {}) => ({
  ...extra,
  status: { $in: CLASSIC_PROPERTY_STATUSES },
});

const accommodationModerationFilter = (extra = {}) => ({
  ...extra,
  $and: [
    ...(Array.isArray(extra.$and) ? extra.$and : []),
    { $or: [{ hotel: null }, { hotel: { $exists: false } }] },
  ],
});

const getModerationCategory = (entity) => {
  if (entity?.publicationKind === 'hotel_establishment' || entity?.hotel) return 'hotel';
  if (entity?.accommodationType || entity?.publicationKind === 'furnished_accommodation') return 'accommodation';
  if (CLASSIC_PROPERTY_STATUSES.includes(entity?.status)) return entity.status;
  return 'ambiguous';
};

const classifyDashboardListing = ({ property, accommodation = null, hotel = null }) => {
  const propertyId = property?._id ? String(property._id) : null;
  const accommodationId = accommodation?._id ? String(accommodation._id) : null;
  const hotelId = hotel?._id ? String(hotel._id) : null;
  const result = (family, reason) => ({ family, propertyId, accommodationId, hotelId, reason });

  if (!property) return result('ambiguous', 'PROPERTY_MISSING');
  if (hotel) return result('hotel', 'HOTEL_RELATION');
  if (accommodation?.hotel) return result('ambiguous', 'HOTEL_RELATION_ORPHANED');
  if (accommodation) {
    if (!accommodation.accommodationType) return result('ambiguous', 'ACCOMMODATION_TYPE_MISSING');
    return result('accommodation', 'INDEPENDENT_ACCOMMODATION');
  }
  if (CLASSIC_PROPERTY_STATUSES.includes(property.status)) return result(property.status, 'PROPERTY_STATUS');
  return result('ambiguous', property.status === 'hebergement' ? 'ACCOMMODATION_MISSING' : 'UNCLASSIFIED');
};

module.exports = {
  CLASSIC_PROPERTY_STATUSES,
  classicPropertyModerationFilter,
  accommodationModerationFilter,
  getModerationCategory,
  classifyDashboardListing,
};
