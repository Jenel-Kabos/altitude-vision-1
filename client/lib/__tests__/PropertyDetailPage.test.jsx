import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PropertyDetailPage from '../pages/PropertyDetailPage';
import { getPropertyById, getPropertiesWithFilters, likeProperty } from '../services/propertyService';
import api from '../services/api';

const back = vi.fn();
const push = vi.fn();
const sectionState = vi.hoisted(() => ({ commentsFail: false }));
const authState = vi.hoisted(() => ({ user: null }));
vi.mock('next/navigation', () => ({ useParams: () => ({ propertyId: 'TEST-DATA-PROPERTY' }), useRouter: () => ({ back, push }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock('../services/propertyService', () => ({ getPropertyById: vi.fn(), getPropertiesWithFilters: vi.fn(), likeProperty: vi.fn(), shareProperty: vi.fn() }));
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../components/comments/CommentList', () => ({ default: () => {
  if (sectionState.commentsFail) throw new Error('TEST DATA COMMENTS ERROR');
  return <div>TEST DATA COMMENTS</div>;
} }));
vi.mock('../components/ContactModal', () => ({ default: () => <div>TEST DATA CONTACT</div> }));
vi.mock('../components/SignalerAnnonceModal', () => ({ default: () => <div>TEST DATA REPORT</div> }));

const property = {
  _id: 'TEST-DATA-PROPERTY', title: 'TEST DATA HOUSE', description: 'TEST DATA DESCRIPTION',
  owner: null, images: [], amenities: [], likes: [], address: { city: 'TEST DATA CITY', arrondissement: '', street: '' },
  price: null, surface: 316, bedrooms: 0, bathrooms: 0, livingRooms: 0, kitchens: 0,
  status: 'location', statusAdmin: 'Validée', availability: 'Disponible', views: 0, shares: 0,
  reference: 'TEST-DATA-REF', createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-02T00:00:00.000Z',
};

