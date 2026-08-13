const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Locataire = require('../models/Locataire');
const Proprietaire = require('../models/Proprietaire');
const RentalManagement = require('../models/RentalManagement');
const ActionLog = require('../models/ActionLog');
const service = require('../services/rentalContractRegularizationService');

jest.setTimeout(120000);
let counter = 0;
const user = (role) => User.create({ name: role, email: `reconux${counter += 1}${Date.now()}@test.dev`, password: 'Password123!', passwordConfirm: 'Password123!', role });
const fixture = async () => {
  const admin = await user('Admin'); const owner = await user('Proprietaire');
  const proprietaire = await Proprietaire.create({ nom: 'Owner', prenom: 'One', telephone: '06000000', user: owner._id });
  const locataire = await Locataire.create({ nom: 'Tenant', prenom: 'One', telephone: '07000000' });
  const property = await Property.create({ title: 'Villa Centre', description: 'Description suffisamment longue pour les tests.', pole: 'Altimmo', type: 'Villa', status: 'location', price: 250000, address: { street: 'Rue Test', city: 'Brazzaville', arrondissement: 'Centre' }, latitude: -4.2, longitude: 15.2, images: ['https://test.dev/a.jpg'], surface: 80, availability: 'Disponible', owner: owner._id });
  const contract = await Contrat.create({ type: 'location', statut: 'actif', proprietaire: proprietaire._id, locataire: locataire._id, adresseBien: 'Rue Test', villeBien: 'Brazzaville', montantLoyer: 250000 });
  return { admin, owner, proprietaire, locataire, property, contract };
};
const reconstructionData = {
  reason: 'Reconstruction après contrôle humain des pièces historiques',
  property: {
    title: 'Bien historique reconstruit', type: 'Appartement', street: 'Rue Legacy',
    city: 'Brazzaville', arrondissement: 'Centre', monthlyRent: 250000, surface: 75,
    latitude: -4.2, longitude: 15.2, description: 'Bien reconstruit exclusivement depuis un contrat historique vérifié.',
  },
};

beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

// PLATFORM-ADMIN-CERT-1 (V3) — ce service impose désormais une frontière
// tenant (voir server/docs/PLATFORM_ADMIN_CERT_1_AUDIT.md). Ces tests,
// antérieurs à cette exigence, appelaient le service directement sans le
// moindre contexte tenant ; ils reflètent maintenant l'appel réel effectué
// par le contrôleur HTTP (`req.tenantScopeUserIds`), avec `owner` (le
// `Proprietaire.user` de la fixture) dans le scope — sinon le service
// traiterait à raison ces dossiers comme hors périmètre de l'acteur.
test('liste le dossier et explique les Property compatibles sans mutation', async () => {
  const { contract, property, owner } = await fixture();
  const rows = await service.getCases({ tenantScopeUserIds: [owner._id] });
  expect(rows).toHaveLength(1);
  expect(String(rows[0].contract._id)).toBe(String(contract._id));
  expect(String(rows[0].compatibleProperties[0]._id)).toBe(String(property._id));
  expect(rows[0].compatibleProperties[0].reasons).toContain('propriétaire explicitement lié');
  expect((await Contrat.findById(contract._id)).bien).toBeFalsy();
});

test('rattache, synchronise, journalise puis permet une réversion Admin contrôlée', async () => {
  const { admin, property, contract, owner } = await fixture();
  const scope = { tenantScopeUserIds: [owner._id] };
  const record = await service.decide({ contractId: contract._id, action: 'link_existing', data: { propertyId: property._id, reason: 'Vérification humaine des pièces du dossier' }, actor: admin, ...scope });
  expect(record.status).toBe('resolved');
  expect(String((await Contrat.findById(contract._id)).bien)).toBe(String(property._id));
  expect(await RentalManagement.exists({ property: property._id, activeLease: contract._id, occupancyStatus: 'occupe' })).toBeTruthy();
  expect(await ActionLog.exists({ action: 'Régularisation contrat historique' })).toBeTruthy();

  await service.revert({ contractId: contract._id, reason: 'Correction contrôlée après double vérification', actor: admin, ...scope });
  expect((await Contrat.findById(contract._id)).bien).toBeFalsy();
  expect(await RentalManagement.exists({ property: property._id, activeLease: null, occupancyStatus: 'vacant' })).toBeTruthy();
  expect(await ActionLog.exists({ action: 'Réversion régularisation contrat' })).toBeTruthy();
});

