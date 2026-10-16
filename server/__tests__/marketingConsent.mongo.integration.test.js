// MARKETING-CONSENT-1 — Consentement marketing, préférences par canal,
// désinscription, exclusion des comptes supprimés/inactifs, sécurité des
// campagnes et des workflows, suppression de compte côté CRM/marketing.
// Aucun envoi réel : Zoho et Expo Push sont simulés.
jest.mock('../services/zohoMailService', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../utils/expoPush', () => ({ sendExpoPushNotification: jest.fn().mockResolvedValue(true) }));
jest.mock('../utils/email', () => jest.fn().mockResolvedValue(true));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startFinancialMongo, clearFinancialMongo, stopFinancialMongo } = require('./helpers/financialMongoEnvironment');
const User = require('../models/User');
const CrmCustomer = require('../models/CrmCustomer');
const CrmAutomationRule = require('../models/CrmAutomationRule');
const PlatformOperator = require('../models/PlatformOperator');
const MarketingTemplate = require('../models/MarketingTemplate');
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingSend = require('../models/MarketingSend');
const MarketingUnsubscribe = require('../models/MarketingUnsubscribe');
const MarketingConsentEvent = require('../models/MarketingConsentEvent');
const Notification = require('../models/Notification');
const zohoMailService = require('../services/zohoMailService');
const sendEmail = require('../utils/email');
const consent = require('../services/marketingConsentService');
const { createTemplateVersion, activateTemplate } = require('../services/marketingTemplateService');
const { createCampaign, approveCampaign, sendCampaign } = require('../services/marketingCampaignService');
const { synchronizeCustomers } = require('../services/crmService');
const { handleEvent } = require('../services/crmAutomationEngine');
const { notify } = require('../services/notificationService');
const { CONSENT_TEXT_VERSION } = require('../constants/marketingConsent');
const { errorHandler } = require('../middleware/errorMiddleware');

jest.setTimeout(180000);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-marketing-consent';

const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/authRoutes'));
app.use('/api/users', require('../routes/userRoutes'));
app.use('/api/marketing-preferences', require('../routes/marketingPreferencesRoutes'));
app.use(errorHandler);

const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' })}` });

let counter = 0;
const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: 'Consent User', email: `consent${counter}-${Date.now()}@example.test`, phone: `+24206000${String(counter).padStart(4, '0')}`,
    password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', isEmailVerified: true, ...overrides,
  });
};
const makeCustomerForUser = (user, { tenant = null, relations = ['client_hotel'], extraSources = [] } = {}) => CrmCustomer.create({
  tenant, displayName: user.name, emails: [user.email], phones: [user.phone].filter(Boolean),
  identityKeys: [`user:${user._id}`, `email:${user.email}`], relations,
  sourceRefs: [{ entityType: 'User', entityId: user._id, source: 'auth' }, ...extraSources],
});
// LOT E — toute campagne est une campagne Altitude Vision : elle est créée,
// approuvée et envoyée par un PlatformOperator actif détenant
// `platform.marketing.manage`, jamais pour le compte d'un tenant.
const makeMarketingOperator = async () => {
  const user = await makeUser();
  await PlatformOperator.create({ user: user._id, status: 'active', capabilities: ['platform.marketing.manage'], grantedBy: user._id, grantReason: 'TEST DATA consent' });
  return user;
};
const makeActiveTemplate = async ({ channel = 'email', family, actor } = {}) => {
  const template = await createTemplateVersion({ family: family || `consent-${Date.now()}-${Math.random()}`, name: 'Offre', channel, subject: 'Offre {{prenom}}', body: 'Bonjour {{prenom}}', actor });
  return activateTemplate(template._id, { actor });
};
const runCampaign = async ({ channel = 'email', segmentKey = 'clients' } = {}) => {
  const actor = await makeMarketingOperator();
  const template = await makeActiveTemplate({ channel, actor });
  const campaign = await createCampaign({ name: `Campagne ${counter}`, channel, templateId: template._id, segmentKey, actor });
  await approveCampaign(campaign._id, { actor });
  return sendCampaign(campaign._id, { actor });
};
const grant = (user, channels = { email: true, push: true }) => consent.applyConsentChanges(user._id, channels, { source: 'web_settings' });

beforeAll(startFinancialMongo);
afterEach(async () => { jest.clearAllMocks(); await clearFinancialMongo(); });
afterAll(stopFinancialMongo);

