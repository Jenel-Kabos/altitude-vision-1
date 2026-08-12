// GL-LIFE-1 — Machine d'état, avenants/renouvellement, caution : couverture
// d'intégration sur une vraie base (mongodb-memory-server), même
// convention que dossierRoutes.mongo.integration.test.js. Chaque service
// est testé directement (sans HTTP) pour isoler la logique métier ; les
// routes/RBAC sont couvertes par rentalLeaseLifecycleRoutes.mongo.integration.test.js.
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const Property = require('../models/Property');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const Paiement = require('../models/Paiement');
const Notification = require('../models/Notification');
const OrgUnit = require('../models/OrgUnit');
const OrgMembership = require('../models/OrgMembership');
const PlatformTenant = require('../models/PlatformTenant');
const lifecycle = require('../services/rentalLeaseLifecycleService');
const { addAvenant } = require('../services/rentalLeaseAmendmentService');
const { renewLease } = require('../services/rentalLeaseRenewalService');
const caution = require('../services/rentalLeaseCautionService');
const { getLeaseLifecycleDashboard } = require('../services/rentalLeaseDashboardService');

jest.setTimeout(120000);

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({ name: 'Test User', email: `gllife${counter}${Date.now()}@example.com`, password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...overrides });
};

async function buildActiveLease(overrides = {}) {
  const owner = await makeUser({ role: 'Proprietaire' });
  const property = await Property.create({
    title: 'Villa GL-LIFE-1', description: 'Description suffisamment longue pour la validation du modèle Property.',
    pole: 'Altimmo', type: 'Villa', status: 'location', price: 300000,
    address: { arrondissement: 'Bacongo', city: 'Brazzaville' }, latitude: -4.26, longitude: 15.24,
    images: ['https://placehold.co/1200x800/png?text=Test'], surface: 90,
    statusAdmin: 'Validée', availability: 'Loué', owner: owner._id,
  });
  const proprietaire = await Proprietaire.create({ nom: 'Nkounkou', prenom: 'Alice', telephone: '+242060000010' });
  const locataire = await Locataire.create({ nom: 'Moke', prenom: 'Paul', telephone: '+242060000011' });
  const contrat = await Contrat.create({
    type: 'location', bien: property._id, proprietaire: proprietaire._id, locataire: locataire._id, statut: 'actif', cycleVie: 'actif',
    dateEntree: '2027-01-01', dateFinBail: '2027-12-31', montantLoyer: 300000, montantCaution: 600000,
    ...overrides,
  });
  await RentalManagement.create({ property: property._id, owner: owner._id, managementActivated: true, occupancyStatus: 'occupe', activeLease: contrat._id });
  return { owner, property, proprietaire, locataire, contrat };
}

beforeAll(startFinancialMongo);
afterEach(clearFinancialMongo);
afterAll(stopFinancialMongo);

describe('rentalLeaseLifecycleService.transition — machine d\'état', () => {
  test('transition légale (actif → preavis) synchronise statut, jamais désynchronisé', async () => {
    const { contrat, owner } = await buildActiveLease();
    const updated = await lifecycle.transition(contrat._id, 'preavis', { actor: owner._id, comment: 'Test' });
    expect(updated.cycleVie).toBe('preavis');
    expect(updated.statut).toBe('actif'); // toujours actif légalement pendant le préavis
    expect(updated.cycleHistory).toHaveLength(1);
    expect(updated.cycleHistory[0]).toMatchObject({ from: 'actif', to: 'preavis' });
  });

  test('transition illégale rejetée (409), jamais un contournement de la machine d\'état', async () => {
    const { contrat, owner } = await buildActiveLease();
    await expect(lifecycle.transition(contrat._id, 'archive', { actor: owner._id })).rejects.toMatchObject({ statusCode: 409 });
    const fresh = await Contrat.findById(contrat._id);
    expect(fresh.cycleVie).toBe('actif'); // inchangé
  });

  test('requestStatutChange (utilisé par contratController.update) : statut légal accepté', async () => {
    const { contrat, owner } = await buildActiveLease();
    const updated = await lifecycle.requestStatutChange(contrat._id, 'résilié', { actor: owner._id });
    expect(updated.statut).toBe('résilié');
    expect(updated.cycleVie).toBe('resilie');
  });

  test('requestStatutChange : contrat de vente jamais affecté par la machine d\'état locative', async () => {
    const { owner, property, proprietaire } = await buildActiveLease();
    const vente = await Contrat.create({ type: 'vente', bien: property._id, proprietaire: proprietaire._id, statut: 'en_attente', prixVente: 50000000 });
    const result = await lifecycle.requestStatutChange(vente._id, 'actif', { actor: owner._id });
    expect(result.cycleVie).toBeNull();
  });
});

