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

module.exports = {
  CLASSIC_PROPERTY_STATUSES,
  classicPropertyModerationFilter,
  accommodationModerationFilter,
  getModerationCategory,
};
