// USER-ARCH-1 — profils métiers : machine d'octroi/suspension/révocation
// (même convention que hotelStaffAssignmentService.js), dérivation en
// lecture seule depuis les données existantes, et couche HTTP/RBAC.
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const Locataire = require('../models/Locataire');
const UserBusinessProfile = require('../models/UserBusinessProfile');
const {
  grantProfile, suspendProfile, revokeProfile, getActiveProfiles, hasProfile,
  deriveProfilesFromExistingData, getEffectiveProfiles, BusinessProfileError,
  getBulkDerivedProfileUserIds, listAllProfiles,
} = require('../services/userBusinessProfileService');
const userBusinessProfileRoutes = require('../routes/userBusinessProfileRoutes');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(120000);

const app = express();
app.use(express.json());
app.use('/api/user-business-profiles', userBusinessProfileRoutes);
app.use(errorHandler);

const signToken = (userId, tokenVersion = 0) => jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1d' });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `userarch${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('userBusinessProfileService — octroi/suspension/révocation', () => {
  test('grantProfile crée un profil actif, jamais un doublon au second appel', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser({ role: 'Proprietaire' });
    const profile = await grantProfile({ userId: target._id, profileType: 'exploitant_etablissement', actor: admin });
    expect(profile.status).toBe('active');

    const again = await grantProfile({ userId: target._id, profileType: 'exploitant_etablissement', actor: admin });
    expect(String(again._id)).toBe(String(profile._id)); // no-op, jamais un doublon
    expect(await UserBusinessProfile.countDocuments({ user: target._id, profileType: 'exploitant_etablissement' })).toBe(1);
  });

  test('un profil rejette un profileType inconnu (422)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await expect(grantProfile({ userId: target._id, profileType: 'inconnu', actor: admin })).rejects.toMatchObject({ statusCode: 422 });
  });

  test('suspendProfile puis revokeProfile changent le statut, jamais de suppression du document', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await grantProfile({ userId: target._id, profileType: 'client', actor: admin });

    const suspended = await suspendProfile({ userId: target._id, profileType: 'client', actor: admin, reason: 'Vérification en cours' });
    expect(suspended.status).toBe('suspended');
    expect(await hasProfile(target._id, 'client')).toBe(false);

    const revoked = await revokeProfile({ userId: target._id, profileType: 'client', actor: admin, reason: 'Compte clôturé' });
    expect(revoked.status).toBe('revoked');
    expect(await UserBusinessProfile.countDocuments({ user: target._id })).toBe(1); // jamais supprimé, juste révoqué
  });

  test('grantProfile réactive un profil révoqué plutôt que d\'en créer un second', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await grantProfile({ userId: target._id, profileType: 'locataire', actor: admin });
    await revokeProfile({ userId: target._id, profileType: 'locataire', actor: admin, reason: 'test' });
    const reactivated = await grantProfile({ userId: target._id, profileType: 'locataire', actor: admin });
    expect(reactivated.status).toBe('active');
    expect(await UserBusinessProfile.countDocuments({ user: target._id, profileType: 'locataire' })).toBe(1);
  });

  test('suspendProfile échoue proprement si aucun profil actif n\'existe', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await expect(suspendProfile({ userId: target._id, profileType: 'locataire', actor: admin })).rejects.toBeInstanceOf(BusinessProfileError);
  });
});

