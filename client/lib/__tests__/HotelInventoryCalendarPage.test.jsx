import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import HotelInventoryCalendarPage from '../pages/dashboard/HotelInventoryCalendarPage';
import { getHotelInventoryCalendar, rebuildHotelInventory, updateHotelInventoryRange, updateHotelInventoryDays } from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }) }));
vi.mock('../services/hotelService', () => ({ getHotelInventoryCalendar: vi.fn(), rebuildHotelInventory: vi.fn(), updateHotelInventoryRange: vi.fn(), updateHotelInventoryDays: vi.fn() }));
vi.mock('../components/RoomAssignmentPanel', () => ({ default: ({ reservation }) => <button>Affecter {reservation.reference}</button> }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const payload = {
  days: [{ id: 'day-1', date: '2026-10-10T00:00:00Z', roomCategory: 'category-1', categoryName: 'Standard', totalUnits: 3, availableUnits: 1, reservedUnits: 1, blockedUnits: 1, physicalOutOfService: 0, stopSell: false, isClosed: false }],
  rooms: [{ _id: 'room-1', roomNumber: '101', floor: 1, status: 'reserved' }, { _id: 'room-2', roomNumber: '102', floor: 2, status: 'out_of_service' }],
  housekeepingTasks: [], maintenanceTickets: [],
  reservations: [{ _id: 'reservation-1', reference: 'RES-ADA', status: 'confirmed', roomCategory: 'category-1', roomsCount: 2, assignmentState: 'partially_assigned', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' }, checkInDate: new Date().toISOString(), checkOutDate: '2026-10-12T00:00:00Z', assignedRooms: [{ _id: 'room-1', roomNumber: '101', floor: 1 }] }],
};

describe('HotelInventoryCalendarPage C/D.1.1', () => {
  beforeEach(() => { vi.clearAllMocks(); getHotelInventoryCalendar.mockResolvedValue(payload); updateHotelInventoryRange.mockResolvedValue({}); rebuildHotelInventory.mockResolvedValue({ nights: 7 }); updateHotelInventoryDays.mockResolvedValue({ results: [] }); });

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

describe('HotelInventoryCalendarPage — PHASE-HX1 §17 (édition du stock vendable par date)', () => {
  const twoDayPayload = {
    ...payload,
    days: [
      { id: 'day-1', date: '2026-10-10T00:00:00Z', roomCategory: 'category-1', categoryName: 'Standard', totalUnits: 5, availableUnits: 5, reservedUnits: 0, blockedUnits: 0, physicalOutOfService: 0, stopSell: false, isClosed: false },
      { id: 'day-2', date: '2026-10-11T00:00:00Z', roomCategory: 'category-1', categoryName: 'Standard', totalUnits: 5, availableUnits: 5, reservedUnits: 0, blockedUnits: 0, physicalOutOfService: 0, stopSell: false, isClosed: false },
    ],
  };
  beforeEach(() => { vi.clearAllMocks(); getHotelInventoryCalendar.mockResolvedValue(twoDayPayload); updateHotelInventoryDays.mockResolvedValue({ results: [{ ok: true }, { ok: true }] }); });

  test('un champ éditable de stock vendable est affiché pour chaque date, initialisé depuis les données canoniques', async () => {
    render(<HotelInventoryCalendarPage />);
    await screen.findByRole('heading', { name: 'Standard' });
    expect(screen.getByLabelText('Stock vendable Standard 2026-10-10')).toHaveValue(5);
    expect(screen.getByLabelText('Stock vendable Standard 2026-10-11')).toHaveValue(5);
  });

  test('des valeurs différentes sur des dates consécutives sont enregistrées en un seul appel groupé', async () => {
    render(<HotelInventoryCalendarPage />);
    await screen.findByRole('heading', { name: 'Standard' });
    fireEvent.change(screen.getByLabelText('Stock vendable Standard 2026-10-10'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Stock vendable Standard 2026-10-11'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le stock Standard' }));
    await waitFor(() => expect(updateHotelInventoryDays).toHaveBeenCalledWith('hotel-1', expect.objectContaining({
      roomCategoryId: 'category-1',
      updates: expect.arrayContaining([
        { date: '2026-10-10', sellableUnits: 3 },
        { date: '2026-10-11', sellableUnits: 0 },
      ]),
    })));
  });

  test('le bouton Enregistrer reste désactivé sans modification', async () => {
    render(<HotelInventoryCalendarPage />);
    await screen.findByRole('heading', { name: 'Standard' });
    expect(screen.getByRole('button', { name: 'Enregistrer le stock Standard' })).toBeDisabled();
  });

  test('une date refusée par le serveur (protection du réservé) est signalée, jamais silencieuse', async () => {
    updateHotelInventoryDays.mockResolvedValue({ results: [{ ok: false, code: 'INVENTORY_BELOW_RESERVED' }, { ok: true }] });
    render(<HotelInventoryCalendarPage />);
    await screen.findByRole('heading', { name: 'Standard' });
    fireEvent.change(screen.getByLabelText('Stock vendable Standard 2026-10-10'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le stock Standard' }));
    const { toast } = await import('react-hot-toast');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  test('le stock réservé reste visible et indiqué comme protégé', async () => {
    getHotelInventoryCalendar.mockResolvedValue({
      ...twoDayPayload,
      days: [{ ...twoDayPayload.days[0], reservedUnits: 2, totalUnits: 5, blockedUnits: 0 }],
    });
    render(<HotelInventoryCalendarPage />);
    await screen.findByRole('heading', { name: 'Standard' });
    expect(screen.getByText(/réservé 2/)).toBeInTheDocument();
    expect(screen.getByText('(protégé)')).toBeInTheDocument();
  });
});
