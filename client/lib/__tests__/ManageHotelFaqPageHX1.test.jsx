import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManageHotelFaqPage from '../pages/dashboard/ManageHotelFaqPage';
import { getHotelFaqOwner, createHotelFaq, updateHotelFaq, deleteHotelFaq } from '../services/hotelService';

vi.mock('next/navigation', () => ({ useParams: () => ({ hotelId: 'hotel-1' }) }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelService', () => ({
  getHotelFaqOwner: vi.fn(), createHotelFaq: vi.fn(), updateHotelFaq: vi.fn(), deleteHotelFaq: vi.fn(),
}));

const entry = (overrides = {}) => ({ _id: 'faq-1', question: 'Le petit-déjeuner est-il inclus ?', answer: 'Selon le tarif choisi.', order: 0, active: true, ...overrides });

describe('ManageHotelFaqPage — PHASE-HX1 §23', () => {
  beforeEach(() => { vi.clearAllMocks(); getHotelFaqOwner.mockResolvedValue([entry()]); });

  test('liste les questions existantes', async () => {
    render(<ManageHotelFaqPage />);
    expect(await screen.findByText('Le petit-déjeuner est-il inclus ?')).toBeInTheDocument();
  });

  test('crée une nouvelle question', async () => {
    createHotelFaq.mockResolvedValue({});
    render(<ManageHotelFaqPage />);
    await screen.findByText('Le petit-déjeuner est-il inclus ?');
    fireEvent.click(screen.getByText('+ Nouvelle question'));
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Y a-t-il un parking ?' } });
    fireEvent.change(screen.getByLabelText('Réponse'), { target: { value: 'Oui, gratuit.' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(createHotelFaq).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ question: 'Y a-t-il un parking ?', answer: 'Oui, gratuit.' })));
  });

  test('modifie une question existante', async () => {
    updateHotelFaq.mockResolvedValue({});
    render(<ManageHotelFaqPage />);
    fireEvent.click(await screen.findByText('Modifier'));
    fireEvent.change(screen.getByLabelText('Modifier la réponse'), { target: { value: 'Toujours inclus.' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(updateHotelFaq).toHaveBeenCalledWith('hotel-1', 'faq-1', expect.objectContaining({ answer: 'Toujours inclus.' })));
  });

  test('désactive une question', async () => {
    updateHotelFaq.mockResolvedValue({});
    render(<ManageHotelFaqPage />);
    fireEvent.click(await screen.findByText('Désactiver'));
    await waitFor(() => expect(updateHotelFaq).toHaveBeenCalledWith('hotel-1', 'faq-1', { active: false }));
  });

  test('supprime une question après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteHotelFaq.mockResolvedValue({});
    render(<ManageHotelFaqPage />);
    fireEvent.click(await screen.findByText('Supprimer'));
    await waitFor(() => expect(deleteHotelFaq).toHaveBeenCalledWith('hotel-1', 'faq-1'));
  });

  test('sans confirmation, la suppression n’est pas exécutée', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ManageHotelFaqPage />);
    fireEvent.click(await screen.findByText('Supprimer'));
    expect(deleteHotelFaq).not.toHaveBeenCalled();
  });

  test('réordonne deux questions (échange l’ordre canonique)', async () => {
    getHotelFaqOwner.mockResolvedValue([entry({ _id: 'faq-1', question: 'Q1', order: 0 }), entry({ _id: 'faq-2', question: 'Q2', order: 1 })]);
    updateHotelFaq.mockResolvedValue({});
    render(<ManageHotelFaqPage />);
    await screen.findByText('Q1');
    fireEvent.click(screen.getByLabelText('Descendre "Q1"'));
    await waitFor(() => expect(updateHotelFaq).toHaveBeenCalledWith('hotel-1', 'faq-1', { order: 1 }));
    expect(updateHotelFaq).toHaveBeenCalledWith('hotel-1', 'faq-2', { order: 0 });
  });
});
