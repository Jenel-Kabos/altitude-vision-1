import { CAPABILITIES_BY_ROLE, hasStaffCapability } from '../staffCapabilities';

// SYNC-2A — cette table doit rester identique à
// server/utils/iamArchitecture.js (DEFAULT_CAPABILITIES) et
// client/lib/utils/staffCapabilities.js. Ce test fige les valeurs connues
// au moment du sprint ; toute divergence future doit être un choix explicite
// (mise à jour des trois copies), jamais un oubli silencieux.
const EXPECTED = {
  Admin: ['*'],
  Collaborateur: ['legacy.full'],
  Secretaire: ['documents.read', 'documents.manage', 'payments.read', 'payments.manage', 'clients.read', 'owners.read', 'tenants.read', 'leases.read', 'properties.read'],
  GestionnaireImmobilier: ['properties.read', 'properties.create', 'properties.update', 'owners.read', 'tenants.read', 'tenants.manage', 'visits.read', 'visits.manage', 'rental.read', 'rental.manage', 'leases.read', 'leases.manage', 'maintenance.read', 'maintenance.manage', 'notice.read', 'notice.manage', 'occupancy.read', 'occupancy.manage', 'payment.status'],
  CommunityManager: ['altcom.read', 'altcom.manage', 'events.read', 'events.manage', 'media.read', 'media.manage'],
  Communicant: ['messages.read', 'messages.manage', 'visits.read'],
};

describe('CAPABILITIES_BY_ROLE', () => {
  test('reste identique à la projection IAM-3 backend/web connue', () => {
    expect(CAPABILITIES_BY_ROLE).toEqual(EXPECTED);
  });
});

describe('hasStaffCapability', () => {
  test('Admin possède toute capability via le wildcard', () => {
    expect(hasStaffCapability({ role: 'Admin' }, 'documents.manage')).toBe(true);
    expect(hasStaffCapability({ role: 'Admin' }, "n'importe.quoi")).toBe(true);
  });

  test('Collaborateur legacy possède toute capability', () => {
    expect(hasStaffCapability({ role: 'Collaborateur' }, 'payments.manage')).toBe(true);
  });

  test('Secretaire ne possède PAS la gestion locative (IAM-3 P1 déjà corrigé côté backend)', () => {
    expect(hasStaffCapability({ role: 'Secretaire' }, 'rental.manage')).toBe(false);
    expect(hasStaffCapability({ role: 'Secretaire' }, 'documents.manage')).toBe(true);
  });

  test('GestionnaireImmobilier ne possède PAS la gestion documentaire générale ni les paiements', () => {
    expect(hasStaffCapability({ role: 'GestionnaireImmobilier' }, 'documents.manage')).toBe(false);
    expect(hasStaffCapability({ role: 'GestionnaireImmobilier' }, 'payments.manage')).toBe(false);
    expect(hasStaffCapability({ role: 'GestionnaireImmobilier' }, 'rental.manage')).toBe(true);
  });

  test('CommunityManager ne possède aucune capability immobilière/GL/paiement', () => {
    expect(hasStaffCapability({ role: 'CommunityManager' }, 'rental.manage')).toBe(false);
    expect(hasStaffCapability({ role: 'CommunityManager' }, 'documents.manage')).toBe(false);
    expect(hasStaffCapability({ role: 'CommunityManager' }, 'altcom.manage')).toBe(true);
  });

  test('un rôle sans staff spécialisé (Client, Proprietaire) ne possède aucune capability staff', () => {
    expect(hasStaffCapability({ role: 'Client' }, 'documents.read')).toBe(false);
    expect(hasStaffCapability({ role: 'Proprietaire' }, 'properties.read')).toBe(false);
  });

  test('un utilisateur absent/rôle inconnu ne plante jamais et ne possède rien', () => {
    expect(hasStaffCapability(null, 'documents.read')).toBe(false);
    expect(hasStaffCapability({ role: 'RoleInconnu' }, 'documents.read')).toBe(false);
  });
});
