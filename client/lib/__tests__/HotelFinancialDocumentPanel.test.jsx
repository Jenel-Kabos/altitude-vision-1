import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HotelFinancialDocumentPanel from '../components/HotelFinancialDocumentPanel';
import * as service from '../services/hotelFinancialService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/hotelFinancialService', () => ({
  getReservationFinancialDocument: vi.fn(), createReservationInvoiceDraft: vi.fn(),
  updateInvoiceDraftLines: vi.fn(), finalizeInvoiceLines: vi.fn(),
  refreshInvoiceFromReservation: vi.fn(), issueInvoice: vi.fn(),
  listDocumentPayments: vi.fn().mockResolvedValue({ payments: [] }), createHotelPayment: vi.fn(),
  confirmHotelPayment: vi.fn(), allocateHotelPayment: vi.fn(), reverseHotelAllocation: vi.fn(),
  getInvoicePdfStatus: vi.fn().mockResolvedValue(null), listInvoiceDeliveries: vi.fn().mockResolvedValue([]),
  generateInvoicePdf: vi.fn(), downloadInvoicePdf: vi.fn(), sendInvoiceEmail: vi.fn(),
}));
const reservation = { _id: 'RES-1', status: 'confirmed' };
const draft = (finalized = false) => ({ id: 'DOC-1', status: 'draft', currency: 'XAF', totalMinor: 60000, metadata: { linesFinalized: finalized }, lines: [{ id: 'L1', description: 'Séjour', quantity: 2, unitAmountMinor: 30000, discountAmountMinor: 0, taxAmountMinor: 0, feesAmountMinor: 0, lineType: 'accommodation' }] });

describe('HotelFinancialDocumentPanel F2.1', () => {
  beforeEach(() => vi.clearAllMocks());
  test('affiche aucun document et permet la création au gestionnaire', async () => {
    service.getReservationFinancialDocument.mockResolvedValue(null);
    service.createReservationInvoiceDraft.mockResolvedValue({ document: draft(false) });
    render(<HotelFinancialDocumentPanel reservation={reservation} canManage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Créer le brouillon' }));
    expect(await screen.findByText('Brouillon non finalisé')).toBeInTheDocument();
  });
  test('propriétaire en lecture seule sans actions de mutation', async () => {
    service.getReservationFinancialDocument.mockResolvedValue(draft(false));
    render(<HotelFinancialDocumentPanel reservation={reservation} canManage={false} />);
    expect(await screen.findByText('Lecture seule')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finaliser' })).not.toBeInTheDocument();
  });
  test('désactive émission avant finalisation puis l’active après finalisation', async () => {
    service.getReservationFinancialDocument.mockResolvedValue(draft(false));
    service.finalizeInvoiceLines.mockResolvedValue(draft(true));
    service.issueInvoice.mockResolvedValue({ ...draft(true), status: 'issued', documentNumber: 'FAC-F21-1' });
    render(<HotelFinancialDocumentPanel reservation={reservation} canManage />);
    expect(await screen.findByRole('button', { name: 'Émettre' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finaliser' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Émettre' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Émettre' }));
    expect(await screen.findByText('FAC-F21-1')).toBeInTheDocument();
  });
  test('une modification financière appelle le serveur et réinitialise la finalisation', async () => {
    service.getReservationFinancialDocument.mockResolvedValue(draft(true));
    service.updateInvoiceDraftLines.mockResolvedValue(draft(false));
    render(<HotelFinancialDocumentPanel reservation={reservation} canManage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    fireEvent.change(screen.getByLabelText('Quantité ligne 1'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(service.updateInvoiceDraftLines).toHaveBeenCalled());
    expect(await screen.findByText('Brouillon non finalisé')).toBeInTheDocument();
  });
});
