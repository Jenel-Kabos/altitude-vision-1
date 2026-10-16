const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const PlatformOperator = require('../models/PlatformOperator');
const ApplicationDisclosureEvent = require('../models/ApplicationDisclosureEvent');
const { grantAuthorization, revokeAuthorization } = require('../services/contactAuthorizationService');
const {
  authorizeContactDisclosure,
  authorizeEvidenceAccess,
  recordApplicationDisclosure,
} = require('../services/realEstateApplicationPrivacyService');

jest.setTimeout(180000);
let n = 0;
const makeUser = (role) => User.create({ name: `Disclosure ${++n}`, email: `disclosure-${n}-${Date.now()}@example.test`, password: 'Password123!', passwordConfirm: 'Password123!', role, isEmailVerified: true });
let operator; let applicant; let owner; let propertyId; let applicationId; let tenantId;
const application = () => ({ _id: applicationId, applicant: applicant._id, owner: owner._id, property: propertyId });

beforeAll(async () => { await startFinancialMongo(); });
beforeEach(async () => {
  await clearFinancialMongo();
  [operator, applicant, owner] = await Promise.all([makeUser('Admin'), makeUser('Client'), makeUser('Proprietaire')]);
  propertyId = new mongoose.Types.ObjectId(); applicationId = new mongoose.Types.ObjectId(); tenantId = new mongoose.Types.ObjectId();
  await PlatformOperator.create({ user: operator._id, capabilities: ['platform.commercial.manage'], grantedBy: operator._id, grantReason: 'test' });
});
afterAll(stopFinancialMongo);

test('le propriétaire ne voit les coordonnées qu’avec la portée exacte active, puis la révocation bloque immédiatement', async () => {
  await expect(authorizeContactDisclosure({ application: application(), actor: owner, tenantId })).rejects.toMatchObject({ code: 'CONTACT_AUTHORIZATION_REQUIRED' });
  const authorization = await grantAuthorization({ clientId: applicant._id, representativeId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId: applicationId, tenantId, scopes: ['contact_details_disclosure'], actor: operator, reason: 'transmission autorisée' });
  await expect(authorizeContactDisclosure({ application: application(), actor: owner, tenantId })).resolves.toMatchObject({ mode: 'authorized_contact' });
  await revokeAuthorization({ authorizationId: authorization._id, actor: operator, reason: 'retrait' });
  await expect(authorizeContactDisclosure({ application: application(), actor: owner, tenantId })).rejects.toMatchObject({ code: 'CONTACT_AUTHORIZATION_REQUIRED' });
});

test('la portée messagerie seule ne donne jamais accès aux justificatifs', async () => {
  await grantAuthorization({ clientId: applicant._id, representativeId: owner._id, propertyId, dossierType: 'RealEstateApplication', dossierId: applicationId, tenantId, scopes: ['direct_transactional_messaging'], actor: operator, reason: 'messages uniquement' });
  await expect(authorizeEvidenceAccess({ application: application(), actor: owner })).rejects.toMatchObject({ code: 'APPLICATION_EVIDENCE_ACCESS_REQUIRED' });
  await expect(authorizeEvidenceAccess({ application: application(), actor: applicant })).resolves.toMatchObject({ mode: 'applicant_self' });
  await expect(authorizeEvidenceAccess({ application: application(), actor: operator })).resolves.toMatchObject({ mode: 'platform_mediator' });
});

test('journalise la catégorie et les champs divulgués sans stocker leur valeur', async () => {
  await recordApplicationDisclosure({ application: application(), actor: operator, tenantId, category: 'contact_details', fields: ['email', 'phone'], reason: 'Qualification du dossier', recipient: owner._id, authority: { mode: 'platform_mediator', authorizationId: null } });
  const event = await ApplicationDisclosureEvent.findOne({ application: applicationId }).lean();
  expect(event).toMatchObject({ category: 'contact_details', fields: ['email', 'phone'], reason: 'Qualification du dossier', recipient: owner._id, authorityMode: 'platform_mediator' });
  expect(JSON.stringify(event)).not.toMatch(/@example|\+242/);
});
