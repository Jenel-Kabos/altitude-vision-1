import { describe, expect, test } from 'vitest';
import { hasStaffCapability } from '../utils/staffCapabilities';

describe('IAM-3 — projection navigation staff', () => {
  test('Secrétaire voit documents/paiements mais pas GL', () => {
    expect(hasStaffCapability({ role: 'Secretaire' }, 'documents.read')).toBe(true);
    expect(hasStaffCapability({ role: 'Secretaire' }, 'payments.read')).toBe(true);
    expect(hasStaffCapability({ role: 'Secretaire' }, 'rental.read')).toBe(false);
  });
  test('Gestionnaire voit GL mais pas documents généraux', () => {
    expect(hasStaffCapability({ role: 'GestionnaireImmobilier' }, 'rental.manage')).toBe(true);
    expect(hasStaffCapability({ role: 'GestionnaireImmobilier' }, 'documents.read')).toBe(false);
  });
  test('Community Manager voit communication uniquement', () => {
    expect(hasStaffCapability({ role: 'CommunityManager' }, 'events.manage')).toBe(true);
    expect(hasStaffCapability({ role: 'CommunityManager' }, 'maintenance.manage')).toBe(false);
  });
  test('Admin et Collaborateur legacy restent complets', () => {
    expect(hasStaffCapability({ role: 'Admin' }, 'anything.manage')).toBe(true);
    expect(hasStaffCapability({ role: 'Collaborateur' }, 'anything.manage')).toBe(true);
  });
});
