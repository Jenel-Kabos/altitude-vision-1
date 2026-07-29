import { mapPropertyToFormValues } from '../utils/propertyFormValues';

describe('mapPropertyToFormValues', () => {
  it('préserve les zéros, tableaux, adresse et coordonnées existants', () => {
    expect(mapPropertyToFormValues({
      price: 0, bedrooms: 0, bathrooms: 0, amenities: ['Parking', 'Wifi'],
      address: { city: 'Pointe-Noire', neighborhood: 'Centre-ville' },
      location: { coordinates: [11.85, -4.78] },
    })).toMatchObject({
      price: 0, bedrooms: 0, bathrooms: 0, amenities: 'Parking, Wifi',
      address: { city: 'Pointe-Noire', neighborhood: 'Centre-ville' },
      latitude: -4.78, longitude: 11.85,
    });
  });

  it('ne partage pas les objets imbriqués entre deux formulaires', () => {
    const first = mapPropertyToFormValues();
    const second = mapPropertyToFormValues();
    first.address.city = 'Dolisie';
    expect(second.address.city).toBe('Brazzaville');
  });
});
