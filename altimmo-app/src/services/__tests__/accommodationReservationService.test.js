jest.mock('expo-file-system', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, getToken: jest.fn() }));
jest.mock('../cacheService', () => ({ cache: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() } }));
jest.mock('../../config/environment', () => ({ environment: { apiUrl: 'https://api.test/api' } }));

import api from '../api';
import { cache } from '../cacheService';
import {
  cancelAccommodationReservation, createAccommodationReservation, getAccommodationAvailability,
  listAccommodationReservations, requestAccommodationRefund,
} from '../accommodationReservationService';

describe('service réservations Accommodation Mobile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('liste les séjours avec les mêmes filtres et pagination que le Web', async () => {
    api.get.mockResolvedValue({ data: { data: { reservations: [{ _id: 'r1' }], page: 2, totalPages: 3 } } });
    await expect(listAccommodationReservations({ status: 'confirmed', page: 2, limit: 10 })).resolves.toMatchObject({ data: { page: 2 }, offline: false });
    expect(api.get).toHaveBeenCalledWith('/accommodation-reservations', { params: { status: 'confirmed', page: 2, limit: 10 } });
    expect(cache.set).toHaveBeenCalled();
  });

  test('utilise le cache uniquement pour une lecture en erreur réseau', async () => {
    api.get.mockRejectedValue({ normalized: { isNetworkError: true } }); cache.get.mockReturnValue({ available: true, pricing: { total: 50000 } });
    await expect(getAccommodationAvailability('a1', { from: '2026-09-01', to: '2026-09-03' }, { refresh: true })).resolves.toMatchObject({ offline: true, data: { available: true } });
  });

  test('la création transmet source mobile sans calculer le prix', async () => {
    api.post.mockResolvedValue({ data: { data: { reservation: { _id: 'r1', total: 50000 } } } });
    const payload = { accommodation: 'a1', checkInDate: '2026-09-01', checkOutDate: '2026-09-03', adults: 2, children: 0 };
    await createAccommodationReservation(payload);
    expect(api.post).toHaveBeenCalledWith('/accommodation-reservations', { ...payload, source: 'mobile' });
    expect(cache.invalidate).toHaveBeenCalledWith('accommodation-reservations:');
  });

  test('les écritures annulation et remboursement ne sont jamais mises en file hors ligne', async () => {
    api.post.mockRejectedValue({ normalized: { isNetworkError: true } });
    await expect(cancelAccommodationReservation('r1', 'motif')).rejects.toBeTruthy();
    await expect(requestAccommodationRefund('r1', { amountMinor: 1000 }, 'key-1')).rejects.toBeTruthy();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });
});
