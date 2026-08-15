const LABELS = Object.freeze({
  draft: 'Brouillon', pending: 'En validation', validated: 'Validé', published: 'Publié',
  managed: 'En gestion', occupied: 'Occupé', sold: 'Vendu', archived: 'Archivé',
});

export function projectOwnerPropertyStatus(property = {}, rental = null) {
  if (property.assetCycle === 'archive' || property.availability === 'Retiré') return { code: 'archived', label: LABELS.archived };
  if (property.assetCycle === 'vendu' || property.availability === 'Vendu' || rental?.availabilityStatus === 'vendu') return { code: 'sold', label: LABELS.sold };
  if (rental?.occupancyStatus === 'occupe' || property.assetCycle === 'en_location' || property.availability === 'Loué') return { code: 'occupied', label: LABELS.occupied };
  if (rental?.managementActivated) return { code: 'managed', label: LABELS.managed };
  if (property.isPublished) return { code: 'published', label: LABELS.published };
  if (['Validée', 'Validé'].includes(property.statusAdmin)) return { code: 'validated', label: LABELS.validated };
  if (property.statusAdmin === 'En attente') return { code: 'pending', label: LABELS.pending };
  return { code: 'draft', label: LABELS.draft };
}

export function summarizeOwnerProperties(properties = [], rentals = []) {
  const rentalByProperty = new Map(rentals.map(rental => [String(rental.property?._id || rental.property), rental]));
  return properties.reduce((summary, property) => {
    const status = projectOwnerPropertyStatus(property, rentalByProperty.get(String(property._id)));
    summary.total += 1;
    summary[status.code] = (summary[status.code] || 0) + 1;
    return summary;
  }, { total: 0, draft: 0, pending: 0, validated: 0, published: 0, managed: 0, occupied: 0, sold: 0, archived: 0 });
}
