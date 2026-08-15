import { render, screen, waitFor } from '@testing-library/react';
import OwnerContextLanding from '../pages/dashboard/OwnerContextLanding';

const replace = vi.fn();
let mockAuth;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

describe('OwnerContextLanding', () => {
  beforeEach(() => { replace.mockReset(); });

  test('attend le resolver backend au lieu de choisir depuis le payload auth', () => {
    mockAuth = { user: { _id: 'OWNER', role: 'Proprietaire' }, loading: false, businessProfiles: null };
    render(<OwnerContextLanding />);
    expect(screen.getByText(/Résolution de vos espaces métier/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  test('redirige un exploitant pur vers ses établissements', async () => {
    mockAuth = { user: { _id: 'OWNER', role: 'Proprietaire' }, loading: false, businessProfiles: ['exploitant_etablissement'] };
    render(<OwnerContextLanding />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/mes-hotels'));
  });

  test('propose les deux univers à un propriétaire multi-activité', () => {
    mockAuth = { user: { _id: 'OWNER', role: 'Proprietaire' }, loading: false, businessProfiles: ['proprietaire_immobilier', 'exploitant_etablissement'] };
    render(<OwnerContextLanding />);
    expect(screen.getByRole('link', { name: /Patrimoine immobilier/i })).toHaveAttribute('href', '/mes-biens');
    expect(screen.getByRole('link', { name: /Exploitation d’établissements/i })).toHaveAttribute('href', '/mes-hotels');
    expect(replace).not.toHaveBeenCalled();
  });
});
