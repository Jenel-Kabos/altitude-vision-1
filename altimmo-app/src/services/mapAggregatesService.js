// altimmo-app/src/services/mapAggregatesService.js
// Client de l'endpoint public GET /api/altimmo/map-aggregates. Ne dépend
// jamais des coordonnées exactes des propriétés.

import api from './api';

export async function fetchMapAggregates(queryString = '') {
  const path = queryString ? `/altimmo/map-aggregates?${queryString}` : '/altimmo/map-aggregates';
  const res = await api.get(path);
  const data = res?.data?.data || {};
  return {
    total: data.total || 0,
    mappedTotal: data.mappedTotal || 0,
    unmappedTotal: data.unmappedTotal || 0,
    areas: Array.isArray(data.areas) ? data.areas : [],
  };
}
