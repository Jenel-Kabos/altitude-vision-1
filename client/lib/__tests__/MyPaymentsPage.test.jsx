import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MyPaymentsPage from '../pages/dashboard/MyPaymentsPage';
import * as ownerFinancial from '../services/ownerRentalFinancialService';

vi.mock('../services/ownerRentalFinancialService', () => ({ getOwnerRentalPayments: vi.fn() }));

const payload = {
  items: [{ _id: 'PAY1', period: '08/2026', expected: 150000, paid: 100000, remaining: 50000, status: 'partiel', property: { title: 'Villa Test' }, lease: { tenantName: 'Client Test' } }],
  summary: { du: 999999, recu: 777777, restant: 222222, penalites: 0 },
  pagination: { page: 1, pages: 2, total: 6, limit: 5 },
};

describe('MyPaymentsPage owner rental financial self-service', () => {
  beforeEach(() => ownerFinancial.getOwnerRentalPayments.mockResolvedValue(payload));

  test('remplace le placeholder par summary et historique locatif', async () => {
    render(<MyPaymentsPage />);
    expect(await screen.findByText('Villa Test')).toBeInTheDocument();
    expect(screen.getByText('Loyer attendu')).toBeInTheDocument();
    expect(screen.getByText('Montant payé')).toBeInTheDocument();
    expect(screen.getByText(/999.?999/)).toBeInTheDocument();
    expect(screen.queryByText(/bientôt disponible/i)).not.toBeInTheDocument();
  });

  test('affiche un état vide distinct d’une erreur', async () => {
    ownerFinancial.getOwnerRentalPayments.mockResolvedValueOnce({ items: [], summary: { du: 0, recu: 0, restant: 0 }, pagination: { page: 1, pages: 0, total: 0 } });
    render(<MyPaymentsPage />);
    expect(await screen.findByText('Aucun paiement locatif')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('gère loading, pagination et erreur API', async () => {
    render(<MyPaymentsPage />);
    const next = await screen.findByRole('button', { name: /page suivante/i });
    fireEvent.click(next);
    await waitFor(() => expect(ownerFinancial.getOwnerRentalPayments).toHaveBeenLastCalledWith({ page: 2, limit: 20 }));

    ownerFinancial.getOwnerRentalPayments.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: /actualiser/i }));
    expect(await screen.findByText(/impossible de charger/i)).toBeInTheDocument();
  });
});
