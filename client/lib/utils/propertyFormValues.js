export const createEmptyPropertyForm = () => ({
  title: '', description: '', price: '', honoraires: '', fraisVisite: 0,
  pole: 'Altimmo', status: 'vente', type: 'Appartement', availability: 'Disponible',
  address: { street: '', neighborhood: '', arrondissement: '', city: 'Brazzaville' },
  surface: '', bedrooms: '', bathrooms: '', livingRooms: '', kitchens: '',
  constructionType: 'Non spécifié', amenities: '', latitude: -4.266, longitude: 15.283,
  images: [],
});

export const mapPropertyToFormValues = (property = {}) => ({
  ...createEmptyPropertyForm(),
  title: property.title || '', description: property.description || '',
  price: property.price ?? '', honoraires: property.honoraires ?? '', fraisVisite: property.fraisVisite ?? 0,
  pole: property.pole || 'Altimmo', status: property.status || 'vente', type: property.type || 'Appartement',
  availability: property.availability || 'Disponible',
  address: {
    street: property.address?.street || '', neighborhood: property.address?.neighborhood || '',
    arrondissement: property.address?.arrondissement || '', city: property.address?.city || 'Brazzaville',
  },
  surface: property.surface ?? '', bedrooms: property.bedrooms ?? '', bathrooms: property.bathrooms ?? '',
  livingRooms: property.livingRooms ?? '', kitchens: property.kitchens ?? '',
  constructionType: property.constructionType || 'Non spécifié',
  amenities: Array.isArray(property.amenities) ? property.amenities.join(', ') : (property.amenities || ''),
  latitude: property.latitude ?? property.location?.coordinates?.[1] ?? -4.266,
  longitude: property.longitude ?? property.location?.coordinates?.[0] ?? 15.283,
});