describe('rentalLeaseAmendmentService.addAvenant — Phase 4', () => {
  test('un avenant modifie le loyer sans écraser l\'historique', async () => {
    const { contrat, owner } = await buildActiveLease();
    const updated = await addAvenant(contrat._id, { type: 'loyer', motif: 'Révision annuelle', actor: owner._id, changes: { montantLoyer: 320000 } });
    expect(updated.montantLoyer).toBe(320000);
    expect(updated.avenants).toHaveLength(1);
    expect(updated.avenants[0].champsModifies[0]).toMatchObject({ champ: 'montantLoyer', avant: 300000, apres: 320000 });
  });

  test('un avenant sans changement réel est rejeté (jamais une entrée vide)', async () => {
    const { contrat, owner } = await buildActiveLease();
    await expect(addAvenant(contrat._id, { type: 'loyer', actor: owner._id, changes: { montantLoyer: 300000 } })).rejects.toMatchObject({ statusCode: 422 });
  });

  test('deux avenants successifs s\'accumulent (jamais d\'écrasement)', async () => {
    const { contrat, owner } = await buildActiveLease();
    await addAvenant(contrat._id, { type: 'loyer', actor: owner._id, changes: { montantLoyer: 320000 } });
    const updated = await addAvenant(contrat._id, { type: 'clauses', actor: owner._id, changes: { notes: 'Clause additionnelle' } });
    expect(updated.avenants).toHaveLength(2);
    expect(updated.avenants[0].type).toBe('loyer');
    expect(updated.avenants[1].type).toBe('clauses');
  });
});

