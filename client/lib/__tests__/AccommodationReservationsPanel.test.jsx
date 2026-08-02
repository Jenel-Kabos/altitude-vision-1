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
    // GL-ARCH-1.2 — le panneau initialise son mois affiché sur la VRAIE date
    // système (`AccommodationReservationsPanel.jsx` : `useState(() => new
    // Date(...))`), jamais mockée ici. Un clic sur « Mois suivant » affiche
    // donc toujours le mois civil suivant le mois réel courant, quel qu'il
    // soit — coder une date absolue (ex: août 2026) rendait ce test
    // dépendant de la date d'exécution et cassait dès que « aujourd'hui »
    // dépassait juillet 2026. Les dates mockées sont désormais calculées
    // relativement à « maintenant », donc valides à n'importe quelle date
    // d'exécution, sans jamais devenir obsolètes.
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const targetDay = 10; // présent dans tous les mois, aucun risque de débordement
    const iso = (day) => new Date(Date.UTC(nextMonth.getFullYear(), nextMonth.getMonth(), day)).toISOString();
    const expectedDateLabel = new RegExp(
      `${String(targetDay).padStart(2, '0')}\\/${String(nextMonth.getMonth() + 1).padStart(2, '0')}\\/${nextMonth.getFullYear()}.*confirmed.*Maintenance`,
      'i',
    );
    getAccommodationReservationCalendar.mockResolvedValue({
      reservations: [{ _id: 'R1', status: 'confirmed', checkInDate: iso(targetDay), checkOutDate: iso(targetDay + 2), guestCount: 2 }],
      blocks: [{ _id: 'B1', type: 'maintenance', startDate: iso(targetDay), endDate: iso(targetDay + 1), reason: 'Travaux' }],
    });
    render(<AccommodationReservationsPanel accommodations={accommodations}/>); fireEvent.click(screen.getByRole('button', { name:'Calendrier et blocages' })); fireEvent.click(screen.getByRole('button', { name:'Mois suivant' }));
    const cell = await screen.findByRole('button', { name: expectedDateLabel }); fireEvent.click(cell); const dialog = screen.getByRole('dialog', { name:'2 éléments sur cette date' }); expect(within(dialog).getByRole('button', { name:/Réservation/ })).toBeInTheDocument(); expect(within(dialog).getByRole('button', { name:/maintenance/i })).toBeInTheDocument(); fireEvent.keyDown(window, { key:'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog', { name:'2 éléments sur cette date' })).not.toBeInTheDocument());
  });
});
