// LOT E — l'interface marketing ne s'ouvre qu'à un PlatformOperator actif
// détenant platform.marketing.manage, en Vue plateforme. Ni le rôle
// (Admin, CommunityManager), ni une capacité présente dans le profil
// utilisateur dérivé du rôle, ni un tenant sélectionné n'y donnent accès.
import { render, screen } from '@testing-library/react';
import MarketingDashboardPage from '../pages/dashboard/MarketingDashboardPage';
import { useAuth } from '../context/AuthContext';
import { usePlatformTenantRuntime } from '../context/PlatformTenantRuntimeContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: vi.fn() }));
vi.mock('../services/reportingService', () => ({ getDomainReport: vi.fn().mockResolvedValue({ kpis: {}, parCanal: [] }) }));
vi.mock('../services/marketingService', () => ({
  listSegments: vi.fn().mockResolvedValue([]), previewSegment: vi.fn(),
  listTemplates: vi.fn().mockResolvedValue([]), createTemplateVersion: vi.fn(), activateTemplate: vi.fn(),
  listCampaigns: vi.fn().mockResolvedValue([]), createCampaign: vi.fn(), approveCampaign: vi.fn(), cancelCampaign: vi.fn(), sendCampaign: vi.fn(),
  listSends: vi.fn().mockResolvedValue([]),
}));

const runtime = ({ operatorCan = false, mode = 'platform' } = {}) => usePlatformTenantRuntime.mockReturnValue({
  can: (capability) => operatorCan && capability === 'platform.marketing.manage',
  scope: { mode, tenantId: mode === 'tenant' ? 'TENANT-A' : null },
  tenantReady: true,
});

test.each(['Admin', 'CommunityManager'])('%s tenant sans PlatformOperator ne voit aucun contrôle marketing, même si son profil prétend la capacité', (role) => {
  useAuth.mockReturnValue({ user: { role, capabilities: ['platform.marketing.manage'] } });
  runtime({ operatorCan: false, mode: 'tenant' });
  render(<MarketingDashboardPage />);
  expect(screen.getByText('Marketing commercial non autorisé')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Campagnes/ })).not.toBeInTheDocument();
});

test('un opérateur habilité en Vue plateforme accède au tableau marketing', async () => {
  useAuth.mockReturnValue({ user: { role: 'Client', capabilities: [] } });
  runtime({ operatorCan: true, mode: 'platform' });
  render(<MarketingDashboardPage />);
  expect(screen.getByRole('button', { name: /Campagnes/ })).toBeInTheDocument();
  expect(await screen.findByText('Aucun envoi encore enregistré.')).toBeInTheDocument();
});

test.each(['tenant', 'unresolved'])('un opérateur habilité en contexte %s doit revenir en Vue plateforme', (mode) => {
  useAuth.mockReturnValue({ user: { role: 'Client', capabilities: [] } });
  runtime({ operatorCan: true, mode });
  render(<MarketingDashboardPage />);
  expect(screen.getByText('Vue plateforme requise')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Campagnes/ })).not.toBeInTheDocument();
});
