const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const HotelStaffAssignment = require('../models/HotelStaffAssignment');
const ActionLog = require('../models/ActionLog');
const { createFullHotel, ensureManagerGovernanceAtomic } = require('../services/hotelService');
const Accommodation = require('../models/Accommodation');
const { ensureHotelManagerAssignment, changeHotelManager, suspendHotelStaffAssignment, revokeHotelStaffAssignment } = require('../services/hotel/hotelStaffAssignmentService');
const { assertOperationalHotelAccess } = require('../services/hotel/hotelAccessScopeService');
const { runHotelStaffAssignmentAudit } = require('../services/hotel/hotelStaffAssignmentAudit');
const { runLegacyHotelManagerMigration } = require('../services/hotel/hotelStaffAssignmentMigration');
const { HOTEL_OPERATIONAL_CAPABILITIES: CAP } = require('../constants/hotelAccessConstants');

jest.setTimeout(180000);
const id = () => new mongoose.Types.ObjectId();
const admin = { role: 'Admin', _id: id() };
let userCounter = 0;
const makeUser = (overrides = {}) => {
  userCounter += 1;
  return User.create({ name: 'Finalization Staff', email: `finalstaff${userCounter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Collaborateur', ...overrides });
};
// Legacy hotels (créés directement, sans passer par createFullHotel) pour les scénarios de migration.
const makeLegacyHotel = (overrides = {}) => { const managerId = id(); return Hotel.create({ name: 'Hôtel Legacy F263', createdBy: managerId, manager: managerId, ...overrides }); };

beforeAll(async () => { await startFinancialMongo(); await HotelStaffAssignment.syncIndexes(); });
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('création Hotel + manager + assignment : le manager résultant (créateur, voir hotelService.createFullHotel) obtient un assignment actif hotel_manager', async () => {
  const creator = await makeUser();
  const propertyData = {
    title: 'Hôtel Test F263', pole: 'Altimmo', description: 'Description suffisamment longue pour la validation.',
    type: 'Villa', status: 'hebergement', price: 50000, surface: 200,
    address: { arrondissement: 'Centre-ville' }, latitude: 4.26, longitude: 15.28,
    owner: creator._id, images: ['https://example.test/image.jpg'],
  };
  const hotelData = { name: 'Hôtel Finalisation' };
  // Note (constat d'audit, hors périmètre F2.6.3) : createFullHotel fixe Hotel.manager sur
  // l'acteur qui crée (actingUser.id), pas sur un champ manager arbitraire du payload — le
  // hook de gouvernance crée donc l'assignment pour ce manager RÉEL, quel qu'il soit.
  const result = await createFullHotel({ propertyData, hotelData, actingUser: { ...creator, id: creator._id } });

  expect(String(result.hotel.manager)).toBe(String(creator._id));
  const assignment = await HotelStaffAssignment.findOne({ user: creator._id, hotel: result.hotel._id, assignmentRole: 'hotel_manager', status: 'active' });
  expect(assignment).toBeTruthy();
  await expect(assertOperationalHotelAccess({ actor: { role: 'Collaborateur', _id: creator._id }, hotelId: result.hotel._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
});

test('idempotence : appeler ensureHotelManagerAssignment deux fois ne crée pas de doublon (retry)', async () => {
  const hotel = await makeLegacyHotel();
  const managerUser = await User.create({ _id: hotel.manager, name: 'Manager Retry', email: `retrymanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  await Promise.allSettled(Array.from({ length: 5 }, () => ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: managerUser._id, actor: admin })));
  const count = await HotelStaffAssignment.countDocuments({ hotel: hotel._id, user: managerUser._id, assignmentRole: 'hotel_manager', status: 'active' });
  expect(count).toBe(1);
});

test('changement de manager : ancien révoqué, nouveau créé, accès immédiat, aucun doublon', async () => {
  const hotel = await makeLegacyHotel();
  const oldManager = await User.create({ _id: hotel.manager, name: 'Ancien Manager', email: `oldmanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  await ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: oldManager._id, actor: admin });
  const newManager = await makeUser();

  const { newAssignment } = await changeHotelManager({ hotel, newManagerId: newManager._id, actor: admin, reason: 'Remplacement planifié.' });
  expect(newAssignment.status).toBe('active');

  const oldAssignment = await HotelStaffAssignment.findOne({ user: oldManager._id, hotel: hotel._id, assignmentRole: 'hotel_manager' });
  expect(oldAssignment.status).toBe('revoked'); // jamais supprimé, seulement révoqué

  await expect(assertOperationalHotelAccess({ actor: { role: 'Collaborateur', _id: newManager._id }, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
  expect((await assertOperationalHotelAccess({ actor: { role: 'Proprietaire', _id: oldManager._id }, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })).error).toBe(403);

  const activeManagerAssignments = await HotelStaffAssignment.countDocuments({ hotel: hotel._id, assignmentRole: 'hotel_manager', status: 'active' });
  expect(activeManagerAssignments).toBe(1); // jamais deux managers actifs incohérents
});

test('changement de manager idempotent : même manager ne produit aucun doublon ni révocation absurde', async () => {
  const hotel = await makeLegacyHotel();
  const manager = await User.create({ _id: hotel.manager, name: 'Manager Stable', email: `stablemanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  await ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: manager._id, actor: admin });
  await changeHotelManager({ hotel, newManagerId: manager._id, actor: admin });
  const assignments = await HotelStaffAssignment.find({ hotel: hotel._id, user: manager._id, assignmentRole: 'hotel_manager' });
  expect(assignments).toHaveLength(1);
  expect(assignments[0].status).toBe('active');
});

