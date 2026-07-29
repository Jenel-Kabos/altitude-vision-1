import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AccommodationReservationsPanel from '../components/dashboard/AccommodationReservationsPanel';
import { createAccommodationReservation, getAccommodationAvailability, getAccommodationReservationCalendar, listAccommodationReservations, transitionAccommodationReservation } from '../services/accommodationReservationService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/accommodationReservationService', () => ({
  listAccommodationReservations: vi.fn(), createAccommodationReservation: vi.fn(), transitionAccommodationReservation: vi.fn(),
  getAccommodationAvailability: vi.fn(), createAccommodationBlock: vi.fn(), listAccommodationBlocks: vi.fn().mockResolvedValue([]), deleteAccommodationBlock: vi.fn(),
  getAccommodationReservationCalendar: vi.fn().mockResolvedValue({ reservations: [], blocks: [] }), getAccommodationReservation: vi.fn(),
  getAccommodationRefundableSummary: vi.fn(), requestAccommodationRefund: vi.fn(), approveAccommodationRefund: vi.fn(), completeAccommodationRefund: vi.fn(), cancelAccommodationRefund: vi.fn(),
}));
const accommodations = [{ _id: 'A1', property: { title: 'Villa Test' } }];

describe('AccommodationReservationsPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); listAccommodationReservations.mockResolvedValue({ reservations: [] }); });
  test('affiche un état vide réel', async () => { render(<AccommodationReservationsPanel accommodations={accommodations} />); expect(await screen.findByText('Aucune réservation.')).toBeInTheDocument(); });
  test('une réservation pending propose confirmer et annuler', async () => {
    listAccommodationReservations.mockResolvedValue({ reservations: [{ _id: 'R1', status: 'pending', nights: 2, total: 75000, checkInDate: '2027-07-10', checkOutDate: '2027-07-12', accommodation: { property: { title: 'Villa Test' } } }] });
    transitionAccommodationReservation.mockResolvedValue({}); render(<AccommodationReservationsPanel accommodations={accommodations} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' })); await waitFor(() => expect(transitionAccommodationReservation).toHaveBeenCalledWith('R1', 'confirm'));
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });
  test('le formulaire affiche nuits, tarif et total provenant de l’API', async () => {
    getAccommodationAvailability.mockResolvedValue({ available: true, pricing: { nights: 2, nightlyRate: 35000, total: 75000 } }); createAccommodationReservation.mockResolvedValue({});
    render(<AccommodationReservationsPanel accommodations={accommodations} />); fireEvent.click(screen.getByRole('button', { name: 'Nouvelle réservation' }));
    fireEvent.change(screen.getByLabelText('Arrivée'), { target: { value: '2027-07-10' } }); fireEvent.change(screen.getByLabelText('Départ'), { target: { value: '2027-07-12' } });
    expect(await screen.findByText(/2 nuits/)).toBeInTheDocument(); expect(screen.getByText(/Total/)).toHaveTextContent(/75/);
    fireEvent.click(screen.getByRole('button', { name: 'Créer la demande' })); await waitFor(() => expect(createAccommodationReservation).toHaveBeenCalled());
  });
  test('une cellule multiéléments ouvre une vraie liste de choix accessible', async () => {
    getAccommodationReservationCalendar.mockResolvedValue({ reservations:[{ _id:'R1', status:'confirmed', checkInDate:'2026-08-10T00:00:00Z', checkOutDate:'2026-08-12T00:00:00Z', guestCount:2 }], blocks:[{ _id:'B1', type:'maintenance', startDate:'2026-08-10T00:00:00Z', endDate:'2026-08-11T00:00:00Z', reason:'Travaux' }] });
    render(<AccommodationReservationsPanel accommodations={accommodations}/>); fireEvent.click(screen.getByRole('button', { name:'Calendrier et blocages' })); fireEvent.click(screen.getByRole('button', { name:'Mois suivant' }));
    const cell = await screen.findByRole('button', { name:/10\/08\/2026.*confirmed.*Maintenance/i }); fireEvent.click(cell); const dialog = screen.getByRole('dialog', { name:'2 éléments sur cette date' }); expect(within(dialog).getByRole('button', { name:/Réservation/ })).toBeInTheDocument(); expect(within(dialog).getByRole('button', { name:/maintenance/i })).toBeInTheDocument(); fireEvent.keyDown(window, { key:'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog', { name:'2 éléments sur cette date' })).not.toBeInTheDocument());
  });
});
