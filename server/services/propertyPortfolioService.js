// PROPERTY-PORTFOLIO-1 — projection calculée des quatre sources métier.
// Aucun document n'est créé : les modules spécialisés restent propriétaires
// du cycle de vie, ce service ne fait que normaliser leur état éligible.
const Property = require('../models/Property');
const Accommodation = require('../models/Accommodation');
const { isPubliclyVisible } = require('./accommodationService');
const { listEligibleHotels } = require('./hotelService');
const { expandScopeWithUnaffiliatedUsersIfSoleTenant } = require('./unaffiliatedUserScopeService');

const PROPERTY_PUBLICATION_FILTER = Object.freeze({
  pole: 'Altimmo',
  status: { $in: ['vente', 'location'] },
  statusAdmin: 'Validée',
  isPublished: true,
  availability: 'Disponible',
});

const sourceRank = { vente: 0, location: 1, accommodation: 2, hotel: 3 };

const plainProperty = (property) => property?.toObject ? property.toObject() : property;

function projectProperty(property) {
  const raw = plainProperty(property);
  return {
    ...raw,
    entityType: 'property', entityId: String(raw._id), source: raw.status,
    category: raw.type, listingType: raw.status, publicationStatus: 'publie',
    dashboardClassification: {
      family: raw.status, propertyId: String(raw._id), accommodationId: null, hotelId: null,
      reason: 'PROPERTY_PUBLISHED',
    },
  };
}

function projectAccommodation(accommodation) {
  const property = plainProperty(accommodation.property);
  return {
    ...property,
    entityType: 'accommodation', entityId: String(accommodation._id), source: 'accommodation',
    category: accommodation.accommodationType, listingType: 'hebergement',
    publicationStatus: accommodation.publicationStatus,
    dashboardClassification: {
      family: 'accommodation', propertyId: String(property._id),
      accommodationId: String(accommodation._id), hotelId: null,
      reason: 'INDEPENDENT_ACCOMMODATION_PUBLISHED',
    },
  };
}

function projectHotel(hotel) {
  const property = plainProperty(hotel.property);
  return {
    ...property,
    title: hotel.name || property.title,
    entityType: 'hotel', entityId: String(hotel._id), source: 'hotel',
    category: hotel.hotelType || 'hotel', listingType: 'hebergement',
    publicationStatus: hotel.publicationStatus,
    dashboardClassification: {
      family: 'hotel', propertyId: String(property._id), accommodationId: null,
      hotelId: String(hotel._id), reason: 'HOTEL_PUBLISHED',
    },
  };
}

async function getPropertyPortfolio({ scopeUserIds } = {}) {
  const ownerScope = Array.isArray(scopeUserIds) ? { owner: { $in: scopeUserIds } } : {};
  const [properties, accommodations, hotels] = await Promise.all([
    Property.find({ ...PROPERTY_PUBLICATION_FILTER, ...ownerScope }).lean(),
    Accommodation.find({
      publicationStatus: 'publie', active: { $ne: false },
      $or: [{ hotel: null }, { hotel: { $exists: false } }],
    }).populate({ path: 'property', match: ownerScope }).lean(),
    listEligibleHotels({ propertyOwnerIds: Array.isArray(scopeUserIds) ? scopeUserIds : undefined }),
  ]);

  const projected = [
    ...properties.map(projectProperty),
    ...accommodations.filter((item) => item.property && isPubliclyVisible(item.property, item)).map(projectAccommodation),
    ...hotels.map(projectHotel),
  ];

  // Une même ancre physique ne doit produire qu'une carte. La source la plus
  // spécialisée gagne sur Property; l'ordre est stable et documenté.
  const byProperty = new Map();
  projected.sort((a, b) => sourceRank[a.source] - sourceRank[b.source]);
  projected.forEach((item) => byProperty.set(String(item._id), item));
  const items = [...byProperty.values()].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

  const stats = items.reduce((acc, item) => {
    acc.total += 1;
    acc.totalValue += Number(item.price) || 0;
    acc.bySource[item.source] = (acc.bySource[item.source] || 0) + 1;
    if (item.availability === 'Loué') acc.occupied += 1;
    return acc;
  }, { total: 0, totalValue: 0, occupied: 0, bySource: { vente: 0, location: 0, accommodation: 0, hotel: 0 } });

  return { items, stats };
}

async function getPropertyPortfolioForTenantScope({ scopeUserIds = [] } = {}) {
  const expandedScopeUserIds = await expandScopeWithUnaffiliatedUsersIfSoleTenant(scopeUserIds)
    .catch(() => scopeUserIds);
  return getPropertyPortfolio({ scopeUserIds: expandedScopeUserIds });
}

module.exports = { getPropertyPortfolio, getPropertyPortfolioForTenantScope, PROPERTY_PUBLICATION_FILTER };
