import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import HotelPaymentPanel from '../components/HotelPaymentPanel';
import * as service from '../services/hotelFinancialService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelFinancialService', () => ({ listDocumentPayments: vi.fn(), createHotelPayment: vi.fn(), confirmHotelPayment: vi.fn(), allocateHotelPayment: vi.fn(), reverseHotelAllocation: vi.fn() }));
const reservation = { _id: 'RES-1' };
const document = { id: 'DOC-1', status: 'issued', amountAllocatedMinor: 20000, balanceMinor: 80000 };
const payment = (overrides = {}) => ({ id: 'PAY-1', amountMinor: 100000, allocatedAmountMinor: 20000, availableAmountMinor: 80000, status: 'succeeded', method: 'cash', paymentReference: 'CAISSE-1', allocations: [], ...overrides });

describe('HotelPaymentPanel F2.2', () => {
  beforeEach(() => { vi.clearAllMocks(); service.listDocumentPayments.mockResolvedValue({ payments: [] }); });
  test('affiche l’état vide et bloque les mutations en lecture seule', async () => { render(<HotelPaymentPanel reservation={reservation} document={document} />); expect(await screen.findByText('Aucun paiement enregistré.')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Créer' })).not.toBeInTheDocument(); });
  test('crée puis confirme un paiement manuel', async () => { service.listDocumentPayments.mockResolvedValueOnce({ payments: [] }).mockResolvedValue({ payments: [payment({ status: 'pending', allocatedAmountMinor: 0, availableAmountMinor: 100000 })] }); render(<HotelPaymentPanel reservation={reservation} document={document} canManage />); fireEvent.change(screen.getByLabelText('Montant du paiement'), { target: { value: '100000' } }); fireEvent.click(screen.getByRole('button', { name: 'Créer' })); await waitFor(() => expect(service.createHotelPayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 100000, financialDocumentId: 'DOC-1' }))); fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' })); expect(service.confirmHotelPayment).toHaveBeenCalledWith('PAY-1'); });
  test('alloue partiellement et affiche le montant non alloué', async () => { service.listDocumentPayments.mockResolvedValue({ payments: [payment()] }); render(<HotelPaymentPanel reservation={reservation} document={document} canManage />); expect(await screen.findByText((text) => text.includes('Montant non alloué') && text.includes('80'))).toBeInTheDocument(); fireEvent.change(screen.getByLabelText('Allocation PAY-1'), { target: { value: '30000' } }); fireEvent.click(screen.getByRole('button', { name: 'Allouer' })); await waitFor(() => expect(service.allocateHotelPayment).toHaveBeenCalledWith('PAY-1', 'DOC-1', 30000)); });
  test('exige une justification avant renversement et restitue l’erreur API', async () => { const allocation = { id: 'A-1', amountMinor: 20000, status: 'active' }; service.listDocumentPayments.mockResolvedValue({ payments: [payment({ allocations: [allocation] })] }); vi.spyOn(window, 'prompt').mockReturnValue(''); render(<HotelPaymentPanel reservation={reservation} document={document} canManage />); fireEvent.click(await screen.findByRole('button', { name: 'Renverser' })); expect(toast.error).toHaveBeenCalledWith('Une justification est obligatoire.'); expect(service.reverseHotelAllocation).not.toHaveBeenCalled(); });
});
