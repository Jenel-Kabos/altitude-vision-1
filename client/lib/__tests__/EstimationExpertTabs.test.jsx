import { fireEvent, render, screen } from '@testing-library/react';
import EstimationExpertTabs from '../components/dashboard/EstimationExpertTabs';

vi.mock('../services/estimationService', () => ({ getExpertAnalysis: vi.fn().mockResolvedValue({ anomalies: [], confidence: { total: 50, details: [] } }), updateEstimation: vi.fn(), scoreComparable: vi.fn(), adjustExpertValue: vi.fn() }));

const estimation = { _id: '507f1f77bcf86cd799439011', nom: 'Test', typeBien: 'Terrain nu', surface: 100, location: { city: 'Brazzaville' }, comparables: [], workflowHistory: [], currentCalculation: { finalResult: { marketValue: { recommended: 100 } } } };

describe('EstimationExpertTabs', () => {
  test('navigue entre la fiche, les comparables et les anomalies', async () => {
    render(<EstimationExpertTabs estimation={estimation} onChange={vi.fn()} notify={vi.fn()} />);
    expect(await screen.findByText(/Confiance explicable/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Comparables'));
    expect(screen.getByText('Aucun comparable.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Anomalies'));
    expect(await screen.findByText('Aucune anomalie détectée.')).toBeInTheDocument();
  });
});
