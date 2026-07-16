import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OwnerVisitesPage from '../pages/dashboard/OwnerVisitesPage';
import { getOwnerVisites, updateOwnerVisite } from '../services/visiteService';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

vi.mock('../services/visiteService', () => ({
  getOwnerVisites: vi.fn(),
  updateOwnerVisite: vi.fn(),
}));

describe('OwnerVisitesPage — TEST DATA', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getOwnerVisites.mockReset();
    updateOwnerVisite.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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
    expect(screen.getByText('Démarrer la visite')).toBeInTheDocument();
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
    fireEvent.click(await screen.findByText('Démarrer la visite'));
    await waitFor(() => expect(updateOwnerVisite).toHaveBeenCalledWith('TEST-DATA-VISIT', 'start', { reason: '' }));
    expect(await screen.findByText('Terminer la visite')).toBeInTheDocument();
  });

  test('ouvre un détail mobile et revient à la liste sans exposer d’email', async () => {
    getOwnerVisites.mockResolvedValue([{
      _id: 'TEST-DATA-VISIT', status: 'confirmee', displayStatus: 'Confirmée',
      client: { name: 'TEST DATA CLIENT', email: 'private@example.invalid' },
      property: { title: 'TEST DATA PROPERTY' }, allowedActions: [],
      scheduledStartAt: '2030-01-01T09:00:00.000Z', createdAt: '2029-12-01T00:00:00.000Z',
    }]);
    render(<OwnerVisitesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir le rendez-vous pour TEST DATA PROPERTY' }));
    expect(screen.getByRole('button', { name: 'Retour aux rendez-vous' })).toBeInTheDocument();
    expect(screen.queryByText('private@example.invalid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux rendez-vous' }));
    expect(screen.queryByRole('button', { name: 'Retour aux rendez-vous' })).not.toBeInTheDocument();
  });
});
