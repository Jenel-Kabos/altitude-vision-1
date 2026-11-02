'use strict';
const fact = (value) => (value === undefined ? null : value);

function publicFacts(record = {}) {
  const address = record.address || {};
  const projected = {
    id: String(record.id || record._id || ''), title: String(record.title || 'Annonce Altimmo').slice(0, 160),
    type: fact(record.type), status: fact(record.status), price: Number.isFinite(record.price) ? record.price : null,
    pricePeriod: ['night', 'month', 'sale', 'week', 'year'].includes(record.pricePeriod) ? record.pricePeriod : null,
    bedrooms: Number.isFinite(record.bedrooms) ? record.bedrooms : null,
    bathrooms: Number.isFinite(record.bathrooms) ? record.bathrooms : null,
    surface: Number.isFinite(record.surface) ? record.surface : null,
    amenities: Array.isArray(record.amenities) ? record.amenities.filter((v) => typeof v === 'string').slice(0, 20) : [],
    address: { city: fact(address.city), arrondissement: fact(address.arrondissement), neighborhood: fact(address.neighborhood) },
    accommodationType: fact(record.accommodationType),
  };
  projected.unknown = ['price', 'bedrooms', 'bathrooms', 'surface'].filter((key) => projected[key] === null);
  return projected;
}

module.exports = { publicFacts };
