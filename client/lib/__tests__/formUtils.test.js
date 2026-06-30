import { buildPropertyFormData } from '../utils/formUtils';

describe('buildPropertyFormData', () => {
  const baseForm = {
    title: 'Appartement T3',
    description: 'Bel appartement lumineux',
    price: 150000,
    pole: 'Altimmo',
    status: 'À vendre',
    availability: 'Disponible',
    type: 'Appartement',
    address_arrondissement: '1er',
    address_street: '12 rue de la Paix',
    address_city: 'Brazzaville',
    surface: 75,
    bedrooms: 3,
    bathrooms: 1,
  };

  it('inclut tous les champs simples', () => {
    const fd = buildPropertyFormData(baseForm);
    expect(fd.get('title')).toBe('Appartement T3');
    expect(fd.get('price')).toBe('150000');
    expect(fd.get('bedrooms')).toBe('3');
    expect(fd.get('surface')).toBe('75');
  });

  it('n\'inclut pas les champs undefined ou null', () => {
    const fd = buildPropertyFormData({ title: 'Test', price: undefined });
    expect(fd.get('title')).toBe('Test');
    expect(fd.get('price')).toBeNull();
  });

  it('sérialise amenities sous forme de JSON quand c\'est un tableau', () => {
    const fd = buildPropertyFormData({ ...baseForm, amenities: ['Parking', 'Piscine'] });
    expect(fd.get('amenities')).toBe('["Parking","Piscine"]');
  });

  it('parse et sérialise amenities depuis une chaîne CSV', () => {
    const fd = buildPropertyFormData({ ...baseForm, amenities: 'Parking, Piscine, Jardin' });
    const parsed = JSON.parse(fd.get('amenities'));
    expect(parsed).toEqual(['Parking', 'Piscine', 'Jardin']);
  });

  it('n\'ajoute pas amenities si absent du formData', () => {
    const fd = buildPropertyFormData({ title: 'Test' });
    expect(fd.get('amenities')).toBeNull();
  });

  it('sérialise existingImages en JSON', () => {
    const imgs = ['https://cdn.com/a.jpg', 'https://cdn.com/b.jpg'];
    const fd = buildPropertyFormData(baseForm, imgs);
    expect(fd.get('existingImages')).toBe(JSON.stringify(imgs));
  });

  it('n\'ajoute pas existingImages si tableau vide', () => {
    const fd = buildPropertyFormData(baseForm, []);
    expect(fd.get('existingImages')).toBeNull();
  });

  it('ajoute les fichiers dans le champ images', () => {
    const file1 = new File(['data'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['data'], 'photo2.jpg', { type: 'image/jpeg' });
    const fd = buildPropertyFormData(baseForm, [], [file1, file2]);
    const all = fd.getAll('images');
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('photo1.jpg');
  });

  it('ajoute location + latitude + longitude quand les coordonnées sont présentes', () => {
    const fd = buildPropertyFormData({ ...baseForm, latitude: 4.2672, longitude: 15.2835 });
    const location = JSON.parse(fd.get('location'));
    expect(location.type).toBe('Point');
    expect(location.coordinates).toEqual([15.2835, 4.2672]);
    expect(fd.get('latitude')).toBe('4.2672');
    expect(fd.get('longitude')).toBe('15.2835');
  });

  it('n\'ajoute pas location si latitude ou longitude est null', () => {
    const fd = buildPropertyFormData({ ...baseForm, latitude: null, longitude: null });
    expect(fd.get('location')).toBeNull();
  });
});