describe('Inscription — consentement explicite, jamais implicite', () => {
  const signupAndVerify = async (body) => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'Nouvel Inscrit', password: 'Password123!', passwordConfirm: 'Password123!', role: 'Client', ...body });
    expect(res.status).toBeLessThan(300);
    const verifyUrl = sendEmail.mock.calls.at(-1)[0].message || JSON.stringify(sendEmail.mock.calls.at(-1)[0]);
    const token = /verify-email\/([a-f0-9]{64})/.exec(verifyUrl)[1];
    await request(app).get(`/api/auth/verify-email/${token}`);
    return User.findOne({ email: body.email }).lean();
  };

  test('1. inscription sans case cochée → aucun consentement (statut unknown), aucun événement', async () => {
    const user = await signupAndVerify({ email: `noconsent-${Date.now()}@example.test` });
    expect(user.marketingPreferences.email.status).toBe('unknown');
    expect(user.marketingPreferences.push.status).toBe('unknown');
    expect(await MarketingConsentEvent.countDocuments({ user: user._id })).toBe(0);
  });

  test('2. inscription avec consentement e-mail explicite → granted, source signup, version du texte', async () => {
    const user = await signupAndVerify({ email: `consent-${Date.now()}@example.test`, marketingConsent: { email: true } });
    expect(user.marketingPreferences.email.status).toBe('granted');
    expect(user.marketingPreferences.email.source).toBe('signup');
    expect(user.marketingPreferences.email.textVersion).toBe(CONSENT_TEXT_VERSION);
    expect(user.marketingPreferences.push.status).toBe('unknown');
    const events = await MarketingConsentEvent.find({ user: user._id }).lean();
    expect(events).toEqual([expect.objectContaining({ channel: 'email', previousStatus: 'unknown', status: 'granted', source: 'signup' })]);
  });

  test('une valeur non booléenne ("true", 1) n\'est jamais un consentement', async () => {
    const user = await signupAndVerify({ email: `fake-${Date.now()}@example.test`, marketingConsent: { email: 'true', push: 1 } });
    expect(user.marketingPreferences.email.status).toBe('unknown');
    expect(user.marketingPreferences.push.status).toBe('unknown');
  });
});

describe('Préférences par canal — API authentifiée', () => {
  test('3. consentement distinct par canal et 4. retrait à tout moment, historisé', async () => {
    const user = await makeUser();
    const get = await request(app).get('/api/users/me/marketing-preferences').set(bearer(user));
    expect(get.status).toBe(200);
    expect(get.body.data.preferences.channels.email.status).toBe('unknown');
    expect(Object.keys(get.body.data.preferences.channels)).toEqual(['email', 'push']);

    const on = await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ channels: { email: true, push: false }, client: 'mobile' });
    expect(on.status).toBe(200);
    expect(on.body.data.preferences.channels.email.granted).toBe(true);
    expect(on.body.data.preferences.channels.push.status).toBe('withdrawn');

    const off = await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ channels: { email: false }, client: 'mobile' });
    expect(off.body.data.preferences.channels.email.status).toBe('withdrawn');
    const events = await MarketingConsentEvent.find({ user: user._id, channel: 'email' }).sort({ at: 1 }).lean();
    expect(events.map((e) => [e.previousStatus, e.status, e.source])).toEqual([['unknown', 'granted', 'mobile_settings'], ['granted', 'withdrawn', 'mobile_settings']]);
  });

  test('401 sans authentification ; 400 sans préférence valide ; aucun identifiant accepté du client', async () => {
    expect((await request(app).get('/api/users/me/marketing-preferences')).status).toBe(401);
    const user = await makeUser();
    const other = await makeUser();
    const bad = await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ channels: { sms: true } });
    expect(bad.status).toBe(400);
    await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ userId: String(other._id), channels: { email: true } });
    expect((await User.findById(other._id).lean()).marketingPreferences.email.status).toBe('unknown');
  });

  test('15. idempotence : un même choix répété ne produit aucun nouvel événement', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    await grant(user, { email: true });
    expect(await MarketingConsentEvent.countDocuments({ user: user._id })).toBe(1);
  });
});

