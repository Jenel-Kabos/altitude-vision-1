import { fireEvent, render, screen } from '@testing-library/react';
import EstimationMapPanel from '../components/dashboard/EstimationMapPanel';

vi.mock('next/dynamic', () => ({ default: () => () => <div>Carte mockée</div> }));
describe('EstimationMapPanel — TEST DATA', () => {
  test('gère les anciennes estimations sans coordonnées puis sauvegarde explicitement', () => {
    const onSave = vi.fn(); render(<EstimationMapPanel estimation={{ _id: 'old', location: {}, comparables: [] }} onSave={onSave} notify={vi.fn()} />);
    expect(screen.getByText(/Aucune coordonnée utilisable/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Latitude carte'), { target: { value: '-4.2' } }); fireEvent.change(screen.getByLabelText('Longitude carte'), { target: { value: '15.3' } });
    expect(screen.getByText(/Coordonnées non enregistrées/)).toBeInTheDocument(); fireEvent.click(screen.getByText('Utiliser ces coordonnées'));
    expect(onSave).toHaveBeenCalledWith({ location: { latitude: -4.2, longitude: 15.3 } });
  });
});
