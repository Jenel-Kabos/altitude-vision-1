jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import api from '../api';
import { getCheckoutFinancialReadiness, getHotelCockpitAnalytics } from '../hotelReservationService';

describe('getCheckoutFinancialReadiness — même endpoint certifié E2E-1, aucun calcul mobile', () => {
  test('appelle GET /hotel-reservations/:id/checkout-financial-readiness et retourne financialReadiness', async () => {
    const financialReadiness = { status: 'blocked', blockers: [{ code: 'FINANCIAL_BALANCE_REMAINING' }] };
    api.get.mockResolvedValue({ data: { data: { financialReadiness } } });
    const result = await getCheckoutFinancialReadiness('res-1');
    expect(api.get).toHaveBeenCalledWith('/hotel-reservations/res-1/checkout-financial-readiness');
    expect(result).toEqual(financialReadiness);
  });
});

describe('getHotelCockpitAnalytics — mêmes champs kpis que le Web, aucun KPI inventé', () => {
  test('appelle GET /dashboard-analytics/hotels avec hotelId et retourne kpis tel quel', async () => {
    const kpis = { occupiedRooms: 3, totalRooms: 8, checkInsToday: 1 };
    api.get.mockResolvedValue({ data: { data: { kpis } } });
    const result = await getHotelCockpitAnalytics('hotel-1');
    expect(api.get).toHaveBeenCalledWith('/dashboard-analytics/hotels', { params: { hotelId: 'hotel-1' } });
    expect(result).toEqual({ kpis });
  });
});