describe('Désinscription par lien e-mail', () => {
  test('5. jeton valide → retrait e-mail immédiat, suppression enregistrée, idempotent', async () => {
    const user = await makeUser();
    await grant(user, { email: true, push: true });
    const token = consent.createUnsubscribeToken({ userId: user._id, channel: 'email' });
    const first = await request(app).post('/api/marketing-preferences/unsubscribe').send({ token });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/marketing-preferences/unsubscribe').send({ token });
    expect(second.status).toBe(200);
    const fresh = await User.findById(user._id).lean();
    expect(fresh.marketingPreferences.email.status).toBe('withdrawn');
    expect(fresh.marketingPreferences.email.source).toBe('email_unsubscribe_link');
    expect(fresh.marketingPreferences.push.status).toBe('granted');
    expect(await MarketingUnsubscribe.countDocuments({ email: user.email })).toBe(1);
    expect(await MarketingConsentEvent.countDocuments({ user: user._id, channel: 'email', status: 'withdrawn' })).toBe(1);
  });

  test('jeton altéré, forgé ou absent → 400, aucune modification', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    const token = consent.createUnsubscribeToken({ userId: user._id, channel: 'email' });
    const other = await makeUser();
    const forgedPayload = Buffer.from(JSON.stringify({ v: 1, u: String(other._id), c: 'email' })).toString('base64url');
    for (const bad of [`${token}x`, `${forgedPayload}.${token.split('.')[1]}`, '', undefined]) {
      const res = await request(app).post('/api/marketing-preferences/unsubscribe').send({ token: bad });
      expect(res.status).toBe(400);
    }
    expect((await User.findById(user._id).lean()).marketingPreferences.email.status).toBe('granted');
  });

  test('un GET (préchargement de lien) ne désinscrit jamais', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    const token = consent.createUnsubscribeToken({ userId: user._id, channel: 'email' });
    const res = await request(app).get(`/api/marketing-preferences/unsubscribe?token=${token}`);
    expect(res.status).toBe(404);
    expect((await User.findById(user._id).lean()).marketingPreferences.email.status).toBe('granted');
  });
});

