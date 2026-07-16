const finiteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const stringOrEmpty = (value) => typeof value === 'string' ? value.trim() : '';
const stringArray = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
  : [];

export function normalizePropertyDetail(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const address = input.address && typeof input.address === 'object' && !Array.isArray(input.address) ? input.address : {};
  const owner = input.owner && typeof input.owner === 'object' && !Array.isArray(input.owner)
    ? { _id: input.owner._id || input.owner.id || null, name: stringOrEmpty(input.owner.name), photo: stringOrEmpty(input.owner.photo) }
    : null;
  const latitude = finiteNumberOrNull(input.latitude);
  const longitude = finiteNumberOrNull(input.longitude);
  return {
    ...input,
    _id: input._id || input.id || null,
    title: stringOrEmpty(input.title) || 'Bien immobilier',
    description: stringOrEmpty(input.description),
    type: stringOrEmpty(input.type),
    status: stringOrEmpty(input.status).toLowerCase(),
    statusAdmin: stringOrEmpty(input.statusAdmin),
    availability: stringOrEmpty(input.availability),
    price: finiteNumberOrNull(input.price),
    honoraires: finiteNumberOrNull(input.honoraires),
    fraisVisite: finiteNumberOrNull(input.fraisVisite),
    surface: finiteNumberOrNull(input.surface),
    bedrooms: finiteNumberOrNull(input.bedrooms),
    bathrooms: finiteNumberOrNull(input.bathrooms),
    livingRooms: finiteNumberOrNull(input.livingRooms),
    kitchens: finiteNumberOrNull(input.kitchens),
    views: finiteNumberOrNull(input.views) || 0,
    shares: finiteNumberOrNull(input.shares) || 0,
    images: stringArray(input.images),
    amenities: stringArray(input.amenities),
    likes: Array.isArray(input.likes) ? input.likes : [],
    address: {
      street: stringOrEmpty(address.street),
      arrondissement: stringOrEmpty(address.arrondissement),
      city: stringOrEmpty(address.city),
      neighborhood: stringOrEmpty(address.neighborhood || address.quartier),
    },
    coordinates: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    owner,
    agent: input.agent && typeof input.agent === 'object' ? input.agent : null,
    createdAt: input.createdAt && !Number.isNaN(new Date(input.createdAt).getTime()) ? input.createdAt : null,
  };
}

export function formatCurrencyXAF(value, fallback = 'Prix sur demande') {
  const number = finiteNumberOrNull(value);
  if (number === null) return fallback;
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(number);
}

export function propertyDetailError(error) {
  const status = error?.response?.status || null;
  if (status === 404) return { kind: 'not_found', status, title: 'Bien introuvable', message: 'Ce bien n’existe plus ou n’est plus disponible.' };
  if (status === 401 || status === 403) return { kind: 'forbidden', status, title: 'Bien non accessible', message: 'Ce bien n’est pas accessible avec votre compte.' };
  if (status >= 500) return { kind: 'server', status, title: 'Service indisponible', message: 'Le service est temporairement indisponible.' };
  return { kind: 'network', status, title: 'Connexion impossible', message: 'Impossible de charger le bien. Vérifiez votre connexion puis réessayez.' };
}
