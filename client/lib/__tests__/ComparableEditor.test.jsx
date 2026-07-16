import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ComparableEditor from '../components/dashboard/ComparableEditor';
import { updateComparable } from '../services/estimationService';

vi.mock('../services/estimationService', () => ({ updateComparable: vi.fn() }));
const comparable = { _id: '507f1f77bcf86cd799439012', source: 'TEST DATA', sourceType: 'reference_manuelle', priceType: 'demande', date: '2026-01-01', city: 'TEST DATA CITY', propertyType: 'Terrain', landSurface: 100, askingPrice: 1000, sourceConfidence: 'moyen', weight: .5, included: true, similarity: 80 };

describe('ComparableEditor — TEST DATA', () => {
  test('affiche tous les champs structurants et sauvegarde par le backend', async () => {
    updateComparable.mockResolvedValue({ estimation: { _id: '507f1f77bcf86cd799439011' }, calculationStale: true }); const onSaved = vi.fn(); const notify = vi.fn();
    render(<ComparableEditor estimationId="507f1f77bcf86cd799439011" comparable={comparable} onSaved={onSaved} onClose={vi.fn()} notify={notify} />);
    expect(screen.getByText(/Prix\/m²/)).toHaveTextContent('10 XAF');
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-4.2' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(updateComparable).toHaveBeenCalledWith('507f1f77bcf86cd799439011', comparable._id, expect.objectContaining({ latitude: -4.2, askingPrice: 1000 })));
    expect(onSaved).toHaveBeenCalled(); expect(notify).toHaveBeenCalledWith(expect.stringContaining('nouveau calcul'));
  });

  test('rend la justification obligatoire quand le comparable est exclu', () => {
    render(<ComparableEditor estimationId="507f1f77bcf86cd799439011" comparable={{ ...comparable, included: false }} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />);
    expect(screen.getByText('Justification d’exclusion').querySelector('textarea')).toBeRequired();
  });
});
