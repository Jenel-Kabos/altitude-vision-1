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

beforeAll(startFinancialMongo); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);

test('liste le dossier et explique les Property compatibles sans mutation', async () => {
  const { contract, property } = await fixture();
  const rows = await service.getCases();
  expect(rows).toHaveLength(1);
  expect(String(rows[0].contract._id)).toBe(String(contract._id));
  expect(String(rows[0].compatibleProperties[0]._id)).toBe(String(property._id));
  expect(rows[0].compatibleProperties[0].reasons).toContain('propriétaire explicitement lié');
  expect((await Contrat.findById(contract._id)).bien).toBeFalsy();
});

test('rattache, synchronise, journalise puis permet une réversion Admin contrôlée', async () => {
  const { admin, property, contract } = await fixture();
  const record = await service.decide({ contractId: contract._id, action: 'link_existing', data: { propertyId: property._id, reason: 'Vérification humaine des pièces du dossier' }, actor: admin });
  expect(record.status).toBe('resolved');
  expect(String((await Contrat.findById(contract._id)).bien)).toBe(String(property._id));
  expect(await RentalManagement.exists({ property: property._id, activeLease: contract._id, occupancyStatus: 'occupe' })).toBeTruthy();
  expect(await ActionLog.exists({ action: 'Régularisation contrat historique' })).toBeTruthy();

  await service.revert({ contractId: contract._id, reason: 'Correction contrôlée après double vérification', actor: admin });
  expect((await Contrat.findById(contract._id)).bien).toBeFalsy();
  expect(await RentalManagement.exists({ property: property._id, activeLease: null, occupancyStatus: 'vacant' })).toBeTruthy();
  expect(await ActionLog.exists({ action: 'Réversion régularisation contrat' })).toBeTruthy();
});

test('classe une anomalie sans modifier le contrat et réserve la réversion à Admin', async () => {
  const { contract, admin } = await fixture();
  const manager = await user('GestionnaireImmobilier');
  await service.decide({ contractId: contract._id, action: 'flag_anomaly', data: { reason: 'Adresse insuffisante à confirmer manuellement' }, actor: manager });
  expect((await Contrat.findById(contract._id)).statut).toBe('actif');
  await expect(service.revert({ contractId: contract._id, reason: 'Tentative gestionnaire', actor: manager })).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
  await expect(service.revert({ contractId: contract._id, reason: 'Validation administrateur', actor: admin })).resolves.toMatchObject({ status: 'reverted' });
});
