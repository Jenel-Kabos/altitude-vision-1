import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
import api from '../services/api';
import { discloseRealEstateApplicationContact } from '../services/realEstateApplicationService';

describe('projections UI candidatures et visites', () => {
  beforeEach(() => vi.clearAllMocks());

  it('utilise exclusivement la route serveur auditée pour révéler les coordonnées', async () => {
    api.get.mockResolvedValue({ data: { data: { contact: { email: 'a@example.test' } } } });
    await expect(discloseRealEstateApplicationContact('app-1', 'Qualification avant transmission')).resolves.toEqual({ contact: { email: 'a@example.test' } });
    expect(api.get).toHaveBeenCalledWith('/real-estate-applications/app-1/contact-disclosure', { params: { reason: 'Qualification avant transmission' } });
  });

  it('conditionne les liens de contact de visite au drapeau serveur', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'lib/pages/dashboard/VisitesPage.jsx'), 'utf8');
    expect(source).toContain('visite.projection?.contactDetailsVisible');
    expect(source).not.toContain('{client.email &&');
  });

  it('ne rend plus le téléphone obligatoire et ne l’injecte pas dans la conversation de visite web', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'lib/pages/PropertyDetailPage.jsx'), 'utf8');
    expect(source).not.toContain('!rdvTel.trim() || !rdvConsent');
    expect(source).not.toContain('Tél: ${rdvTel}');
  });

  it('place la divulgation protégée dans le dialogue du dossier', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'lib/pages/dashboard/RealEstateApplicationsPage.jsx'), 'utf8');
    const dialogStart = source.indexOf('role="dialog"');
    const dialogEnd = source.indexOf('</div></div>}', dialogStart);
    const protectedCard = source.indexOf('Coordonnées protégées');
    expect(dialogStart).toBeGreaterThan(-1);
    expect(protectedCard).toBeGreaterThan(dialogStart);
    expect(protectedCard).toBeLessThan(dialogEnd);
  });
});