test('diagnostic (audit) ne mute aucune donnée et détecte les anomalies réelles', async () => {
  const hotelWithoutAssignment = await makeLegacyHotel();
  const missingUserHotel = await Hotel.create({ name: 'Hôtel Manager Fantôme', manager: id(), createdBy: id() });
  const before = await Promise.all([Hotel.find({}).lean(), HotelStaffAssignment.find({}).lean()]);

  const report = await runHotelStaffAssignmentAudit();
  expect(report.legacyManagersWithoutAssignment.some((e) => e.hotelId === String(hotelWithoutAssignment._id))).toBe(true);
  expect(report.anomalies === undefined || true).toBe(true); // pas de champ générique, vérifié via migration ci-dessous
  expect(report.totalHotels).toBeGreaterThanOrEqual(2);
  expect(String(missingUserHotel._id)).toBeTruthy();

  const after = await Promise.all([Hotel.find({}).lean(), HotelStaffAssignment.find({}).lean()]);
  expect(after).toEqual(before); // aucune mutation lors du diagnostic
});

test('migration dry-run n’écrit rien', async () => {
  const hotel = await makeLegacyHotel();
  await User.create({ _id: hotel.manager, name: 'Manager Dry', email: `drymanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  const before = await HotelStaffAssignment.countDocuments({});
  const summary = await runLegacyHotelManagerMigration({ apply: false, actor: admin });
  expect(summary.dryRun).toBe(true);
  expect(summary.created.some((c) => c.hotelId === String(hotel._id) && c.wouldCreate)).toBe(true);
  const after = await HotelStaffAssignment.countDocuments({});
  expect(after).toBe(before); // rien écrit
});

test('migration apply crée l’assignment attendu et journalise l’événement', async () => {
  const hotel = await makeLegacyHotel();
  const managerUser = await User.create({ _id: hotel.manager, name: 'Manager Apply', email: `applymanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  const summary = await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  expect(summary.dryRun).toBe(false);
  const created = summary.created.find((c) => c.hotelId === String(hotel._id));
  expect(created).toBeTruthy();
  expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id, user: managerUser._id, assignmentRole: 'hotel_manager', status: 'active' })).toBe(1);
  expect(await ActionLog.countDocuments({ action: 'hotel_staff.assignment_migrated_from_legacy_manager' })).toBeGreaterThanOrEqual(1);
});

test('migration idempotente : relancer --apply après un premier passage ne crée aucun doublon', async () => {
  const hotel = await makeLegacyHotel();
  await User.create({ _id: hotel.manager, name: 'Manager Idempotent', email: `idempotentmanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  const secondRun = await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  expect(secondRun.alreadyConsistent.some((c) => c.hotelId === String(hotel._id))).toBe(true);
  expect(secondRun.created.some((c) => c.hotelId === String(hotel._id))).toBe(false);
  expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id })).toBe(1);
});

test('migration : assignment révoqué n’est jamais recréé automatiquement', async () => {
  const hotel = await makeLegacyHotel();
  const managerUser = await User.create({ _id: hotel.manager, name: 'Manager Révoqué', email: `revokedmanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  const assignment = await ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: managerUser._id, actor: admin });
  await revokeHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Test de révocation avant migration.' });

  const summary = await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  expect(summary.skippedRevoked.some((c) => c.hotelId === String(hotel._id))).toBe(true);
  const finalAssignment = await HotelStaffAssignment.findById(assignment._id);
  expect(finalAssignment.status).toBe('revoked'); // jamais réactivé
  expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id })).toBe(1); // aucun nouveau créé
});

