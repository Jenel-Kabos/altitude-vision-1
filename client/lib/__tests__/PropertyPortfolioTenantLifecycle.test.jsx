import { act, render, screen, waitFor } from '@testing-library/react';
import PropertyPortfolioDashboard from '../components/dashboard/propertyAsset/PropertyPortfolioDashboard';
import api, { setValidatedPlatformTenant, clearValidatedPlatformTenant } from '../services/api';
let tenant = 'tenant-A';
vi.mock('../context/PlatformTenantRuntimeContext', () => ({ usePlatformTenantRuntime: () => ({ selectedTenantId: tenant, tenantReady: true }) }));
const payload = (name) => ({ totalBiens: 1, valeurTotale: 100000, valeurParType: { [name]: 100000 }, biensVacants: 1, biensOccupes: 0 });
let adapter, previousAdapter;
beforeEach(() => {
  tenant = 'tenant-A'; setValidatedPlatformTenant(tenant);
  previousAdapter = api.defaults.adapter;
  adapter = vi.fn(async config => ({ config, status: 200, data: { data: { dashboard: payload(tenant) } }, headers: {} }));
  api.defaults.adapter = adapter;
});
afterEach(() => { api.defaults.adapter = previousAdapter; clearValidatedPlatformTenant(); });
const switchTo = (id, rerender) => { tenant = id; setValidatedPlatformTenant(id); rerender(<PropertyPortfolioDashboard status="location" />); };
test('FE-TENANT-01 real service propagates canonical tenant header', async () => {
  render(<PropertyPortfolioDashboard status="location" />);
  await screen.findByText('tenant-A');
  expect(adapter.mock.calls[0][0].headers['X-Platform-Tenant-Id']).toBe('tenant-A');
  expect(adapter.mock.calls[0][0].params).toEqual({ status: 'location' });
});
test('FE-TENANT-02 platform performs no KPI request', async () => {
  tenant = null; clearValidatedPlatformTenant();
  render(<PropertyPortfolioDashboard status="location" />);
  await act(async () => {}); expect(adapter).not.toHaveBeenCalled();
});
test('FE-TENANT-04/05/08 switch purges A immediately and reloads B without remount', async () => {
  const { rerender } = render(<PropertyPortfolioDashboard status="location" />);
  await screen.findByText('tenant-A');
  let resolveB;
  adapter.mockImplementationOnce(config => new Promise(r => { resolveB = () => r({ config, status: 200, data: { data: { dashboard: payload('tenant-B') } } }); }));
  switchTo('tenant-B', rerender);
  expect(screen.queryByText('tenant-A')).not.toBeInTheDocument();
  await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
  await act(async () => resolveB());
  expect(screen.getByText('tenant-B')).toBeInTheDocument();
  expect(adapter.mock.calls[1][0].headers['X-Platform-Tenant-Id']).toBe('tenant-B');
});
test('FE-TENANT-06 late A cannot overwrite B', async () => {
  let resolveA;
  adapter.mockImplementationOnce(config => new Promise(r => { resolveA = () => r({ config, status: 200, data: { data: { dashboard: payload('tenant-A') } } }); }));
  const { rerender } = render(<PropertyPortfolioDashboard status="location" />);
  await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
  switchTo('tenant-B', rerender);
  await screen.findByText('tenant-B');
  await act(async () => resolveA());
  expect(screen.queryByText('tenant-A')).not.toBeInTheDocument();
  expect(screen.getByText('tenant-B')).toBeInTheDocument();
});
test('FE-TENANT-07 platform purges loaded KPI and makes no request', async () => {
  const { rerender } = render(<PropertyPortfolioDashboard status="location" />);
  await screen.findByText('tenant-A');
  switchTo(null, rerender);
  expect(screen.queryByText('tenant-A')).not.toBeInTheDocument();
  await act(async () => {}); expect(adapter).toHaveBeenCalledTimes(1);
});
