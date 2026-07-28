export function getPublicationErrorMessage(error, entityLabel) {
  const response = error?.response;
  const data = response?.data || {};
  const incomplete = response?.status === 422
    && (Array.isArray(data.missingFields) || ['ACCOMMODATION_INCOMPLETE', 'HOTEL_INCOMPLETE'].includes(data.code));

  if (!incomplete) return null;

  const labels = (data.missingFields || [])
    .map((item) => typeof item === 'string' ? item : item?.label)
    .filter(Boolean);

  if (!labels.length) {
    return `Impossible de publier ${entityLabel}. Ouvrez la fiche et complétez les informations obligatoires.`;
  }

  return `Impossible de publier ${entityLabel}.\nVeuillez compléter les champs suivants :\n${labels.map((label) => `– ${label}`).join('\n')}`;
}
