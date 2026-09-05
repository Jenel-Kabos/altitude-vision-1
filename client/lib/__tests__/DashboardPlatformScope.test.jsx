import { render, screen, waitFor } from '@testing-library/react';
import DashboardLayout from '../../app/dashboard/layout';
import { useAuth } from '../context/AuthContext';

let pathname = '/dashboard/activations-professionnelles';
let authUser = { _id: 'operator-1', role: 'Admin' };
let capabilities = ['platform.tenant_applications.read'];
let runtime = {
  tenantLoading: false,
  tenantRequired: true,
  selectedTenantId: null,
};
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authUser,
    loading: false,
    can: (capability) => capabilities.includes(capability),
  }),
}));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({
  usePlatformTenantRuntime: () => runtime,
}));
vi.mock('../pages/dashboard/AdminDashboard', () => ({
  default: ({ children }) => <div data-testid="dashboard-shell">{children}</div>,
}));

function ActivationContent() {
  const { can } = useAuth();
  return can('platform.tenant_applications.read')
    ? <p>Demandes d’activation professionnelle</p>
    : <p>Accès non autorisé</p>;
}

describe('DashboardLayout — portée plateforme des activations professionnelles', () => {
  beforeEach(() => {
    pathname = '/dashboard/activations-professionnelles';
    authUser = { _id: 'operator-1', role: 'Admin' };
    capabilities = ['platform.tenant_applications.read'];
    runtime = { tenantLoading: false, tenantRequired: true, selectedTenantId: null };
    replace.mockClear();
  });

  test('un PlatformOperator autorisé rend la page en vue plateforme sans tenant sélectionné', () => {
    render(<DashboardLayout><ActivationContent /></DashboardLayout>);
    expect(screen.getByText('Demandes d’activation professionnelle')).toBeInTheDocument();
    expect(screen.queryByText('Sélectionnez un tenant à administrer')).not.toBeInTheDocument();
  });

  test('la route reste plateforme lorsqu’un tenant est sélectionné', () => {
    runtime = { ...runtime, selectedTenantId: 'tenant-1' };
    render(<DashboardLayout><ActivationContent /></DashboardLayout>);
    expect(screen.getByText('Demandes d’activation professionnelle')).toBeInTheDocument();
  });

  test('la modération hôtellerie est également accessible en vue plateforme', () => {
    pathname = '/dashboard/moderation/hotellerie';
    render(<DashboardLayout><p>Modération Hôtellerie</p></DashboardLayout>);
    expect(screen.getByText('Modération Hôtellerie')).toBeInTheDocument();
    expect(screen.queryByText('Sélectionnez un tenant à administrer')).not.toBeInTheDocument();
  });

  test('un opérateur sans capacité reste bloqué', () => {
    capabilities = [];
    render(<DashboardLayout><ActivationContent /></DashboardLayout>);
    expect(screen.getByText('Accès non autorisé')).toBeInTheDocument();
    expect(screen.queryByText('Demandes d’activation professionnelle')).not.toBeInTheDocument();
  });

  test('un Tenant Admin sans autorité plateforme reste bloqué', () => {
    capabilities = [];
    runtime = { tenantLoading: false, tenantRequired: false, selectedTenantId: null };
    render(<DashboardLayout><ActivationContent /></DashboardLayout>);
    expect(screen.getByText('Accès non autorisé')).toBeInTheDocument();
  });

  test('un utilisateur non authentifié est renvoyé vers la connexion', async () => {
    authUser = null;
    runtime = { tenantLoading: false, tenantRequired: false, selectedTenantId: null };
    const { container } = render(<DashboardLayout><ActivationContent /></DashboardLayout>);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  test('une route tenant-scoped exige toujours un tenant', () => {
    pathname = '/dashboard/etablissements';
    render(<DashboardLayout><p>Gestion des établissements</p></DashboardLayout>);
    expect(screen.getByText('Sélectionnez un tenant à administrer')).toBeInTheDocument();
    expect(screen.queryByText('Gestion des établissements')).not.toBeInTheDocument();
  });

  test('une route tenant-scoped rend son contenu avec un tenant validé', () => {
    pathname = '/dashboard/etablissements';
    runtime = { ...runtime, selectedTenantId: 'tenant-1' };
    render(<DashboardLayout><p>Gestion des établissements</p></DashboardLayout>);
    expect(screen.getByText('Gestion des établissements')).toBeInTheDocument();
  });
});
