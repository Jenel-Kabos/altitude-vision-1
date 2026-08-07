const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Locataire = require('../models/Locataire');
const ContactMessage = require('../models/ContactMessage');
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmActivity = require('../models/CrmActivity');
const Notification = require('../models/Notification');
const CrmConsolidation = require('../models/CrmConsolidation');
const Property = require('../models/Property');
const Hotel = require('../models/Hotel');
const { synchronizeCustomers, listCustomers, getCustomer360, createOpportunity, moveOpportunity, setOpportunityOutcome, createActivity, updateActivity, getDashboard, getPipeline, getActivities, globalSearch, findDuplicates, compareCustomers, consolidateCustomers } = require('../services/crmService');

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

  test('calcule cockpit, KPI commerciaux, pipeline, agenda et recherche côté serveur', async () => {
    const { admin } = await fixture(); await synchronizeCustomers(admin._id);
    const customer = await CrmCustomer.findOne({ identityKeys: 'email:ada@example.test' });
    const won = await createOpportunity(customer._id, { title: 'Mission gagnée', pole: 'Altimmo', valueMinor: 500000 }, admin._id);
    await setOpportunityOutcome(won._id, { outcome: 'won' }, admin._id);
    const lost = await createOpportunity(customer._id, { title: 'Mission perdue', pole: 'Altcom' }, admin._id);
    await setOpportunityOutcome(lost._id, { outcome: 'lost', reason: 'Budget insuffisant' }, admin._id);
    const overdue = new Date(); overdue.setDate(overdue.getDate() - 1);
    await createActivity(customer._id, { type: 'relance', title: 'Relance en retard', dueAt: overdue }, admin._id);
    const dashboard = await getDashboard();
    expect(dashboard.commercial).toMatchObject({ conversionRate: 50, won: 1, lost: 1 });
    expect(dashboard.kpis.overdueTasks).toBe(1);
    expect((await getPipeline()).opportunities).toHaveLength(2);
    expect((await getActivities({ view: 'overdue' })).activities).toHaveLength(1);
    const search = await globalSearch('Ada');
    expect(search.results.some((x) => x.type === 'customer' && x.destination === 'CRM_CUSTOMER_DETAILS')).toBe(true);
  });

  test('détecte, compare et consolide sans suppression avec journal append-only', async () => {
    const admin = await User.create({ name: 'Admin Fusion', email: 'fusion.admin@example.test', role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!' });
    const a = await CrmCustomer.create({ displayName: 'Ada Mpassi', company: 'Altitude', emails: ['a@example.test'], phones: ['+242061112233'], identityKeys: ['email:a@example.test'], sourceRefs: [{ entityType: 'ContactMessage', entityId: new mongoose.Types.ObjectId(), source: 'test' }] });
    const b = await CrmCustomer.create({ displayName: 'Ada Mpassi', company: 'Altitude', emails: ['b@example.test'], phones: ['06 111 22 33'], identityKeys: ['email:b@example.test'], sourceRefs: [{ entityType: 'QuoteRequest', entityId: new mongoose.Types.ObjectId(), source: 'test' }] });
    const opportunity = await createOpportunity(b._id, { title: 'À transférer' }, admin._id);
    await createActivity(b._id, { type: 'note', title: 'Note à conserver' }, admin._id);
    const duplicates = await findDuplicates(); expect(duplicates.pairs[0]).toMatchObject({ score: 60, phoneOnly: false });
    const comparison = await compareCustomers(a._id, b._id); expect(comparison.customerA.customer.displayName).toBe('Ada Mpassi');
    const journal = await consolidateCustomers({ customerA: a._id, customerB: b._id, decision: 'keep_a', justification: 'Identité confirmée par le gestionnaire' }, admin._id);
    expect(journal.decision).toBe('keep_a');
    expect(await CrmCustomer.exists({ _id: b._id, status: 'archived', mergedInto: a._id })).toBeTruthy();
    expect(await CrmCustomer.exists({ _id: b._id })).toBeTruthy();
    expect(await CrmOpportunity.exists({ _id: opportunity._id, customer: a._id })).toBeTruthy();
    expect((await CrmCustomer.findById(a._id)).emails).toEqual(expect.arrayContaining(['a@example.test', 'b@example.test']));
    await expect(CrmConsolidation.updateOne({ _id: journal._id }, { justification: 'Altération' })).rejects.toThrow(/append-only/);
  });

  test('le téléphone seul reste un indice et la décision peut être reportée', async () => {
    const admin = await User.create({ name: 'Admin Report', email: 'report.admin@example.test', role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!' });
    const a = await CrmCustomer.create({ displayName: 'Personne A', phones: ['061234567'], identityKeys: ['source:ContactMessage:aaaaaaaaaaaaaaaaaaaaaaaa'], sourceRefs: [{ entityType: 'ContactMessage', entityId: new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'), source: 'test' }] });
    const b = await CrmCustomer.create({ displayName: 'Personne B', phones: ['06 12 34 567'], identityKeys: ['source:QuoteRequest:bbbbbbbbbbbbbbbbbbbbbbbb'], sourceRefs: [{ entityType: 'QuoteRequest', entityId: new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'), source: 'test' }] });
    const pair = (await findDuplicates()).pairs[0]; expect(pair).toMatchObject({ score: 15, phoneOnly: true });
    await consolidateCustomers({ customerA: a._id, customerB: b._id, decision: 'defer', justification: 'Téléphone partagé à vérifier' }, admin._id);
    expect(await CrmCustomer.countDocuments({ status: 'merge_review' })).toBe(2);
    expect(await CrmCustomer.countDocuments({ status: 'archived' })).toBe(0);
  });

  // USER-ARCH-1 — un utilisateur qui exploite un hébergement/hôtel reçoit la
  // relation 'exploitant_etablissement' EN PLUS de ses autres relations,
  // jamais à la place — jamais dérivé de User.role (qui reste 'Proprietaire'
  // pour les deux cas, sans distinction).
  test('exploitant_etablissement est ajouté pour un propriétaire de bien hébergement, sans retirer les autres relations', async () => {
    const admin = await User.create({ name: 'Admin CRM 2', email: 'admin.crm2@example.test', role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!' });
    const exploitant = await User.create({ name: 'Exploitant Hebergement', email: 'exploitant.heb@example.test', phone: '+242060000099', role: 'Proprietaire', password: 'Password123!', passwordConfirm: 'Password123!' });
    await Property.create({
      title: 'Villa meublée CRM test', description: 'Description suffisamment longue pour la validation du modèle Property.',
      pole: 'Altimmo', type: 'Villa', status: 'hebergement', price: 100000,
      address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
      images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
      statusAdmin: 'Validée', availability: 'Disponible', owner: exploitant._id,
    });
    await synchronizeCustomers(admin._id);
    const customer = await CrmCustomer.findOne({ identityKeys: 'email:exploitant.heb@example.test' });
    expect(customer.relations).toEqual(expect.arrayContaining(['exploitant_etablissement', 'prospect']));
  });

  test('exploitant_etablissement est ajouté pour un manager d\'hôtel', async () => {
    const admin = await User.create({ name: 'Admin CRM 3', email: 'admin.crm3@example.test', role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!' });
    const manager = await User.create({ name: 'Manager Hotel', email: 'manager.hotel@example.test', role: 'Proprietaire', password: 'Password123!', passwordConfirm: 'Password123!' });
    await Hotel.create({ name: 'Hotel CRM Test', manager: manager._id, createdBy: admin._id });
    await synchronizeCustomers(admin._id);
    const customer = await CrmCustomer.findOne({ identityKeys: 'email:manager.hotel@example.test' });
    expect(customer.relations).toContain('exploitant_etablissement');
  });

  // USER-ARCH-UX-1 (Phase 4) — le pipeline filtré par `relation` ne doit
  // renvoyer que les opportunités des customers portant ce segment, sans
  // jamais modifier les autres opportunités ni la vue non filtrée.
  test('getPipeline({relation}) segmente le pipeline sans affecter la vue non filtrée', async () => {
    const admin = await User.create({ name: 'Admin CRM 4', email: 'admin.crm4@example.test', role: 'Admin', password: 'Password123!', passwordConfirm: 'Password123!' });
    const exploitantCustomer = await CrmCustomer.create({ displayName: 'Exploitant Pipeline', relations: ['exploitant_etablissement'], identityKeys: ['source:Test:exploitant-pipeline'], sourceRefs: [{ entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'test' }] });
    const proprietaireCustomer = await CrmCustomer.create({ displayName: 'Proprietaire Pipeline', relations: ['proprietaire'], identityKeys: ['source:Test:proprietaire-pipeline'], sourceRefs: [{ entityType: 'User', entityId: new mongoose.Types.ObjectId(), source: 'test' }] });
    await createOpportunity(exploitantCustomer._id, { title: 'Mission exploitant' }, admin._id);
    await createOpportunity(proprietaireCustomer._id, { title: 'Mission proprietaire' }, admin._id);

    const filtered = await getPipeline({ relation: 'exploitant_etablissement' });
    expect(filtered.opportunities).toHaveLength(1);
    expect(filtered.opportunities[0].title).toBe('Mission exploitant');

    const unfiltered = await getPipeline();
    expect(unfiltered.opportunities).toHaveLength(2);
  });
});