describe('rentalLeaseRenewalService.renewLease — Phase 3 (règle métier validée)', () => {
  test('prolongation (durée/loyer) : même Contrat, avenant "renouvellement", jamais de doublon de paiement', async () => {
    const { contrat, owner } = await buildActiveLease();
    const existingPaiementsCount = await Paiement.countDocuments({ contrat: contrat._id });
    expect(existingPaiementsCount).toBe(0); // aucun paiement pré-généré dans ce fixture

    const result = await renewLease(contrat._id, { actor: owner._id, dateFinBail: new Date('2028-12-31'), montantLoyer: 330000, motif: 'Prolongation standard' });
    expect(result.mode).toBe('prolongation');
    expect(result.ancien).toBeNull();
    expect(result.contrat._id.toString()).toBe(contrat._id.toString());
    expect(result.contrat.dateFinBail.toISOString().slice(0, 10)).toBe('2028-12-31');
    expect(result.contrat.avenants.find((a) => a.type === 'renouvellement')).toBeTruthy();

    const allContrats = await Contrat.countDocuments({ bien: contrat.bien });
    expect(allContrats).toBe(1); // jamais de nouveau Contrat créé pour une simple prolongation

    // Une seconde prolongation (nouvelle échéance plus lointaine) ne doit
    // jamais dupliquer les échéances déjà générées par la première.
    const paiementsAfterFirst = await Paiement.find({ contrat: contrat._id }).select('mois annee').lean();
    await renewLease(contrat._id, { actor: owner._id, dateFinBail: new Date('2029-06-30'), motif: 'Seconde prolongation' });
    const paiementsAfterSecond = await Paiement.find({ contrat: contrat._id }).select('mois annee').lean();
    expect(paiementsAfterSecond.length).toBeGreaterThan(paiementsAfterFirst.length);
    const keys = paiementsAfterSecond.map((p) => `${p.annee}-${p.mois}`);
    expect(new Set(keys).size).toBe(keys.length); // aucune paire (mois, année) en double
  });

  test('changement majeur (locataire) : ancien contrat archivé, nouveau Contrat lié — jamais un simple avenant', async () => {
    const { contrat, owner } = await buildActiveLease();
    const nouveauLocataire = await Locataire.create({ nom: 'Loemba', prenom: 'Marie', telephone: '+242060000099' });

    const result = await renewLease(contrat._id, { actor: owner._id, locataire: nouveauLocataire._id, motif: 'Changement de locataire' });
    expect(result.mode).toBe('nouveau_contrat');
    expect(String(result.contrat._id)).not.toBe(String(contrat._id));
    expect(String(result.contrat.renouvelleDe)).toBe(String(contrat._id));
    expect(String(result.contrat.locataire)).toBe(String(nouveauLocataire._id));

    const ancienFrais = await Contrat.findById(contrat._id);
    expect(ancienFrais.statut).toBe('résilié');
    expect(ancienFrais.cycleVie).toBe('archive');
    expect(String(ancienFrais.renouvelePar)).toBe(String(result.contrat._id));

    // L'index unique (bien+type, statut ouvert) ne doit jamais bloquer cette séquence.
    expect(result.contrat.statut).toBe('actif');
  });

  test('seul un bail actif peut être renouvelé', async () => {
    const { contrat, owner } = await buildActiveLease({ statut: 'en_attente', cycleVie: 'a_signer' });
    await expect(renewLease(contrat._id, { actor: owner._id, dateFinBail: new Date('2028-01-01') })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('rentalLeaseCautionService — Phase 5/6', () => {
  test('cycle complet : encaissement → blocage → retenue → restitution partielle → clôture du bail', async () => {
    const { contrat, owner } = await buildActiveLease();
    await caution.encaisserCaution(contrat._id, { montant: 600000, actor: owner._id });
    let fresh = await Contrat.findById(contrat._id);
    expect(fresh.cautionVersee).toBe(true);
    expect(fresh.caution.statut).toBe('versee');

    await caution.bloquerCaution(contrat._id, { actor: owner._id, comment: 'Préavis démarré' });
    fresh = await Contrat.findById(contrat._id);
    expect(fresh.caution.statut).toBe('bloquee');

    await caution.appliquerRetenue(contrat._id, { montant: 100000, motif: 'Dégradation mur', actor: owner._id });
    fresh = await Contrat.findById(contrat._id);
    expect(fresh.caution.montantRetenu).toBe(100000);

    // La restitution ne peut avoir lieu qu'après l'inspection de sortie (Phase 5).
    await lifecycle.transition(contrat._id, 'preavis', { actor: owner._id });
    await lifecycle.transition(contrat._id, 'inspection_sortie', { actor: owner._id });

    const restitue = await caution.restituerCaution(contrat._id, { montant: 500000, actor: owner._id, comment: 'Solde après retenue' });
    expect(restitue.caution.statut).toBe('partiellement_restituee');
    expect(restitue.caution.montantRestitue).toBe(500000);
    // La restitution referme le cycle de vie jusqu'à 'resilie' (Phase 5 : Clôture).
    expect(restitue.cycleVie).toBe('resilie');
    expect(restitue.statut).toBe('résilié');
  });

  test('la retenue ne peut jamais dépasser le montant de la caution', async () => {
    const { contrat, owner } = await buildActiveLease();
    await caution.encaisserCaution(contrat._id, { actor: owner._id });
    await caution.bloquerCaution(contrat._id, { actor: owner._id });
    await expect(caution.appliquerRetenue(contrat._id, { montant: 999999999, motif: 'Test', actor: owner._id })).rejects.toMatchObject({ statusCode: 422 });
  });

  test('impossible de bloquer une caution jamais encaissée', async () => {
    const { contrat, owner } = await buildActiveLease();
    await expect(caution.bloquerCaution(contrat._id, { actor: owner._id })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('les notifications de cycle de vie et de caution sont créées via le moteur Notification existant (Phase 9)', async () => {
    // notifyStaff() (server/services/notificationService.js) ne notifie que
    // les User dont le rôle est staff — il faut au moins un destinataire
    // réel pour que la notification soit persistée.
    const root = await OrgUnit.create({ name: `GL LIFE notifications ${Date.now()}`, type: 'organization', status: 'active' });
    const tenant = await PlatformTenant.create({ name: root.name, slug: `gl-life-notifications-${Date.now()}`, rootOrgUnit: root._id, status: 'active' });
    const staff = await makeUser({ role: 'Admin' });
    const { contrat, owner } = await buildActiveLease();
    await OrgMembership.create([
      { user: staff._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
      { user: owner._id, orgUnit: tenant.rootOrgUnit, status: 'active' },
    ]);
    await caution.encaisserCaution(contrat._id, { actor: owner._id });
    // La notification est envoyée en "fire-and-forget" (même convention que
    // contratController.create/update) pour ne jamais ralentir l'opération
    // métier si la notification échoue — on attend donc sa propagation
    // asynchrone avant de vérifier sa persistance.
    let notif = null;
    for (let attempt = 0; attempt < 20 && !notif; attempt += 1) {
      notif = await Notification.findOne({ type: 'rental_deposit_encashed', entityId: contrat._id });
      if (!notif) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(notif).toBeTruthy();
  });
});

describe('rentalLeaseDashboardService.getLeaseLifecycleDashboard — Phase 8', () => {
  test('un bail actif proche de l\'échéance apparaît dans le tableau de bord', async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const { contrat } = await buildActiveLease({ dateFinBail: soon });
    const dashboard = await getLeaseLifecycleDashboard();
    expect(dashboard.bauxAEcheance.some((b) => b.contratId === String(contrat._id))).toBe(true);
  });

  test('un préavis non accusé réception apparaît dans "préavis en attente"', async () => {
    const { property, owner } = await buildActiveLease();
    const rental = await RentalManagement.findOne({ property: property._id });
    rental.occupancyStatus = 'sortie_programmee';
    rental.noticeStartedAt = new Date();
    rental.noticeAcknowledgedAt = null;
    await rental.save();
    const dashboard = await getLeaseLifecycleDashboard();
    expect(dashboard.preavisEnAttente.some((p) => p.rentalManagementId === String(rental._id))).toBe(true);
    void owner;
  });
});