describe('Sécurité des campagnes — sélection ET juste avant l\'envoi', () => {
  test('seuls les comptes consentants reçoivent ; les autres sont exclus avec un code non nominatif', async () => {
    const yes = await makeUser();
    const no = await makeUser();
    await grant(yes, { email: true });
    await makeCustomerForUser(yes);
    await makeCustomerForUser(no);
    const sent = await runCampaign();
    expect(sent.stats.sentCount).toBe(1);
    expect(sent.stats.excludedCount).toBe(1);
    expect(zohoMailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(zohoMailService.sendEmail.mock.calls[0][1]).toBe(yes.email);
    const excluded = await MarketingSend.findOne({ recipientUser: no._id }).lean();
    expect(excluded).toEqual(expect.objectContaining({ status: 'unsubscribed', error: 'CONSENT_NOT_GRANTED', recipientEmail: null }));
  });

  test('6. compte supprimé et 7. comptes désactivés/suspendus/techniques exclus malgré un consentement', async () => {
    const deleted = await makeUser();
    const suspended = await makeUser();
    const inactive = await makeUser();
    const technical = await makeUser();
    for (const u of [deleted, suspended, inactive, technical]) {
      await grant(u, { email: true });
      await makeCustomerForUser(u);
    }
    await User.updateOne({ _id: suspended._id }, { status: 'Suspendu' });
    await User.updateOne({ _id: inactive._id }, { isActive: false });
    await User.updateOne({ _id: technical._id }, { isTechnical: true });
    expect((await request(app).delete('/api/users/me').set(bearer(deleted))).status).toBe(200);

    const sent = await runCampaign();
    expect(sent.stats.sentCount).toBe(0);
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    const reasons = (await MarketingSend.find({ campaign: sent._id }).lean()).map((s) => s.error).sort();
    expect(reasons).toEqual(expect.arrayContaining(['ACCOUNT_INACTIVE', 'ACCOUNT_INACTIVE', 'TECHNICAL_ACCOUNT']));
    // La fiche du compte supprimé est archivée : elle ne fait même plus partie du segment.
    expect(reasons).toHaveLength(3);
  });

  test('8. campagne déjà approuvée : un retrait de consentement avant l\'envoi bloque le destinataire', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    await makeCustomerForUser(user);
    const actor = await makeMarketingOperator();
    const template = await makeActiveTemplate({ actor });
    const campaign = await createCampaign({ name: 'Préparée', channel: 'email', templateId: template._id, segmentKey: 'clients', actor });
    await approveCampaign(campaign._id, { actor });
    await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ channels: { email: false } });
    const sent = await sendCampaign(campaign._id, { actor });
    expect(sent.stats.sentCount).toBe(0);
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
  });

  test('push/notification marketing : exige le consentement push, distinct de l\'e-mail', async () => {
    const emailOnly = await makeUser();
    const pushToo = await makeUser();
    await grant(emailOnly, { email: true });
    await grant(pushToo, { push: true });
    await makeCustomerForUser(emailOnly);
    await makeCustomerForUser(pushToo);
    const sent = await runCampaign({ channel: 'notification' });
    expect(sent.stats.sentCount).toBe(1);
    expect(await Notification.countDocuments({ type: 'marketing_message', recipient: pushToo._id })).toBe(1);
    expect(await Notification.countDocuments({ type: 'marketing_message', recipient: emailOnly._id })).toBe(0);
  });

  test('fiche CRM sans compte lié (consentement invérifiable) exclue ; doublon d\'un même compte servi une seule fois', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    await makeCustomerForUser(user);
    await CrmCustomer.create({ displayName: 'Doublon', emails: [user.email], identityKeys: [`user:${user._id}`, 'source:Locataire:x'], relations: ['client_hebergement'], sourceRefs: [{ entityType: 'Locataire', entityId: new mongoose.Types.ObjectId(), source: 'gestion_locative' }], tenant: new mongoose.Types.ObjectId() });
    await CrmCustomer.create({ displayName: 'Contact formulaire', emails: ['prospect@example.test'], identityKeys: ['email:prospect@example.test'], relations: ['client_altcom'] });
    const sent = await runCampaign();
    expect(sent.stats.sentCount).toBe(1);
    const errors = (await MarketingSend.find({ campaign: sent._id, status: { $ne: 'sent' } }).lean()).map((s) => s.error).sort();
    expect(errors).toEqual(['DUPLICATE_RECIPIENT', 'NO_LINKED_ACCOUNT']);
  });

  test('11. isolation : le consentement est celui d\'Altitude Vision — aucune campagne ne peut être rattachée à un tenant, et une campagne plateforme ne sert chaque compte consentant qu\'une fois', async () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    const inA = await makeUser();
    const inB = await makeUser();
    const refused = await makeUser();
    await grant(inA, { email: true });
    await grant(inB, { email: true });
    await makeCustomerForUser(inA, { tenant: tenantA });
    await makeCustomerForUser(inB, { tenant: tenantB });
    await makeCustomerForUser(refused, { tenant: tenantA });
    await makeCustomerForUser(inA, { tenant: tenantB });

    const actor = await makeMarketingOperator();
    const template = await makeActiveTemplate({ actor });
    await expect(createCampaign({ name: 'Tenant A', channel: 'email', templateId: template._id, segmentKey: 'clients', actor, tenantId: tenantA }))
      .rejects.toMatchObject({ code: 'MARKETING_TENANT_SCOPE_FORBIDDEN' });

    const sent = await runCampaign();
    expect(sent.tenant).toBeNull();
    expect(zohoMailService.sendEmail.mock.calls.map((c) => c[1]).sort()).toEqual([inA.email, inB.email].sort());
    const reasons = (await MarketingSend.find({ campaign: sent._id, status: { $ne: 'sent' } }).lean()).map((s) => s.error).sort();
    expect(reasons).toEqual(['CONSENT_NOT_GRANTED', 'DUPLICATE_RECIPIENT']);
    const summary = await consent.summarizeEligibility((await CrmCustomer.find().distinct('_id')).map(String), { campaignChannel: 'email', tenantId: tenantA });
    expect(summary.excluded.OUT_OF_TENANT_SCOPE).toBe(2);
  });

  test('workflow marketing automatisé : refusé par le moteur ; l\'action, appelée directement, applique toujours le consentement', async () => {
    const user = await makeUser();
    const tenantId = new mongoose.Types.ObjectId();
    await makeCustomerForUser(user, { tenant: tenantId, relations: ['prospect'] });
    const family = `wf-${Date.now()}`;
    await MarketingTemplate.create({ tenant: tenantId, family, name: 'Historique tenant', channel: 'email', body: 'Promo', status: 'active', version: 1 });
    await CrmAutomationRule.create({ tenant: tenantId, ruleId: 'wf-consent', label: 'WF', triggerEvent: 'quote_received', actions: [{ actionId: 'marketing.message.send', params: { templateFamily: family, channel: 'email' } }] });
    const results = await handleEvent({ type: 'quote_received', recipient: user._id, sender: user._id, metadata: {}, platformTenantId: tenantId });
    expect(results[0]).toMatchObject({ status: 'error', error: expect.stringMatching(/CRM_MARKETING_ACTION_FORBIDDEN/) });
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    expect(await MarketingSend.countDocuments()).toBe(0);

    // Défense en profondeur : même hors moteur, l'action exclut un compte
    // sans consentement et n'envoie rien.
    const { ACTION_HANDLERS } = require('../services/crmAutomationActions');
    const outcome = await ACTION_HANDLERS['marketing.message.send']({ type: 'quote_received', recipient: user._id, platformTenantId: tenantId }, { templateFamily: family, channel: 'email' });
    expect(outcome).toEqual({ status: 'skipped', reason: 'CONSENT_NOT_GRANTED' });
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
  });

  test('13. journal et erreurs sans donnée personnelle ; e-mail envoyé avec lien de désinscription signé', async () => {
    const user = await makeUser();
    const refused = await makeUser();
    await grant(user, { email: true });
    await makeCustomerForUser(user);
    await makeCustomerForUser(refused);
    const sent = await runCampaign();
    const journal = JSON.stringify(await MarketingSend.find({ campaign: sent._id }).lean());
    expect(journal).not.toContain(user.email);
    expect(journal).not.toContain(refused.email);
    const html = zohoMailService.sendEmail.mock.calls[0][3];
    const token = /desinscription-marketing\?token=([A-Za-z0-9_.-]+)/.exec(html)[1];
    expect(consent.verifyUnsubscribeToken(token)).toEqual({ userId: String(user._id), channel: 'email' });
    expect(token).not.toContain(user.email);
  });
});

