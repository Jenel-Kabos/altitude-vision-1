import { accommodationSaveMessage } from '../components/dashboard/AccommodationPropertyForm';

describe('AccommodationPropertyForm — sémantique lifecycle', () => {
  test('distingue soumission en modération, brouillon et édition', () => {
    expect(accommodationSaveMessage({ isEditing: false, publicationStatus: 'soumis' }))
      .toBe('Hébergement créé et envoyé en modération.');
    expect(accommodationSaveMessage({ isEditing: false, publicationStatus: 'brouillon' }))
      .toContain('Brouillon');
    expect(accommodationSaveMessage({ isEditing: true, publicationStatus: 'publie' }))
      .toBe('Hébergement modifié.');
  });
});
