const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Locataire = require('../models/Locataire');
const ContactMessage = require('../models/ContactMessage');
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmActivity = require('../models/CrmActivity');
const Notification = require('../models/Notification');
const { synchronizeCustomers, listCustomers, getCustomer360, createOpportunity, moveOpportunity, createActivity, updateActivity } = require('../services/crmService');

jest.setTimeout(120000);
describe('CRM-CORE-1 — Customer 360 transversal', () => {
  beforeAll(async () => { await startFinancialMongo(); await CrmCustomer.syncIndexes(); }); afterEach(clearFinancialMongo); afterAll(stopFinancialMongo);
  async function fixture() {
    const admin = await User.create({ name: 'Admin CRM', email: 'admin.crm@example.test', phone: '+242060000001', role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!' });
    const customerUser = await User.create({ name: 'Ada Client', email: 'ADA@example.test', phone: '+242 06 111 22 33', role: 'Client', password: 'Password123!', passwordConfirm: 'Password123!' });
    const tenant = await Locataire.create({ nom: 'Client', prenom: 'Ada', email: 'ada@example.test', telephone: '06 111 22 33', user: customerUser._id });
    await ContactMessage.create({ name: 'Ada Client', email: 'ada@example.test', phone: '+242061112233', subject: 'Projet', message: 'Je souhaite être accompagnée.' });
    return { admin, customerUser, tenant };
  }

  test('consolide plusieurs rôles/sources en une seule fiche sans modifier les sources', async () => {
    const { admin, customerUser, tenant } = await fixture();
    const result = await synchronizeCustomers(admin._id);
    expect(result.conflicts).toEqual([]);
    const customer = await CrmCustomer.findOne({ identityKeys: 'email:ada@example.test' });
    expect(customer.sourceRefs.map((r) => r.entityType)).toEqual(expect.arrayContaining(['User', 'Locataire', 'ContactMessage']));
    expect(customer.relations).toEqual(expect.arrayContaining(['prospect', 'locataire']));
    expect(await User.exists({ _id: customerUser._id })).toBeTruthy();
    expect(await Locataire.exists({ _id: tenant._id })).toBeTruthy();
    const list = await listCustomers({ search: 'Ada' });
    expect(list.total).toBe(1);
  });

  test('connecte pipeline, activités et timeline à la même fiche 360', async () => {
    const { admin } = await fixture(); await synchronizeCustomers(admin._id);
    const customer = await CrmCustomer.findOne({ identityKeys: 'email:ada@example.test' });
    const opportunity = await createOpportunity(customer._id, { title: 'Mandat immobilier', pole: 'Altimmo' }, admin._id);
    await moveOpportunity(opportunity._id, { stage: 'qualification', note: 'Besoin validé' }, admin._id);
    const activity = await createActivity(customer._id, { type: 'rappel', title: 'Rappeler Ada', dueAt: new Date() }, admin._id);
    await updateActivity(activity._id, { status: 'terminee' }, admin._id);
    const dossier = await getCustomer360(customer._id);
    expect(dossier.opportunities[0].stage).toBe('qualification');
    expect(dossier.activities[0].status).toBe('terminee');
    expect(dossier.timeline.some((e) => e.type === 'crm_rappel')).toBe(true);
    expect(await CrmOpportunity.countDocuments()).toBe(1);
    expect(await CrmActivity.countDocuments()).toBe(1);
    expect(await Notification.findOne({ type: 'crm_activity_assigned', destination: 'CRM_CUSTOMER_DETAILS', entityId: customer._id })).toBeTruthy();
  });

  test('l’index interdit deux fiches portant la même identité canonique', async () => {
    await CrmCustomer.create({ displayName: 'Premier', identityKeys: ['email:unique@example.test'], sourceRefs: [{ entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'test' }] });
    await expect(CrmCustomer.create({ displayName: 'Second', identityKeys: ['email:unique@example.test'], sourceRefs: [{ entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'test' }] })).rejects.toMatchObject({ code: 11000 });
  });
});
