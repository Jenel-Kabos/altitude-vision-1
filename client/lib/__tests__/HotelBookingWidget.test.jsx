import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import HotelBookingWidget from '../components/HotelBookingWidget';
import { getHotelAvailability, createPublicHotelReservation } from '../services/hotelReservationService';

// Sprint C — widget public de réservation hôtelière.

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelReservationService', () => ({
  getHotelAvailability: vi.fn(),
  createPublicHotelReservation: vi.fn(),
}));

const categories = [
  {
    _id: 'CAT-1', name: 'Standard',
    rates: [{ _id: 'RATE-1', rateType: 'public', amount: 35000, currency: 'XAF' }],
  },
];

describe('HotelBookingWidget — Sprint C — TEST DATA', () => {
  beforeEach(() => vi.clearAllMocks());

  test("affiche 'Vérifier la disponibilité' et jamais 'Payer'", () => {
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={categories} />);
    expect(screen.getByRole('button', { name: 'Vérifier la disponibilité' })).toBeInTheDocument();
    expect(screen.queryByText(/Payer/i)).not.toBeInTheDocument();
  });

  test("aucune catégorie réservable affiche un message informatif", () => {
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={[]} />);
    expect(screen.getByText(/Aucune catégorie n'est disponible/i)).toBeInTheDocument();
  });

  test('vérifier la disponibilité affiche le résultat et un prix estimé', async () => {
    getHotelAvailability.mockResolvedValue({ available: true, nights: [{ date: '2026-08-10', available: true }] });
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={categories} />);

    fireEvent.change(screen.getByLabelText("Date d'arrivée"), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier la disponibilité' }));

    await waitFor(() => expect(getHotelAvailability).toHaveBeenCalledWith('HOTEL-1', expect.objectContaining({ roomCategoryId: 'CAT-1' })));
    expect(await screen.findByText(/Disponible pour 2 nuit/i)).toBeInTheDocument();
    expect(screen.getByText(/Prix estimé/i)).toBeInTheDocument();
  });

  test("une indisponibilité affiche une erreur et ne montre jamais le formulaire client", async () => {
    getHotelAvailability.mockResolvedValue({ available: false, nights: [] });
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={categories} />);
    fireEvent.change(screen.getByLabelText("Date d'arrivée"), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier la disponibilité' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument();
  });

  test('soumettre la demande après disponibilité confirmée crée la réservation', async () => {
    getHotelAvailability.mockResolvedValue({ available: true, nights: [] });
    createPublicHotelReservation.mockResolvedValue({ reference: 'RES-2026-000001' });
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={categories} />);

    fireEvent.change(screen.getByLabelText("Date d'arrivée"), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier la disponibilité' }));
    await screen.findByText(/Disponible pour/i);

    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Jean' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Dupont' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Demander la réservation' }));

    await waitFor(() => expect(createPublicHotelReservation).toHaveBeenCalledWith('HOTEL-1', expect.objectContaining({
      roomCategoryId: 'CAT-1', ratePlanId: 'RATE-1',
    })));
    expect(await screen.findByText(/RES-2026-000001/)).toBeInTheDocument();
  });
});

describe('HotelBookingWidget — PHASE-HW1 §11 (contexte verrouillé depuis la recherche multi-catégories)', () => {
  const lockedSelection = {
    roomCategoryId: 'CAT-2', ratePlanId: 'RATE-2', checkInDate: '2026-09-10', checkOutDate: '2026-09-12',
    roomsCount: 1, adults: 2, children: 0, categoryName: 'Deluxe', rateLabel: 'Tarif public', totalAmount: 90000, nights: 2,
    onClear: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); });

  test('affiche un résumé non modifiable, jamais les listes déroulantes de sélection', () => {
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={[]} lockedSelection={lockedSelection} />);
    expect(screen.getByText('Deluxe · Tarif public')).toBeInTheDocument();
    expect(screen.getByText(/2026-09-10 → 2026-09-12/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Catégorie')).toBeNull();
    expect(screen.queryByLabelText('Tarif')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vérifier la disponibilité' })).toBeNull();
  });

  test('saute directement aux informations client (le contexte est déjà validé par la recherche en direct)', () => {
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={[]} lockedSelection={lockedSelection} />);
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
  });

  test('la réservation créée porte exactement la catégorie/le tarif/les dates fournis, jamais recalculés côté client', async () => {
    getHotelAvailability.mockResolvedValue({ available: true, nights: [] });
    createPublicHotelReservation.mockResolvedValue({ reference: 'RES-2026-000002' });
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={[]} lockedSelection={lockedSelection} />);
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Jean' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Dupont' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Demander la réservation' }));
    await waitFor(() => expect(createPublicHotelReservation).toHaveBeenCalledWith('HOTEL-1', expect.objectContaining({
      roomCategoryId: 'CAT-2', ratePlanId: 'RATE-2', checkInDate: '2026-09-10', checkOutDate: '2026-09-12',
    })));
    expect(getHotelAvailability).not.toHaveBeenCalled();
  });

  test('"Modifier la sélection" appelle onClear fourni par la page', () => {
    render(<HotelBookingWidget hotelId="HOTEL-1" categories={[]} lockedSelection={lockedSelection} />);
    fireEvent.click(screen.getByText('Modifier la sélection'));
    expect(lockedSelection.onClear).toHaveBeenCalled();
  });
});
