import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OwnerVisitesPage from '../pages/dashboard/OwnerVisitesPage';
import { getOwnerVisites, updateOwnerVisite } from '../services/visiteService';

vi.mock('../services/visiteService', () => ({
  getOwnerVisites: vi.fn(),
  updateOwnerVisite: vi.fn(),
}));

describe('OwnerVisitesPage — TEST DATA', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getOwnerVisites.mockReset();
    updateOwnerVisite.mockReset();
  });

  test('affiche le contrat backend sans exposer les données supprimées', async () => {
    getOwnerVisites.mockResolvedValue([{
      _id: 'TEST-DATA-VISIT', status: 'confirmee', displayStatus: 'Confirmée',
      telephone: '+24••••67', client: { name: 'TEST DATA CLIENT' },
      property: { title: 'TEST DATA PROPERTY', address: { city: 'TEST DATA CITY' } },
      scheduledStartAt: '2030-01-01T09:00:00.000Z', allowedActions: ['start'], createdAt: '2029-12-01T00:00:00.000Z',
    }]);
    render(<OwnerVisitesPage />);
    expect(await screen.findByText('TEST DATA PROPERTY')).toBeInTheDocument();
    expect(screen.getByText('+24••••67')).toBeInTheDocument();
    expect(screen.getByText('Visite commencée')).toBeInTheDocument();
    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });

  test('envoie uniquement une action autorisée et actualise la carte', async () => {
    const visite = {
      _id: 'TEST-DATA-VISIT', status: 'confirmee', displayStatus: 'Confirmée',
      client: { name: 'TEST DATA CLIENT' }, property: { title: 'TEST DATA PROPERTY' },
      allowedActions: ['start'], createdAt: '2029-12-01T00:00:00.000Z',
    };
    getOwnerVisites.mockResolvedValue([visite]);
    updateOwnerVisite.mockResolvedValue({ ...visite, status: 'en_cours', displayStatus: 'En cours', allowedActions: ['complete'] });
    render(<OwnerVisitesPage />);
    fireEvent.click(await screen.findByText('Visite commencée'));
    await waitFor(() => expect(updateOwnerVisite).toHaveBeenCalledWith('TEST-DATA-VISIT', 'start', { reason: '' }));
    expect(await screen.findByText('Visite terminée')).toBeInTheDocument();
  });
});
