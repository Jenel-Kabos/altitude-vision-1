import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccommodationRefundOperationsPage from '../pages/dashboard/AccommodationRefundOperationsPage';
import { approveAccommodationDeduction, approveAccommodationRefund, completeAccommodationRefund, listAccommodationDeductionOperations, listAccommodationRefundOperations } from '../services/accommodationReservationService';
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/accommodationReservationService', () => ({ listAccommodationRefundOperations: vi.fn(), listAccommodationDeductionOperations: vi.fn(), approveAccommodationDeduction: vi.fn(), rejectAccommodationDeduction: vi.fn(), approveAccommodationRefund: vi.fn(), completeAccommodationRefund: vi.fn() }));
test('affiche et rapproche un remboursement calculé par le serveur', async () => {
  listAccommodationDeductionOperations.mockResolvedValue([]);
  listAccommodationRefundOperations.mockResolvedValue([{ _id:'F1', status:'requested', amountMinor:100000, reasonCode:'CLIENT_CANCELLATION', provider:'mtn_direct', subjectId:{ guest:{ name:'Client' }, accommodation:{ property:{ title:'Maison' } } }, financialPayment:{ paymentReference:'PAY-1' } }]);
  vi.spyOn(window, 'prompt').mockReturnValueOnce('MTN-EXT-1').mockReturnValueOnce('2026-09-10');
  render(<AccommodationRefundOperationsPage/>);
  expect(await screen.findByText(/100.000.*FCFA/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name:'Marquer comme remboursé' }));
  await waitFor(() => expect(approveAccommodationRefund).toHaveBeenCalledWith('F1', expect.any(String)));
  expect(completeAccommodationRefund).toHaveBeenCalledWith('F1', expect.objectContaining({ reference:'MTN-EXT-1', amountMinor:100000, method:'bank_transfer' }), expect.any(String));
});
test('affiche une retenue signalée et soumet la validation financière', async () => {
  listAccommodationRefundOperations.mockResolvedValue([]);
  listAccommodationDeductionOperations.mockResolvedValue([{ _id:'D1', category:'damage', description:'Vitre cassée', reportedAmountMinor:40000, evidence:[{url:'https://example.test/proof'}], createdBy:{name:'Propriétaire'}, reservation:{accommodation:{property:{title:'Maison'}}} }]);
  render(<AccommodationRefundOperationsPage/>);
  expect(await screen.findByText(/Vitre cassée/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name:'Approuver' }));
  await waitFor(() => expect(approveAccommodationDeduction).toHaveBeenCalledWith('D1', 40000, expect.any(String)));
});