test('classe une anomalie sans modifier le contrat et réserve la réversion à Admin', async () => {
  const { contract, admin, owner } = await fixture();
  const scope = { tenantScopeUserIds: [owner._id] };
  const manager = await user('GestionnaireImmobilier');
  await service.decide({ contractId: contract._id, action: 'flag_anomaly', data: { reason: 'Adresse insuffisante à confirmer manuellement' }, actor: manager, ...scope });
  expect((await Contrat.findById(contract._id)).statut).toBe('actif');
  await expect(service.revert({ contractId: contract._id, reason: 'Tentative gestionnaire', actor: manager, ...scope })).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
  await expect(service.revert({ contractId: contract._id, reason: 'Validation administrateur', actor: admin, ...scope })).resolves.toMatchObject({ status: 'reverted' });
});

test('reconstruit exactement un Property non publié et un RentalManagement pour un contrat legacy', async () => {
  const { admin, contract, owner } = await fixture();
  const scope = { tenantScopeUserIds: [owner._id] };
  const before = await Property.countDocuments();
  const record = await service.decide({ contractId: contract._id, action: 'create_internal', data: reconstructionData, actor: admin, ...scope });
  const updated = await Contrat.findById(contract._id);
  const property = await Property.findById(updated.bien);
  const rental = await RentalManagement.findOne({ property: property._id });

  expect(await Property.countDocuments()).toBe(before + 1);
  expect(record.createdProperty).toBe(true);
  expect(property.toObject()).toMatchObject({ isPublished: false, statusAdmin: 'En attente', internalManagedOnly: true });
  expect(rental.toObject()).toMatchObject({ managementActivated: true, publicationAuthorized: false, publicationStatus: 'suspendu' });
  expect(record.events[0]).toMatchObject({ action: 'create_internal', reason: reconstructionData.reason });
  expect(await ActionLog.exists({ action: 'Reconstruction patrimoniale historique' })).toBeTruthy();
});

test('refuse la reconstruction sans motif, pour Collaborateur et pour un contrat moderne déjà rattaché', async () => {
  const { admin, property, contract, owner } = await fixture();
  const scope = { tenantScopeUserIds: [owner._id] };
  const collaborator = await user('Collaborateur');
  await expect(service.decide({
    contractId: contract._id,
    action: 'create_internal',
    data: { ...reconstructionData, reason: '' },
    actor: admin,
    ...scope,
  })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  await expect(service.decide({ contractId: contract._id, action: 'create_internal', data: reconstructionData, actor: collaborator, ...scope }))
    .rejects.toMatchObject({ code: 'HISTORICAL_RECONSTRUCTION_FORBIDDEN' });

  contract.bien = property._id;
  await contract.save();
  await expect(service.decide({ contractId: contract._id, action: 'create_internal', data: reconstructionData, actor: admin, ...scope }))
    .rejects.toMatchObject({ code: 'CASE_NOT_PENDING' });
});

test('la réversion d’une reconstruction conserve le Property et le rend interne non publié', async () => {
  const { admin, contract, owner } = await fixture();
  const scope = { tenantScopeUserIds: [owner._id] };
  await service.decide({ contractId: contract._id, action: 'create_internal', data: reconstructionData, actor: admin, ...scope });
  const propertyId = (await Contrat.findById(contract._id)).bien;
  await service.revert({ contractId: contract._id, reason: 'Réversion contrôlée sans suppression patrimoniale', actor: admin, ...scope });

  expect(await Property.exists({ _id: propertyId })).toBeTruthy();
  expect(await Property.findById(propertyId)).toMatchObject({ isPublished: false });
  expect((await Contrat.findById(contract._id)).bien).toBeFalsy();
});
