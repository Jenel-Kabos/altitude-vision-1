jest.mock('../api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import api from '../api';
import { createFullAccommodationMobile } from '../annonceService';

describe('createFullAccommodationMobile — appel unique atomique (correctif robustesse)', () => {
  afterEach(() => jest.clearAllMocks());

  const args = {
    publicationRequestId: 'req-123',
    property: { titre: 'Villa', categorie: 'hebergement' },
    accommodation: { accommodationType: 'villa_meublee' },
    ratePlan: { mode: 'nightly', amount: 35000, currency: 'XAF' },
  };

  test('un seul appel HTTP vers POST /accommodations/mobile/full avec le payload structuré', async () => {
    api.post.mockResolvedValueOnce({
      data: { data: { property: { _id: 'p1' }, accommodation: { _id: 'a1', publicationStatus: 'soumis' }, rate: { _id: 'r1' } } },
    });

    const result = await createFullAccommodationMobile(args);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/accommodations/mobile/full', {
      publicationRequestId: 'req-123',
      property: args.property,
      accommodation: args.accommodation,
      ratePlan: args.ratePlan,
    });
    expect(result.property._id).toBe('p1');
    expect(result.accommodation.publicationStatus).toBe('soumis');
  });

  test('propage le message et le code stable renvoyés par le backend en cas d\'échec', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { message: 'Informations incomplètes pour soumettre cet hébergement à validation.', code: 'MOBILE_ACCOMMODATION_NOT_READY' } },
    });

    await expect(createFullAccommodationMobile(args)).rejects.toMatchObject({
      message: 'Informations incomplètes pour soumettre cet hébergement à validation.',
      code: 'MOBILE_ACCOMMODATION_NOT_READY',
    });
  });

  test('erreur réseau (pas de réponse serveur) : message générique, isNetworkError=true, jamais de crash', async () => {
    api.post.mockRejectedValueOnce({ request: {} });

    const err = await createFullAccommodationMobile(args).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.isNetworkError).toBe(true);
    expect(err.message).toBe("Erreur lors de la publication de l'hébergement");
  });

  test('retry avec le même publicationRequestId : payload identique renvoyé au backend', async () => {
    api.post.mockResolvedValue({ data: { data: { property: { _id: 'p1' }, accommodation: { _id: 'a1' } } } });

    await createFullAccommodationMobile(args);
    await createFullAccommodationMobile(args);

    expect(api.post).toHaveBeenNthCalledWith(1, '/accommodations/mobile/full', expect.objectContaining({ publicationRequestId: 'req-123' }));
    expect(api.post).toHaveBeenNthCalledWith(2, '/accommodations/mobile/full', expect.objectContaining({ publicationRequestId: 'req-123' }));
  });
});
