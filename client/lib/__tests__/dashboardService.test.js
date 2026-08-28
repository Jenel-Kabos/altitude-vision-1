// HOTFIX-ADMIN-DASHBOARD-RENTAL-KPI-CONTRACT-1 — preuve que le widget
// "Contrats actifs" du dashboard Admin consomme désormais le champ réel
// fourni par le backend (`data.stats.RentalActiveContracts`), pas un champ
// (`data.kpis.gestionLocative.contratsActifs`) qui n'a jamais existé dans la
// réponse réelle de GET /api/dashboard/stats.
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

describe('dashboardService — getDashboardStats', () => {
  test('contratsActifs lit le KPI réel fourni par le backend (data.stats.RentalActiveContracts)', async () => {
    api.get.mockResolvedValue({ data: { data: { stats: { Altimmo: 2, RentalActiveContracts: 3 } } } });
    const { getDashboardStats } = await import('../services/dashboardService');

    const result = await getDashboardStats();

    expect(result.contratsActifs).toBe(3);
  });

  test('contratsActifs vaut 0 (pas undefined/NaN) quand aucun contrat locatif actif', async () => {
    api.get.mockResolvedValue({ data: { data: { stats: { Altimmo: 0, RentalActiveContracts: 0 } } } });
    const { getDashboardStats } = await import('../services/dashboardService');

    const result = await getDashboardStats();

    expect(result.contratsActifs).toBe(0);
    expect(Number.isNaN(result.contratsActifs)).toBe(false);
  });

  test('contratsActifs retombe sur 0 si le champ est absent de la réponse (robustesse)', async () => {
    api.get.mockResolvedValue({ data: { data: { stats: { Altimmo: 0 } } } });
    const { getDashboardStats } = await import('../services/dashboardService');

    const result = await getDashboardStats();

    expect(result.contratsActifs).toBe(0);
  });
});
