import api from '../services/api';
import {
  withdrawPropertyPublication,
  requestPropertyReactivation,
  requestPropertySuspensionReview,
  suspendPropertyPublication,
  liftPropertyPublicationSuspension,
  propertyPublicationStateLabel,
} from '../services/propertyService';

vi.mock('../services/api', () => ({
  default: { patch: vi.fn(), post: vi.fn() },
}));

describe('contrôles UI du cycle de publication immobilier', () => {
  beforeEach(() => vi.clearAllMocks());

  test('expose les libellés propriétaire et suspension sans confondre disponibilité et publication', () => {
    expect(propertyPublicationStateLabel('owner_withdrawn')).toBe('Retirée par le propriétaire');
    expect(propertyPublicationStateLabel('admin_suspended')).toBe('Suspendue par Altimmo');
    expect(propertyPublicationStateLabel('change_pending')).toBe('Modification en attente');
  });

  test('envoie les actions propriétaire aux endpoints dédiés', async () => {
    api.patch.mockResolvedValue({ data: { data: { property: { _id: 'p1' } } } });
    api.post.mockResolvedValue({ data: { data: { property: { _id: 'p1' } } } });
    await withdrawPropertyPublication('p1', 'Vendu', 'Vente conclue');
    await requestPropertyReactivation('p1', 'Retour au marché');
    await requestPropertySuspensionReview('p1', 'Pièces corrigées');
    expect(api.patch).toHaveBeenCalledWith('/properties/p1/lifecycle', { availability: 'Vendu', reason: 'Vente conclue' });
    expect(api.post).toHaveBeenCalledWith('/properties/p1/reactivation', { reason: 'Retour au marché' });
    expect(api.post).toHaveBeenCalledWith('/properties/p1/suspension-review', { reason: 'Pièces corrigées' });
  });

  test('envoie suspendre et lever sous scope plateforme sans republication locale', async () => {
    api.post.mockResolvedValue({ data: { data: { property: { _id: 'p1', isPublished: false } } } });
    await suspendPropertyPublication('p1', 'Contrôle requis');
    await liftPropertyPublicationSuspension('p1', 'Contrôle terminé');
    expect(api.post).toHaveBeenNthCalledWith(1, '/admin/properties/p1/suspend', { reason: 'Contrôle requis' }, { platformScoped: true });
    expect(api.post).toHaveBeenNthCalledWith(2, '/admin/properties/p1/lift-suspension', { reason: 'Contrôle terminé' }, { platformScoped: true });
  });
});