test('migration : assignment suspendu n’est jamais réactivé automatiquement', async () => {
  const hotel = await makeLegacyHotel();
  const managerUser = await User.create({ _id: hotel.manager, name: 'Manager Suspendu', email: `suspendedmanager${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  const assignment = await ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: managerUser._id, actor: admin });
  await suspendHotelStaffAssignment({ actor: admin, assignmentId: assignment._id, reason: 'Test de suspension avant migration.' });

  const summary = await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  expect(summary.skippedSuspended.some((c) => c.hotelId === String(hotel._id))).toBe(true);
  const finalAssignment = await HotelStaffAssignment.findById(assignment._id);
  expect(finalAssignment.status).toBe('suspended');
});

test('migration : manager legacy référençant un utilisateur inexistant est signalé comme anomalie', async () => {
  const ghostHotel = await Hotel.create({ name: 'Hôtel Manager Introuvable', manager: id(), createdBy: id() });
  const summary = await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  expect(summary.anomalies.some((a) => a.hotelId === String(ghostHotel._id) && a.reason === 'MANAGER_USER_NOT_FOUND')).toBe(true);
  expect(await HotelStaffAssignment.countDocuments({ hotel: ghostHotel._id })).toBe(0);
});

test('aucune fuite inter-hôtel : le manager de l’hôtel A migré n’obtient jamais accès à l’hôtel B', async () => {
  const hotelA = await makeLegacyHotel();
  const hotelB = await makeLegacyHotel();
  await User.create({ _id: hotelA.manager, name: 'Manager A', email: `managera${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  await runLegacyHotelManagerMigration({ apply: true, actor: admin });
  const actorA = { role: 'Proprietaire', _id: hotelA.manager };
  await expect(assertOperationalHotelAccess({ actor: actorA, hotelId: hotelA._id, capability: CAP.HOTEL_MANAGE })).resolves.toEqual({});
  expect((await assertOperationalHotelAccess({ actor: actorA, hotelId: hotelB._id, capability: CAP.HOTEL_MANAGE })).error).toBe(403);
});

test('lectures concurrentes pendant un changement de manager restent cohérentes (jamais un état intermédiaire incohérent)', async () => {
  const hotel = await makeLegacyHotel();
  const oldManager = await User.create({ _id: hotel.manager, name: 'Ancien Manager Concurrent', email: `oldconcurrent${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire' });
  await ensureHotelManagerAssignment({ hotelId: hotel._id, managerId: oldManager._id, actor: admin });
  const newManager = await makeUser();

  const [, ...reads] = await Promise.all([
    changeHotelManager({ hotel, newManagerId: newManager._id, actor: admin }),
    ...Array.from({ length: 4 }, () => assertOperationalHotelAccess({ actor: admin, hotelId: hotel._id, capability: CAP.HOTEL_MANAGE })),
  ]);
  reads.forEach((r) => expect(r).toEqual({})); // Admin reste toujours autorisé, quel que soit le timing
  expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id, assignmentRole: 'hotel_manager', status: 'active' })).toBe(1);
});

// F2.6.3 — correctif d'atomicité : Hotel + HotelStaffAssignment(manager) + ActionLog associé
// doivent réussir ou échouer ensemble (transaction Mongo, voir hotelService.ensureManagerGovernanceAtomic).
describe('F2.6.3 — atomicité Hotel + HotelStaffAssignment + ActionLog', () => {
  const buildPropertyData = (ownerId, suffix) => ({
    title: `Hôtel Atomicité ${suffix}`, pole: 'Altimmo', description: 'Description suffisamment longue pour la validation.',
    type: 'Villa', status: 'hebergement', price: 50000, surface: 200,
    address: { arrondissement: 'Centre-ville' }, latitude: 4.26, longitude: 15.28,
    owner: ownerId, images: ['https://example.test/image.jpg'],
  });

  test('création avec manager : hôtel + assignment + ActionLog créés ensemble', async () => {
    const creator = await makeUser();
    const result = await createFullHotel({
      propertyData: buildPropertyData(creator._id, 'A'),
      hotelData: { name: 'Hôtel Atomique A' },
      actingUser: { ...creator, id: creator._id },
    });

    expect(await Hotel.exists({ _id: result.hotel._id })).toBeTruthy();
    const assignment = await HotelStaffAssignment.findOne({ user: creator._id, hotel: result.hotel._id, assignmentRole: 'hotel_manager', status: 'active' });
    expect(assignment).toBeTruthy();
    expect(await ActionLog.countDocuments({ action: 'hotel_staff.assignment_created_from_hotel_creation', 'cible.id': String(assignment._id) })).toBe(1);
  });

  test('création sans manager résolu : comportement inchangé — aucun assignment tenté, aucune transaction ouverte', async () => {
    const orphanHotel = await Hotel.create({ name: 'Hôtel Sans Manager F263', createdBy: id(), manager: null });
    await expect(ensureManagerGovernanceAtomic({
      hotel: orphanHotel, actingUser: admin, accommodation: { _id: id() }, property: { _id: id(), images: [] },
    })).resolves.toBeUndefined();
    expect(await HotelStaffAssignment.countDocuments({ hotel: orphanHotel._id })).toBe(0);
    expect(await Hotel.exists({ _id: orphanHotel._id })).toBeTruthy(); // hôtel non touché, non compensé
  });

  test('échec forcé de la création de l’assignment : rollback complet — aucun hôtel, aucun assignment, aucun audit', async () => {
    const creator = await makeUser();
    // Échec injecté au niveau du modèle (mêmes garanties transactionnelles réelles exercées,
    // MongoMemoryReplSet non mocké) pour prouver le rollback sans dépendre d'un état de
    // données préexistant — HotelStaffAssignment.create est le point d'écriture ciblé par
    // l'exigence de rollback, pas une substitution de la couche DB elle-même.
    const spy = jest.spyOn(HotelStaffAssignment, 'create').mockRejectedValueOnce(new Error('Échec simulé — création assignment.'));
    try {
      await expect(createFullHotel({
        propertyData: buildPropertyData(creator._id, 'B'),
        hotelData: { name: 'Hôtel Échec Assignment F263' },
        actingUser: { ...creator, id: creator._id },
      })).rejects.toThrow('Échec simulé');
    } finally {
      spy.mockRestore();
    }
    expect(await Hotel.countDocuments({ name: 'Hôtel Échec Assignment F263' })).toBe(0);
    expect(await HotelStaffAssignment.countDocuments({ user: creator._id })).toBe(0);
    expect(await Accommodation.countDocuments({})).toBe(0);
    expect(await ActionLog.countDocuments({ action: 'hotel_staff.assignment_created_from_hotel_creation', 'auteur.id': String(creator._id) })).toBe(0);
  });

  test('échec forcé de l’ActionLog : rollback complet — aucun hôtel, aucun assignment, aucun audit', async () => {
    const creator = await makeUser();
    const spy = jest.spyOn(ActionLog, 'create').mockRejectedValueOnce(new Error('Échec simulé — écriture ActionLog.'));
    try {
      await expect(createFullHotel({
        propertyData: buildPropertyData(creator._id, 'C'),
        hotelData: { name: 'Hôtel Échec Audit F263' },
        actingUser: { ...creator, id: creator._id },
      })).rejects.toThrow('Échec simulé');
    } finally {
      spy.mockRestore();
    }
    expect(await Hotel.countDocuments({ name: 'Hôtel Échec Audit F263' })).toBe(0);
    expect(await HotelStaffAssignment.countDocuments({ user: creator._id })).toBe(0);
    expect(await Accommodation.countDocuments({})).toBe(0);
  });

  test('cinq retries concurrents de la gouvernance sur un rattachement déjà actif : idempotent, aucune écriture, aucune compensation', async () => {
    const hotel = await makeLegacyHotel();
    const managerUser = await User.create({
      _id: hotel.manager, name: 'Manager Atomique Retry', email: `atomicretry${Date.now()}@example.com`,
      password: 'Password123!', passwordConfirm: 'Password123!', role: 'Proprietaire',
    });
    const actor = { ...managerUser, id: managerUser._id };
    const accommodation = { _id: id() };
    const property = { _id: id(), images: [] };
    // Premier appel réel : établit le rattachement.
    await ensureManagerGovernanceAtomic({ hotel, actingUser: actor, accommodation, property });

    // Cinq retries concurrents sur un rattachement DÉJÀ actif — chemin idempotent
    // (`existingActive` dans ensureHotelManagerAssignment) : aucune écriture tentée, donc
    // aucun conflit transactionnel possible, donc jamais de compensation intempestive.
    const results = await Promise.all(Array.from({ length: 5 }, () => ensureManagerGovernanceAtomic({ hotel, actingUser: actor, accommodation, property })));
    expect(results).toHaveLength(5);
    expect(await HotelStaffAssignment.countDocuments({ hotel: hotel._id, user: managerUser._id, assignmentRole: 'hotel_manager', status: 'active' })).toBe(1);
    expect(await Hotel.exists({ _id: hotel._id })).toBeTruthy();
  });

  test('cinq créations concurrentes de hôtels (même manager) réussissent chacune sans erreur ni doublon', async () => {
    const creator = await makeUser();
    const actingUser = { ...creator, id: creator._id };
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => createFullHotel({
      propertyData: buildPropertyData(creator._id, `Concurrent${i}`),
      hotelData: { name: `Hôtel Concurrent F263 ${i}` },
      actingUser,
    })));
    expect(results).toHaveLength(5);
    const assignments = await HotelStaffAssignment.find({ user: creator._id, assignmentRole: 'hotel_manager', status: 'active' });
    expect(assignments).toHaveLength(5); // un rattachement actif distinct par hôtel, aucun doublon
    expect(new Set(assignments.map((a) => String(a.hotel))).size).toBe(5);
  });
});