describe('Aucune réinscription automatique ; communications opérationnelles préservées', () => {
  test('9. updateMe, complete-profile sans case cochée et synchronisation CRM ne réabonnent jamais', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ channels: { email: false } });
    await request(app).patch('/api/users/updateMe').set(bearer(user)).send({ name: 'Nom Modifié', marketingPreferences: { email: { status: 'granted' } } });
    await request(app).patch('/api/users/complete-profile').set(bearer(user)).send({ prenom: 'A', nom: 'B', telephone: '+242066000001', role: 'Client', marketingConsent: { email: false } });
    await synchronizeCustomers(null, {});
    const fresh = await User.findById(user._id).lean();
    expect(fresh.marketingPreferences.email.status).toBe('withdrawn');
  });

  test('10. un refus marketing ne bloque pas les notifications opérationnelles', async () => {
    const user = await makeUser();
    await request(app).patch('/api/users/me/marketing-preferences').set(bearer(user)).send({ channels: { email: false, push: false } });
    await notify({ recipient: user._id, type: 'visite_status', title: 'Visite confirmée', body: 'Votre visite est confirmée.' });
    expect(await Notification.countDocuments({ recipient: user._id, type: 'visite_status' })).toBe(1);
  });
});

describe('Suppression de compte — CRM, marketing et conservation justifiée', () => {
  test('12. le CRM est détaché : fiche issue du seul compte anonymisée/archivée, fiche multi-source purgée des coordonnées du compte, aucune réimportation', async () => {
    const user = await makeUser();
    const tenant = new mongoose.Types.ObjectId();
    const onlyAccount = await makeCustomerForUser(user);
    const proprietaireId = new mongoose.Types.ObjectId();
    const multi = await CrmCustomer.create({
      tenant, displayName: 'Fiche gestion locative', emails: [user.email, 'bureau@example.test'], phones: [user.phone],
      identityKeys: [`user:${user._id}`, `email:${user.email}`, 'email:bureau@example.test'], relations: ['proprietaire'],
      sourceRefs: [{ entityType: 'User', entityId: user._id, source: 'auth' }, { entityType: 'Proprietaire', entityId: proprietaireId, source: 'gestion_locative' }],
    });
    await MarketingSend.create({ template: new mongoose.Types.ObjectId(), channel: 'email', recipientCustomer: onlyAccount._id, recipientEmail: user.email, status: 'sent' });
    await MarketingUnsubscribe.create({ email: user.email });

    expect((await request(app).delete('/api/users/me').set(bearer(user))).status).toBe(200);

    const a = await CrmCustomer.findById(onlyAccount._id).lean();
    expect(a).toEqual(expect.objectContaining({ displayName: 'Contact supprimé', emails: [], phones: [], status: 'archived', identityKeys: [`user:${user._id}`] }));
    const m = await CrmCustomer.findById(multi._id).lean();
    expect(m.emails).toEqual(['bureau@example.test']);
    expect(m.phones).toEqual([]);
    expect(m.identityKeys).not.toContain(`email:${user.email}`);
    expect(m.displayName).toBe('Fiche gestion locative');
    expect(await MarketingSend.countDocuments({ recipientEmail: user.email })).toBe(0);
    expect(await MarketingUnsubscribe.countDocuments({ email: user.email })).toBe(0);

    await synchronizeCustomers(null, {});
    expect(await CrmCustomer.countDocuments({ emails: user.email })).toBe(0);
    const fresh = await User.findById(user._id).lean();
    expect(['email', 'push', 'sms', 'whatsapp'].map((c) => fresh.marketingPreferences[c].status)).toEqual(['withdrawn', 'withdrawn', 'withdrawn', 'withdrawn']);
    expect(await MarketingConsentEvent.countDocuments({ user: user._id, source: 'account_deletion' })).toBe(4);
  });

  test('14. contrat d\'hébergement conservé (preuve), IP/engagements effacés sans contrat ; 15. suppression idempotente', async () => {
    const owner = await makeUser({ role: 'Proprietaire', contratAccepte: true, ipInscription: '203.0.113.7', certifications: { informationsVraies: true, estProprietaireLegal: true, engagementHonnetete: true, commissionAcceptee: true } });
    await User.updateOne({ _id: owner._id }, { contratPdfAsset: { purpose: 'administrative', publicId: 'contrats/x', resourceType: 'raw' } });
    const client = await makeUser({ ipInscription: '198.51.100.9', certifications: { informationsVraies: true } });

    for (const u of [owner, client]) {
      expect((await request(app).delete('/api/users/me').set(bearer(u))).status).toBe(200);
    }
    // Un compte supprimé ne peut plus s'authentifier (protect → 403) ; la
    // répétition est donc vérifiée au niveau du service.
    expect((await request(app).delete('/api/users/me').set(bearer(await User.findById(client._id)))).status).toBe(403);
    const again = await require('../services/accountSelfDeletionService').deleteMyAccount({ authenticatedUserId: client._id });
    expect(again.alreadyDeleted).toBe(true);

    const keptOwner = await User.findById(owner._id).select('+contratPdfAsset ipInscription certifications status email').lean();
    expect(keptOwner.status).toBe('Supprimé');
    expect(keptOwner.contratPdfAsset).toEqual(expect.objectContaining({ purpose: 'administrative' }));
    expect(keptOwner.ipInscription).toBe('203.0.113.7');
    expect(keptOwner.certifications.estProprietaireLegal).toBe(true);

    const cleanedClient = await User.findById(client._id).select('ipInscription certifications').lean();
    expect(cleanedClient.ipInscription).toBeUndefined();
    expect(cleanedClient.certifications).toBeUndefined();
    expect(await consent.unsubscribeWithToken(consent.createUnsubscribeToken({ userId: client._id }))).toEqual({ channel: 'email' });
  });

  test('aucune campagne ne cible un compte supprimé même si sa fiche CRM est restée active', async () => {
    const user = await makeUser();
    await grant(user, { email: true });
    const customer = await makeCustomerForUser(user, { extraSources: [{ entityType: 'Locataire', entityId: new mongoose.Types.ObjectId(), source: 'gestion_locative' }] });
    await request(app).delete('/api/users/me').set(bearer(user));
    await CrmCustomer.updateOne({ _id: customer._id }, { $push: { emails: 'reimport@example.test' } });
    const sent = await runCampaign();
    expect(sent.stats.sentCount).toBe(0);
    expect(zohoMailService.sendEmail).not.toHaveBeenCalled();
    expect(await MarketingCampaign.countDocuments({ status: 'sent' })).toBe(1);
  });
});
