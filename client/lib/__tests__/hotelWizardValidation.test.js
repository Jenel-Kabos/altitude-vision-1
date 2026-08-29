import { firstHotelWizardError, validateHotelWizard } from '../utils/hotelWizardValidation';

const complete = () => ({
  name: 'Altitude Hôtel', description: 'Un hôtel confortable', phone: '+242060000000',
  address: { city: 'Brazzaville', arrondissement: 'Poto-Poto' },
  checkInTime: '14:00', checkOutTime: '11:00', hotelServices: { wifi: true }, images: [{}],
  roomCategories: [{ name: 'Standard', code: 'STD', categoryType: 'standard', quantity: 13, adultCapacity: 2, childCapacity: 1, beds: 1, ratePlans: [{ rateType: 'public', amount: 35000 }] }],
});

describe('hotelWizardValidation', () => {
  test('une étape invalide expose ses champs sans modifier les valeurs', () => {
    const form = { ...complete(), name: '', description: '' };
    expect(validateHotelWizard(form, 0)).toMatchObject({ name: expect.any(String), description: expect.any(String) });
    expect(form.phone).toBe('+242060000000');
  });

  test('la validation finale ouvre la première étape invalide', () => {
    const errors = validateHotelWizard({ ...complete(), name: '', images: [] });
    expect(firstHotelWizardError(errors)).toMatchObject({ field: 'name', step: 0 });
    expect(errors.images).toBeTruthy();
  });

  test('services, photos, catégories et tarifs sont obligatoires', () => {
    const errors = validateHotelWizard({ ...complete(), hotelServices: {}, images: [], roomCategories: [] });
    expect(errors).toMatchObject({ hotelServices: expect.any(String), images: expect.any(String), roomCategories: expect.any(String) });
  });

  test('un hôtel complet ne produit aucune erreur', () => {
    expect(validateHotelWizard(complete())).toEqual({});
  });

  test('les validations suivent le parcours de création en 8 étapes sans étape de capacité isolée', () => {
    const categoryErrors = validateHotelWizard({ ...complete(), roomCategories: [] });
    expect(firstHotelWizardError(categoryErrors)).toMatchObject({ field: 'roomCategories', step: 2 });

    const serviceErrors = validateHotelWizard({ ...complete(), hotelServices: {} });
    expect(firstHotelWizardError(serviceErrors)).toMatchObject({ field: 'hotelServices', step: 4 });

    const photoErrors = validateHotelWizard({ ...complete(), images: [] });
    expect(firstHotelWizardError(photoErrors)).toMatchObject({ field: 'images', step: 6 });
  });
});