describe('PropertyDetailPage — TEST DATA', () => {
  beforeEach(() => {
    getPropertyById.mockReset();
    back.mockReset();
    push.mockReset();
    sectionState.commentsFail = false;
    authState.user = null;
    api.post.mockReset();
    likeProperty.mockReset();
    getPropertiesWithFilters.mockReset();
    getPropertiesWithFilters.mockResolvedValue({ properties: [] });
  });

  test('reproduit le payload owner null sans déclencher le fallback global', async () => {
    getPropertyById.mockResolvedValue(property);
    render(<PropertyDetailPage />);
    expect(await screen.findByRole('heading', { name: 'TEST DATA HOUSE' })).toBeInTheDocument();
    expect(screen.getAllByText('Prix sur demande').length).toBeGreaterThan(0);
    expect(screen.queryByText(/0 chambre/i)).not.toBeInTheDocument();
    expect(screen.getByText('Planifier une visite')).toBeInTheDocument();
  });

  test('affiche le skeleton pendant la requête', () => {
    getPropertyById.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PropertyDetailPage />);
    expect(container.querySelectorAll('.pdp-skel').length).toBeGreaterThan(0);
  });

  test('affiche une 404 métier', async () => {
    getPropertyById.mockRejectedValue({ response: { status: 404 } });
    render(<PropertyDetailPage />);
    expect(await screen.findByText('Ce bien n’existe plus ou n’est plus disponible.')).toBeInTheDocument();
    expect(screen.queryByText('Réessayer')).not.toBeInTheDocument();
  });

  test('une erreur réseau permet de relancer la vraie requête', async () => {
    getPropertyById.mockRejectedValueOnce({ request: {}, message: 'TEST DATA NETWORK' }).mockResolvedValueOnce(property);
    render(<PropertyDetailPage />);
    fireEvent.click(await screen.findByText('Réessayer'));
    await waitFor(() => expect(getPropertyById).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'TEST DATA HOUSE' })).toBeInTheDocument();
  });

  test('une section secondaire en erreur ne fait pas tomber la fiche', async () => {
    sectionState.commentsFail = true;
    getPropertyById.mockResolvedValue(property);
    render(<PropertyDetailPage />);
    expect(await screen.findByRole('heading', { name: 'TEST DATA HOUSE' })).toBeInTheDocument();
    expect(screen.getByText('Cette section est temporairement indisponible.')).toBeInTheDocument();
  });

  test('le rendez-vous empêche une double soumission sans faire tomber la fiche', async () => {
    authState.user = { _id: 'TEST-DATA-CLIENT', phone: '+242000000000' };
    getPropertyById.mockResolvedValue(property);
    api.post.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PropertyDetailPage />);
    fireEvent.click(await screen.findByText('Planifier une visite'));
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2030-01-01' } });
    fireEvent.change(container.querySelector('input[type="time"]'), { target: { value: '10:00' } });
    fireEvent.change(container.querySelector('input[type="tel"]'), { target: { value: '+242000000000' } });
    fireEvent.click(container.querySelector('input[type="checkbox"]'));
    const submit = screen.getByText('Confirmer la demande');
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'TEST DATA HOUSE' })).toBeInTheDocument();
  });

  test('affiche les repères de confiance, la localisation générale et la référence', async () => {
    getPropertyById.mockResolvedValue({ ...property, owner: { _id: 'TEST-DATA-OWNER', name: 'TEST DATA OWNER' }, images: ['https://example.com/test.jpg'] });
    render(<PropertyDetailPage />);
    expect(await screen.findByText('Repères de confiance')).toBeInTheDocument();
    expect(screen.getByText('Annonce vérifiée par Altimmo')).toBeInTheDocument();
    expect(screen.getByText('Propriétaire identifié')).toBeInTheDocument();
    expect(screen.getByText(/Réf\. TEST-DATA-REF/)).toBeInTheDocument();
    expect(screen.getByText(/localisation exacte.*après confirmation/i)).toBeInTheDocument();
    expect(screen.getByAltText('TEST DATA HOUSE — photo 1')).toBeInTheDocument();
  });

  test('rend une barre mobile accessible avec quatre actions prioritaires', async () => {
    getPropertyById.mockResolvedValue(property);
    const { container } = render(<PropertyDetailPage />);
    await screen.findByRole('heading', { name: 'TEST DATA HOUSE' });
    const mobileActions = container.querySelector('nav[aria-label="Actions du bien"]');
    expect(mobileActions).toBeInTheDocument();
    expect(mobileActions.querySelectorAll('button, a')).toHaveLength(4);
    expect(screen.getByLabelText('Appeler l’agence Altimmo')).toBeInTheDocument();
  });

  test('désactive le rendez-vous pour un bien indisponible', async () => {
    getPropertyById.mockResolvedValue({ ...property, availability: 'Loué' });
    render(<PropertyDetailPage />);
    const buttons = await screen.findAllByRole('button', { name: /rendez-vous|visite indisponible/i });
    expect(buttons.some((button) => button.disabled)).toBe(true);
  });

  test('le favori applique un retour optimiste et appelle l’API', async () => {
    authState.user = { _id: 'TEST-DATA-CLIENT' };
    getPropertyById.mockResolvedValue(property);
    likeProperty.mockResolvedValue({});
    render(<PropertyDetailPage />);
    fireEvent.click(await screen.findByTitle("J'aimer ce bien"));
    expect(likeProperty).toHaveBeenCalledWith('TEST-DATA-PROPERTY');
    expect(await screen.findByTitle('Ne plus aimer')).toBeInTheDocument();
  });

  test('affiche uniquement les biens similaires validés et masque une erreur locale', async () => {
    getPropertyById.mockResolvedValue(property);
    getPropertiesWithFilters.mockResolvedValue({ properties: [
      { _id: 'TEST-DATA-SIMILAR', title: 'TEST DATA SIMILAR', type: 'location', statusAdmin: 'Validée', availability: 'Disponible', images: [], price: 250000 },
      { _id: 'TEST-DATA-HIDDEN', title: 'TEST DATA HIDDEN', statusAdmin: 'En attente', availability: 'Disponible' },
    ] });
    const { rerender } = render(<PropertyDetailPage />);
    expect(await screen.findByText('TEST DATA SIMILAR')).toBeInTheDocument();
    expect(screen.queryByText('TEST DATA HIDDEN')).not.toBeInTheDocument();
    getPropertiesWithFilters.mockRejectedValue(new Error('TEST DATA SIMILAR ERROR'));
    rerender(<PropertyDetailPage />);
    expect(screen.getByRole('heading', { name: 'TEST DATA HOUSE' })).toBeInTheDocument();
  });
});
