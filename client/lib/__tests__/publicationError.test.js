import { getPublicationErrorMessage } from '../utils/publicationError';

describe('getPublicationErrorMessage', () => {
  it('affiche la liste des champs manquants renvoyée par le backend', () => {
    const error = { response: { status: 422, data: {
      code: 'ACCOMMODATION_INCOMPLETE',
      missingFields: [{ field: 'description', label: 'Description' }, { field: 'images', label: 'Photos' }],
    } } };

    expect(getPublicationErrorMessage(error, 'cet hébergement')).toBe(
      'Impossible de publier cet hébergement.\nVeuillez compléter les champs suivants :\n– Description\n– Photos',
    );
  });

  it('fournit un guidage si le code existe mais pas la liste', () => {
    const error = { response: { status: 422, data: { code: 'HOTEL_INCOMPLETE' } } };
    expect(getPublicationErrorMessage(error, 'cet hôtel')).toContain('Ouvrez la fiche');
  });

  it('laisse les autres erreurs au comportement générique existant', () => {
    expect(getPublicationErrorMessage({ response: { status: 500, data: {} } }, 'cet hôtel')).toBeNull();
  });
});