describe('deriveProfilesFromExistingData / getEffectiveProfiles — rétrocompatibilité (Phase 4)', () => {
  test('un propriétaire immobilier réel (Property.owner, vente/location) est dérivé sans aucun profil stocké', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await Property.create({
      title: 'Villa Immo USER-ARCH-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Disponible', owner: owner._id,
    });
    const derived = await deriveProfilesFromExistingData(owner._id);
    expect(derived).toContain('proprietaire_immobilier');
    expect(derived).not.toContain('exploitant_etablissement');
    expect(await UserBusinessProfile.countDocuments({ user: owner._id })).toBe(0); // rien stocké, purement dérivé
    expect(await getEffectiveProfiles(owner._id)).toEqual(expect.arrayContaining(['proprietaire_immobilier']));
  });

  test('un exploitant (bien hébergement OU manager d\'hôtel) est dérivé en exploitant_etablissement, jamais proprietaire_immobilier', async () => {
    const exploitant = await makeUser({ role: 'Proprietaire' });
    await Property.create({
      title: 'Villa Hébergement USER-ARCH-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 100000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Disponible', owner: exploitant._id,
    });
    const derived = await deriveProfilesFromExistingData(exploitant._id);
    expect(derived).toEqual(['exploitant_etablissement']);
  });

  test('un utilisateur peut cumuler les deux profils (Jean : propriétaire immobilier ET exploitant)', async () => {
    const jean = await makeUser({ role: 'Proprietaire' });
    await Property.create({
      title: 'Villa Vente Jean', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Disponible', owner: jean._id,
    });
    const admin = await makeUser({ role: 'Admin' });
    await Hotel.create({ name: 'Hotel Jean', manager: jean._id, createdBy: admin._id });

    const derived = await deriveProfilesFromExistingData(jean._id);
    expect(derived).toEqual(expect.arrayContaining(['proprietaire_immobilier', 'exploitant_etablissement']));
    expect(derived).toHaveLength(2);
  });

  // USER-ARCH-UX-1 (Phase 2) — la variante BULK doit produire EXACTEMENT
  // les mêmes ensembles que la dérivation par utilisateur, seule utilisée
  // par crmService.loadIdentitySources pour éviter de dupliquer la règle.
  test('getBulkDerivedProfileUserIds() est cohérent avec deriveProfilesFromExistingData() par utilisateur', async () => {
    const jean = await makeUser({ role: 'Proprietaire' });
    await Property.create({
      title: 'Villa Vente Jean Bulk', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'vente', price: 50000000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Disponible', owner: jean._id,
    });
    const admin = await makeUser({ role: 'Admin' });
    await Hotel.create({ name: 'Hotel Jean Bulk', manager: jean._id, createdBy: admin._id });

    const sets = await getBulkDerivedProfileUserIds();
    expect(sets.proprietaire_immobilier.has(String(jean._id))).toBe(true);
    expect(sets.exploitant_etablissement.has(String(jean._id))).toBe(true);
  });

  test('un locataire lié (Locataire.user) est dérivé en profil locataire', async () => {
    const tenantUser = await makeUser({ role: 'Client' });
    await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011', user: tenantUser._id });
    expect(await deriveProfilesFromExistingData(tenantUser._id)).toEqual(['locataire']);
  });

  test('getEffectiveProfiles fusionne les profils stockés et dérivés sans doublon', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const user = await makeUser({ role: 'Proprietaire' });
    await grantProfile({ userId: user._id, profileType: 'client', actor: admin }); // stocké manuellement
    await Property.create({
      title: 'Villa Fusion', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Disponible', owner: user._id,
    }); // dérivable
    const effective = await getEffectiveProfiles(user._id);
    expect(effective).toEqual(expect.arrayContaining(['client', 'proprietaire_immobilier']));
    expect(new Set(effective).size).toBe(effective.length); // aucun doublon
  });
});

describe('HTTP /api/user-business-profiles — RBAC', () => {
  test('401 sans authentification', async () => {
    const target = await makeUser();
    const res = await request(app).get(`/api/user-business-profiles/${target._id}`);
    expect(res.status).toBe(401);
  });

  test('un tiers non-staff ne peut pas consulter le profil d\'un autre utilisateur (403)', async () => {
    const target = await makeUser();
    const stranger = await makeUser();
    const res = await request(app).get(`/api/user-business-profiles/${target._id}`).set('Authorization', `Bearer ${signToken(stranger._id)}`);
    expect(res.status).toBe(403);
  });

  test('un utilisateur peut consulter ses propres profils', async () => {
    const target = await makeUser();
    const res = await request(app).get(`/api/user-business-profiles/${target._id}`).set('Authorization', `Bearer ${signToken(target._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toEqual([]);
  });

  test('seul un Admin peut accorder un profil (403 pour un Secretaire)', async () => {
    const secretaire = await makeUser({ role: 'Secretaire' });
    const target = await makeUser();
    const res = await request(app).post(`/api/user-business-profiles/${target._id}`).set('Authorization', `Bearer ${signToken(secretaire._id)}`).send({ profileType: 'client' });
    expect(res.status).toBe(403);
  });

  test('un tiers non-staff ne peut pas consulter l\'historique complet (403)', async () => {
    const target = await makeUser();
    const stranger = await makeUser();
    const res = await request(app).get(`/api/user-business-profiles/${target._id}/history`).set('Authorization', `Bearer ${signToken(stranger._id)}`);
    expect(res.status).toBe(403);
  });

  // USER-ARCH-UX-1 (Phase 7) — l'historique staff doit inclure les statuts
  // suspendu/révoqué (contrairement à `list`, qui ne renvoie que l'effectif),
  // nécessaire pour permettre une réactivation depuis l'écran d'administration.
  test('le staff consulte l\'historique complet (actif/suspendu/révoqué) via /history', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const secretaire = await makeUser({ role: 'Secretaire' });
    const target = await makeUser();
    await grantProfile({ userId: target._id, profileType: 'client', actor: admin });
    await suspendProfile({ userId: target._id, profileType: 'client', actor: admin, reason: 'Test historique' });

    const res = await request(app).get(`/api/user-business-profiles/${target._id}/history`).set('Authorization', `Bearer ${signToken(secretaire._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profiles).toHaveLength(1);
    expect(res.body.data.profiles[0].status).toBe('suspended');

    const all = await listAllProfiles(target._id);
    expect(all).toHaveLength(1);
  });

  test('un Admin peut accorder, suspendre puis révoquer un profil via l\'API', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    const grantRes = await request(app).post(`/api/user-business-profiles/${target._id}`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ profileType: 'proprietaire_immobilier' });
    expect(grantRes.status).toBe(201);

    const suspendRes = await request(app).post(`/api/user-business-profiles/${target._id}/proprietaire_immobilier/suspend`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ reason: 'Test' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.profile.status).toBe('suspended');

    const revokeRes = await request(app).post(`/api/user-business-profiles/${target._id}/proprietaire_immobilier/revoke`).set('Authorization', `Bearer ${signToken(admin._id)}`).send({ reason: 'Test' });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.profile.status).toBe('revoked');
  });
});
