// UX-ACCOMMODATION-SEARCH-BAR-1 — fixtures pour la validation visuelle réelle.
export const FIXTURE_ACCOMMODATIONS = [
  {
    _id: 'ACC-1', accommodationType: 'villa_meublee', publicationStatus: 'publie',
    capacity: { maxAdults: 4, maxChildren: 2 },
    property: { _id: 'PROPERTY-1', title: 'Villa Bacongo', price: 45000, statusAdmin: 'Validée', availability: 'Disponible', address: { city: 'Brazzaville' }, images: [] },
  },
  {
    _id: 'ACC-2', accommodationType: 'appartement_meuble', publicationStatus: 'publie',
    capacity: { maxAdults: 2, maxChildren: 0 },
    property: { _id: 'PROPERTY-2', title: 'Appartement Centre-Ville', price: 28000, statusAdmin: 'Validée', availability: 'Disponible', address: { city: 'Pointe-Noire' }, images: [] },
  },
  {
    _id: 'ACC-3', accommodationType: 'studio_meuble', publicationStatus: 'publie',
    capacity: { maxAdults: 1, maxChildren: 0 },
    property: { _id: 'PROPERTY-3', title: 'Studio Poto-Poto', price: 15000, statusAdmin: 'Validée', availability: 'Maintenance', address: { city: 'Brazzaville' }, images: [] },
  },
];
