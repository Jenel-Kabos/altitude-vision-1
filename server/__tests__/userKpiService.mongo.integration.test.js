// USER-KPI-1 — service central des KPI utilisateurs : vérifie que chaque
// scénario métier (immobilier seul, exploitant seul, multi-profils, compte
// legacy dérivé sans profil stocké, profil suspendu, profil révoqué) produit
// un résultat cohérent SANS jamais recalculer la dérivation ailleurs.
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const Locataire = require('../models/Locataire');
const UserBusinessProfile = require('../models/UserBusinessProfile');
const { grantProfile, suspendProfile, revokeProfile } = require('../services/userBusinessProfileService');
const {
  getUserKpiSummary, getEffectiveProfileUserIdSets, countActiveUsers, getProprietaireUserIds,
} = require('../services/userKpiService');

jest.setTimeout(120000);

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `userkpi${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

const makeLocationProperty = (owner) => Property.create({
  title: 'Villa USER-KPI-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
  pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
  address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
  images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
  statusAdmin: 'Validée', availability: 'Disponible', owner,
});

describe('userKpiService — définitions officielles (Phase 2/5)', () => {
  test('un propriétaire immobilier seul (Property.owner, dérivé) est compté dans proprietairesImmobiliers et comptesLegacy', async () => {
    const owner = await makeUser({ role: 'Proprietaire' });
    await makeLocationProperty(owner._id);

    const kpis = await getUserKpiSummary();
    expect(kpis.proprietairesImmobiliers).toBe(1);
    expect(kpis.exploitantsEtablissement).toBe(0);
    expect(kpis.multiProfils).toBe(0);
    expect(kpis.comptesLegacy).toBe(1); // dérivé mais jamais accordé explicitement
    expect(kpis.proprietaires).toBe(1); // union
  });

  test('un exploitant seul (Hotel.manager) est compté dans exploitantsEtablissement, pas dans proprietairesImmobiliers', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const manager = await makeUser({ role: 'Proprietaire' });
    await Hotel.create({ name: 'Hotel USER-KPI-1', manager: manager._id, createdBy: admin._id });

    const kpis = await getUserKpiSummary();
    expect(kpis.exploitantsEtablissement).toBe(1);
    expect(kpis.proprietairesImmobiliers).toBe(0);
    expect(kpis.proprietaires).toBe(1);
  });

  test('un utilisateur multi-profils (immobilier ET exploitant) est compté une seule fois dans proprietaires, mais dans multiProfils', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const jean = await makeUser({ role: 'Proprietaire' });
    await makeLocationProperty(jean._id);
    await Hotel.create({ name: 'Hotel Jean USER-KPI-1', manager: jean._id, createdBy: admin._id });

    const kpis = await getUserKpiSummary();
    expect(kpis.proprietairesImmobiliers).toBe(1);
    expect(kpis.exploitantsEtablissement).toBe(1);
    expect(kpis.multiProfils).toBe(1);
    expect(kpis.proprietaires).toBe(1); // union, pas 2 — jamais compté deux fois
  });

  test('un profil explicitement accordé (stocké actif) compte, mais ne fait PAS partie des comptesLegacy', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await grantProfile({ userId: target._id, profileType: 'proprietaire_immobilier', actor: admin });

    const kpis = await getUserKpiSummary();
    expect(kpis.proprietairesImmobiliers).toBe(1);
    expect(kpis.comptesLegacy).toBe(0); // profil stocké, donc pas "legacy jamais synchronisé"
  });

  test('un profil suspendu SANS donnée dérivable sous-jacente est exclu de tous les KPI', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await grantProfile({ userId: target._id, profileType: 'proprietaire_immobilier', actor: admin });
    await suspendProfile({ userId: target._id, profileType: 'proprietaire_immobilier', actor: admin, reason: 'Test' });

    const kpis = await getUserKpiSummary();
    expect(kpis.proprietairesImmobiliers).toBe(0);
    expect(kpis.proprietaires).toBe(0);
  });

  test('un profil suspendu MAIS toujours dérivable (Property.owner réel) reste compté via la dérivation', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser({ role: 'Proprietaire' });
    await makeLocationProperty(target._id);
    await grantProfile({ userId: target._id, profileType: 'proprietaire_immobilier', actor: admin });
    await suspendProfile({ userId: target._id, profileType: 'proprietaire_immobilier', actor: admin, reason: 'Test' });

    const kpis = await getUserKpiSummary();
    // La suspension administrative ne masque jamais un fait réel toujours vrai
    // (l'utilisateur possède toujours le bien) — comportement identique à
    // getEffectiveProfiles() pour un seul utilisateur.
    expect(kpis.proprietairesImmobiliers).toBe(1);
  });

  test('un profil révoqué sans donnée dérivable est exclu', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const target = await makeUser();
    await grantProfile({ userId: target._id, profileType: 'exploitant_etablissement', actor: admin });
    await revokeProfile({ userId: target._id, profileType: 'exploitant_etablissement', actor: admin, reason: 'Test' });

    const kpis = await getUserKpiSummary();
    expect(kpis.exploitantsEtablissement).toBe(0);
    expect(await UserBusinessProfile.countDocuments({ user: target._id })).toBe(1); // jamais supprimé
  });

  test('un locataire lié (Locataire.user) est compté dans locataires', async () => {
    const tenantUser = await makeUser({ role: 'Client' });
    await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000099', user: tenantUser._id });

    const kpis = await getUserKpiSummary();
    expect(kpis.locataires).toBe(1);
  });

  test('countActiveUsers exclut les comptes suspendus/bannis/supprimés et les comptes techniques', async () => {
    await makeUser({ status: 'Actif', isActive: true });
    await makeUser({ status: 'Suspendu', isActive: true });
    await makeUser({ status: 'Actif', isActive: false });
    await makeUser({ status: 'Actif', isActive: true, isTechnical: true });

    expect(await countActiveUsers()).toBe(1);
  });

  test('getProprietaireUserIds() renvoie exactement les mêmes identifiants que la taille de proprietaires', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const jean = await makeUser({ role: 'Proprietaire' });
    await makeLocationProperty(jean._id);
    await Hotel.create({ name: 'Hotel Jean IDs', manager: jean._id, createdBy: admin._id });
    const other = await makeUser({ role: 'Proprietaire' });
    await makeLocationProperty(other._id);

    const [kpis, ids] = await Promise.all([getUserKpiSummary(), getProprietaireUserIds()]);
    expect(ids).toHaveLength(kpis.proprietaires);
    expect(ids.map(String)).toEqual(expect.arrayContaining([String(jean._id), String(other._id)]));
  });

  test('getEffectiveProfileUserIdSets() ne déclenche aucune requête par utilisateur (source unique, agrégée)', async () => {
    // Garantit qu'aucune boucle de dérivation n'est réintroduite : le nombre
    // d'appels réseau ne doit pas croître avec le nombre d'utilisateurs.
    const admin = await makeUser({ role: 'Admin' });
    for (let i = 0; i < 5; i += 1) {
      const owner = await makeUser({ role: 'Proprietaire' });
      await makeLocationProperty(owner._id);
    }
    const spy = jest.spyOn(Property, 'find');
    await getEffectiveProfileUserIdSets();
    // deriveProfilesFromExistingData n'est jamais appelée en boucle : seule
    // la variante bulk (2 requêtes Property.find max, une par statut) doit
    // s'exécuter, quel que soit le nombre d'utilisateurs audités.
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
    spy.mockRestore();
    void admin;
  });
});
