import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import HotelInventoryCalendarPage from '../pages/dashboard/HotelInventoryCalendarPage';
import { getHotelInventoryCalendar, rebuildHotelInventory, updateHotelInventoryRange } from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }) }));
vi.mock('../services/hotelService', () => ({ getHotelInventoryCalendar: vi.fn(), rebuildHotelInventory: vi.fn(), updateHotelInventoryRange: vi.fn() }));
vi.mock('../components/RoomAssignmentPanel', () => ({ default: ({ reservation }) => <button>Affecter {reservation.reference}</button> }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const payload = {
  days: [{ id: 'day-1', date: '2026-10-10T00:00:00Z', roomCategory: 'category-1', categoryName: 'Standard', totalUnits: 3, availableUnits: 1, reservedUnits: 1, blockedUnits: 1, physicalOutOfService: 0, stopSell: false, isClosed: false }],
  rooms: [{ _id: 'room-1', roomNumber: '101', floor: 1, status: 'reserved' }, { _id: 'room-2', roomNumber: '102', floor: 2, status: 'out_of_service' }],
  housekeepingTasks: [], maintenanceTickets: [],
  reservations: [{ _id: 'reservation-1', reference: 'RES-ADA', status: 'confirmed', roomCategory: 'category-1', roomsCount: 2, assignmentState: 'partially_assigned', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' }, checkInDate: new Date().toISOString(), checkOutDate: '2026-10-12T00:00:00Z', assignedRooms: [{ _id: 'room-1', roomNumber: '101', floor: 1 }] }],
};

describe('HotelInventoryCalendarPage C/D.1.1', () => {
  beforeEach(() => { vi.clearAllMocks(); getHotelInventoryCalendar.mockResolvedValue(payload); updateHotelInventoryRange.mockResolvedValue({}); rebuildHotelInventory.mockResolvedValue({ nights: 7 }); });

  test('charge uniquement la plage visible et bascule semaine/mois', async () => {
    render(<HotelInventoryCalendarPage />); await screen.findByRole('heading', { name: 'Standard' });
    expect(getHotelInventoryCalendar).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ from: expect.any(String), to: expect.any(String) }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('button', { name: 'Mois' })); await waitFor(() => expect(getHotelInventoryCalendar).toHaveBeenCalledTimes(2));
  });

  test('combine recherche, étage et état d’affectation puis ouvre les actions', async () => {
    render(<HotelInventoryCalendarPage />); await screen.findByText('RES-ADA');
    fireEvent.change(screen.getByLabelText('Rechercher une réservation'), { target: { value: 'Ada' } }); fireEvent.change(screen.getByLabelText('Filtrer par étage'), { target: { value: '1' } }); fireEvent.change(screen.getByLabelText('Filtrer par affectation'), { target: { value: 'partially_assigned' } });
    fireEvent.click(screen.getByText(/RES-ADA/)); expect(screen.getByRole('button', { name: 'Affecter RES-ADA' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher une réservation'), { target: { value: 'inconnue' } }); expect(screen.getByText('Aucune réservation ne correspond aux filtres.')).toBeInTheDocument();
  });

  test('actions stop-sell, blockedUnits et reconstruction utilisent le backend', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('2'); render(<HotelInventoryCalendarPage />); await screen.findByRole('heading', { name: 'Standard' });
    fireEvent.click(screen.getByRole('button', { name: /Stop-sell/ })); await waitFor(() => expect(updateHotelInventoryRange).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ stopSell: true })));
    fireEvent.click(screen.getByRole('button', { name: /Bloquer/ })); await waitFor(() => expect(updateHotelInventoryRange).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ blockedUnits: 2 })));
    fireEvent.click(screen.getByRole('button', { name: /Reconstruire/ })); await waitFor(() => expect(rebuildHotelInventory).toHaveBeenCalled());
  });

  test('reste lisible en thème sombre et expose les contrôles au clavier', async () => {
    const { container } = render(<div className="dark"><HotelInventoryCalendarPage /></div>); await screen.findByRole('heading', { name: 'Standard' });
    expect(container.querySelector('.dark\\:text-gray-100')).toBeTruthy(); expect(screen.getByLabelText('Inventaire Standard').getAttribute('tabindex')).toBe('0');
  });
});
