import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EstimationsPage from '../pages/dashboard/EstimationsPage';
import * as estimationService from '../services/estimationService';

vi.mock('../services/estimationService', () => ({
  getAllEstimations: vi.fn(), getEstimation: vi.fn(), updateEstimation: vi.fn(),
  calculateEstimation: vi.fn(), validateEstimation: vi.fn(), publishEstimation: vi.fn(),
  getLaboratoryStatistics: vi.fn().mockResolvedValue({ summary: {}, byStatus: [] }),
  getMarketHistory: vi.fn().mockResolvedValue([]), compareEstimations: vi.fn(),
}));

const dossier = {
  _id: '507f1f77bcf86cd799439011', nom: 'Client test', referenceBien: 'ALT-EST-001', typeBien: 'Terrain nu', transaction: 'vente',
  surface: 500, adresse: 'Bacongo', location: { city: 'Brazzaville', neighborhood: 'Bacongo' }, statut: 'En attente', createdAt: '2026-01-01',
  land: {}, construction: {}, workflowHistory: [], currentCalculation: null,
};

describe('EstimationsPage laboratoire', () => {
  beforeEach(() => { vi.clearAllMocks(); estimationService.getAllEstimations.mockResolvedValue([dossier]); estimationService.getEstimation.mockResolvedValue(dossier); });

  test('affiche le laboratoire et ouvre les champs conditionnels terrain/construction', async () => {
    render(<EstimationsPage />);
    expect(await screen.findByText("Laboratoire d'expertise immobilière")).toBeInTheDocument();
    fireEvent.click(screen.getByText('ALT-EST-001'));
    await waitFor(() => expect(estimationService.getEstimation).toHaveBeenCalledWith(dossier._id));
    expect(screen.getByLabelText('Surface terrain m²')).toBeInTheDocument();
    expect(screen.getByLabelText('Surface bâtie m²')).toBeInTheDocument();
    expect(screen.getByText('Aucun calcul disponible. Ajoutez une référence interne active, puis lancez le calcul.')).toBeInTheDocument();
  });

  test('le simulateur appelle le calcul sans valeur de marché codée côté client', async () => {
    estimationService.calculateEstimation.mockResolvedValue({ estimation: { ...dossier, statut: 'Calcul automatique terminé' }, calculation: { version: 1, confidenceScore: 55, finalResult: { marketValue: { low: 1, recommended: 2, high: 3 } } } });
    render(<EstimationsPage />);
    fireEvent.click(await screen.findByText('ALT-EST-001'));
    await screen.findByLabelText('Loyer mensuel');
    fireEvent.change(screen.getByLabelText('Loyer mensuel'), { target: { value: '100000' } });
    fireEvent.click(screen.getByText('Lancer le calcul'));
    await waitFor(() => expect(estimationService.calculateEstimation).toHaveBeenCalledWith(dossier._id, { monthlyRent: '100000' }));
  });
});
