const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const Paiement = require('../models/Paiement');
const { getMyPaymentPage } = require('../services/tenantPortalService');
const { getOwnerPaymentPage } = require('../services/rentalOwnerFinancialService');

jest.setTimeout(120000);
let sequence = 0;
const user = (role) => User.create({ name: `Portal ${role}`, email: `portal${sequence += 1}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role });
const property = (owner, title) => Property.create({ title, description: 'Description de test suffisamment longue pour le portail financier.', pole: 'Altimmo', type: 'Villa', status: 'location', price: 100000, address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24, images: ['https://placehold.co/1200x800/png'], surface: 80, statusAdmin: 'Validée', availability: 'Loué', owner });

async function managedLease({ owner, tenantUser, title, managed = true, status = 'actif' }) {
  const bien = await property(owner._id, title);
  const locataire = await Locataire.create({ nom: 'Moke', prenom: title, telephone: `+24206${sequence}000011`, user: tenantUser?._id });
  const lease = await Contrat.create({ type: 'location', bien: bien._id, locataire: locataire._id, statut: status, dateEntree: '2026-01-01', dateFinBail: '2026-12-31', montantLoyer: 100 });
  await RentalManagement.create({ property: bien._id, owner: owner._id, managementActivated: managed, occupancyStatus: status === 'actif' ? 'occupe' : 'vacant', activeLease: status === 'actif' ? lease._id : null });
  return { bien, locataire, lease };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

test('les totaux locataire sont globaux et identiques sur toutes les pages', async () => {
  const owner = await user('Proprietaire'); const tenant = await user('Client');
  const { lease } = await managedLease({ owner, tenantUser: tenant, title: 'Villa locataire' });
  await Paiement.insertMany(Array.from({ length: 12 }, (_, index) => ({ contrat: lease._id, mois: (index % 12) + 1, annee: 2026, montant: 100, montantTotal: 110, montantRecu: 60, penaliteMontant: 10, statut: 'partiel' })));
  const first = await getMyPaymentPage(tenant._id, { page: 1, limit: 5 });
  const second = await getMyPaymentPage(tenant._id, { page: 2, limit: 5 });
  expect(first.payments).toHaveLength(5); expect(second.payments).toHaveLength(5);
  expect(first.summary).toEqual({ du: 1320, recu: 720, penalites: 120, restant: 600 });
  expect(second.summary).toEqual(first.summary);
});

test('le propriétaire voit tout son historique géré, jamais les biens non gérés ou ceux d’un autre propriétaire', async () => {
  const owner = await user('Proprietaire'); const otherOwner = await user('Proprietaire');
  const active = await managedLease({ owner, title: 'Villa active' });
  const historic = await managedLease({ owner, title: 'Villa historique', status: 'résilié' });
  const unmanaged = await managedLease({ owner, title: 'Villa hors gestion', managed: false });
  const foreign = await managedLease({ owner: otherOwner, title: 'Villa étrangère' });
  const sale = await Contrat.create({ type: 'vente', bien: active.bien._id, statut: 'expiré', prixVente: 50000000 });
  for (const lease of [active.lease, historic.lease, unmanaged.lease, foreign.lease, sale]) await Paiement.create({ contrat: lease._id, mois: 8, annee: 2026, montantTotal: 100, montantRecu: 50, statut: 'partiel' });
  const page = await getOwnerPaymentPage(owner._id, { page: 1, limit: 2, ownerId: otherOwner._id });
  expect(page.pagination.total).toBe(2); expect(page.items).toHaveLength(2);
  expect(page.items.map((item) => item.property.title).sort()).toEqual(['Villa active', 'Villa historique']);
  expect(page.summary).toEqual({ du: 200, recu: 100, penalites: 0, restant: 100 });
  const attack = await getOwnerPaymentPage(owner._id, { contractId: foreign.lease._id });
  expect(attack.items).toEqual([]); expect(attack.summary.du).toBe(0);
});
