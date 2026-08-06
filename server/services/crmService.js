const mongoose = require('mongoose');
const CrmCustomer = require('../models/CrmCustomer');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmActivity = require('../models/CrmActivity');
const User = require('../models/User');
const Proprietaire = require('../models/Proprietaire');
const Locataire = require('../models/Locataire');
const ContactMessage = require('../models/ContactMessage');
const QuoteRequest = require('../models/QuoteRequest');
const AltcomProject = require('../models/AltcomProject');
const Property = require('../models/Property');
const Contrat = require('../models/Contrat');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Visite = require('../models/Visite');
const Transaction = require('../models/Transaction');
const AccommodationReservation = require('../models/AccommodationReservation');
const HotelReservation = require('../models/HotelReservation');
const FinancialDocument = require('../models/FinancialDocument');
const { buildTimeline } = require('./dossier/dossierRegistry');
const { notify } = require('./notificationService');

class CrmError extends Error { constructor(message, statusCode = 400, code = 'CRM_ERROR') { super(message); this.statusCode = statusCode; this.code = code; } }
const clean = (value) => String(value || '').trim();
const emailKey = (value) => { const v = clean(value).toLowerCase(); return v ? `email:${v}` : null; };
const uniq = (values) => [...new Set(values.filter(Boolean))];
const escapeRx = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sourceRecord(entityType, row, fields, relations, source) {
  const email = clean(row[fields.email]); const phone = clean(row[fields.phone]);
  const displayName = clean(row[fields.name]) || clean([row[fields.firstName], row[fields.lastName]].filter(Boolean).join(' ')) || clean(row[fields.company]) || email || phone || 'Contact sans nom';
  return {
    entityType, entityId: row._id, source, displayName,
    firstName: clean(row[fields.firstName]), lastName: clean(row[fields.lastName]), company: clean(row[fields.company]),
    email, phone, address: clean(row[fields.address]), city: clean(row[fields.city]),
    // Une fusion automatique exige une preuve stable : email normalisé ou
    // liaison User explicite. Un téléphone peut être familial/professionnel
    // partagé et reste donc recherchable, sans devenir une clé de fusion.
    identityKeys: uniq([emailKey(email), row.linkedUser ? `user:${row.linkedUser}` : null, entityType === 'User' ? `user:${row._id}` : null, (!email && !row.linkedUser && entityType !== 'User') ? `source:${entityType}:${row._id}` : null]), relations,
  };
}

async function loadIdentitySources() {
  const [users, owners, tenants, contacts, quotes, projects] = await Promise.all([
    User.find({ isTechnical: { $ne: true } }).select('name email phone role').lean(),
    Proprietaire.find().select('nom prenom email telephone adresse ville user').lean(),
    Locataire.find().select('nom prenom email telephone adresse ville user').lean(),
    ContactMessage.find().select('name email phone').lean(),
    QuoteRequest.find().select('name email phone source projectDetails.clientInfo.company').lean(),
    AltcomProject.find().select('contactName companyName email phone').lean(),
  ]);
  return [
    ...users.map((r) => sourceRecord('User', r, { name: 'name', email: 'email', phone: 'phone' }, r.role === 'Prestataire' ? ['prestataire'] : ['prospect'], 'auth')),
    ...owners.map((r) => sourceRecord('Proprietaire', { ...r, linkedUser: r.user }, { firstName: 'prenom', lastName: 'nom', email: 'email', phone: 'telephone', address: 'adresse', city: 'ville' }, ['proprietaire'], 'gestion_locative')),
    ...tenants.map((r) => sourceRecord('Locataire', { ...r, linkedUser: r.user }, { firstName: 'prenom', lastName: 'nom', email: 'email', phone: 'telephone', address: 'adresse', city: 'ville' }, ['locataire'], 'gestion_locative')),
    ...contacts.map((r) => sourceRecord('ContactMessage', r, { name: 'name', email: 'email', phone: 'phone' }, ['prospect'], 'contact')),
    ...quotes.map((r) => sourceRecord('QuoteRequest', { ...r, company: r.projectDetails?.clientInfo?.company }, { name: 'name', email: 'email', phone: 'phone', company: 'company' }, r.source === 'Altcom' ? ['client_altcom', 'prospect'] : ['organisateur', 'prospect'], r.source || 'devis')),
    ...projects.map((r) => sourceRecord('AltcomProject', r, { name: 'contactName', company: 'companyName', email: 'email', phone: 'phone' }, ['client_altcom'], 'altcom')),
  ];
}

async function synchronizeCustomers(actor = null) {
  const records = await loadIdentitySources();
  const stats = { scanned: records.length, created: 0, updated: 0, skippedWithoutIdentity: 0, conflicts: [] };
  for (const record of records) {
    if (!record.identityKeys.length) { stats.skippedWithoutIdentity += 1; continue; }
    const bySource = await CrmCustomer.findOne({ sourceRefs: { $elemMatch: { entityType: record.entityType, entityId: record.entityId } } });
    const matches = await CrmCustomer.find({ identityKeys: { $in: record.identityKeys } }).limit(3);
    const candidates = uniq([bySource?._id?.toString(), ...matches.map((c) => c._id.toString())]);
    if (candidates.length > 1) {
      await CrmCustomer.updateMany({ _id: { $in: candidates } }, { $set: { status: 'merge_review' } });
      stats.conflicts.push({ source: `${record.entityType}:${record.entityId}`, customerIds: candidates });
      continue;
    }
    const customer = bySource || matches[0] || new CrmCustomer();
    customer.displayName = customer.displayName || record.displayName;
    customer.firstName = customer.firstName || record.firstName;
    customer.lastName = customer.lastName || record.lastName;
    customer.company = customer.company || record.company;
    customer.emails = uniq([...(customer.emails || []), record.email]);
    customer.phones = uniq([...(customer.phones || []), record.phone]);
    customer.identityKeys = uniq([...(customer.identityKeys || []), ...record.identityKeys]);
    customer.relations = uniq([...(customer.relations || []), ...record.relations]);
    if (record.address && !(customer.addresses || []).some((a) => a.line === record.address && a.city === record.city)) customer.addresses.push({ label: record.source, line: record.address, city: record.city });
    if (!(customer.sourceRefs || []).some((r) => r.entityType === record.entityType && r.entityId.toString() === record.entityId.toString())) customer.sourceRefs.push({ entityType: record.entityType, entityId: record.entityId, source: record.source });
    customer.audit.push({ action: customer.isNew ? 'customer_indexed' : 'source_linked', actor, metadata: { entityType: record.entityType, entityId: record.entityId } });
    const wasNew = customer.isNew;
    await customer.save();
    stats[wasNew ? 'created' : 'updated'] += 1;
  }
  return stats;
}

async function listCustomers({ search = '', page = 1, limit = 25, relation, stage } = {}) {
  const filter = { status: { $ne: 'archived' } };
  if (relation) filter.relations = relation;
  if (search) { const rx = new RegExp(escapeRx(clean(search)), 'i'); filter.$or = [{ displayName: rx }, { company: rx }, { emails: rx }, { phones: rx }]; }
  if (stage) {
    const ids = await CrmOpportunity.distinct('customer', { stage });
    filter._id = { $in: ids };
  }
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25)); const safePage = Math.max(1, Number(page) || 1);
  const [customers, total] = await Promise.all([
    CrmCustomer.find(filter).populate('owner', 'name email').sort({ updatedAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    CrmCustomer.countDocuments(filter),
  ]);
  const opportunityCounts = await CrmOpportunity.aggregate([{ $match: { customer: { $in: customers.map((c) => c._id) } } }, { $group: { _id: '$customer', count: { $sum: 1 }, stages: { $addToSet: '$stage' } } }]);
  const map = new Map(opportunityCounts.map((x) => [String(x._id), x]));
  return { customers: customers.map((c) => ({ ...c, opportunities: map.get(String(c._id)) || { count: 0, stages: [] } })), total, page: safePage, limit: safeLimit };
}

async function getCustomer360(customerId) {
  if (!mongoose.isValidObjectId(customerId)) throw new CrmError('Identifiant Customer invalide.', 400);
  const customer = await CrmCustomer.findById(customerId).populate('owner', 'name email').lean();
  if (!customer) throw new CrmError('Customer introuvable.', 404);
  const refs = (type) => customer.sourceRefs.filter((r) => r.entityType === type).map((r) => r.entityId);
  const userIds = refs('User'); const ownerIds = refs('Proprietaire'); const tenantIds = refs('Locataire'); const emails = customer.emails || [];
  const [properties, contracts, visits, transactions, stays, hotelStays, financialDocs, conversations, messages, notifications, opportunities, activities, contacts, quotes, projects] = await Promise.all([
    Property.find({ owner: { $in: userIds } }).select('title type status availability owner createdAt').lean(),
    Contrat.find({ $or: [{ locataire: { $in: tenantIds } }, { proprietaire: { $in: ownerIds } }] }).select('type statut montantLoyer dateEntree dateFinBail bien createdAt').lean(),
    Visite.find({ client: { $in: userIds } }).select('property statut scheduledStartAt createdAt').lean(),
    Transaction.find({ client: { $in: userIds } }).select('property status finalAmount transactionType transactionDate').lean(),
    AccommodationReservation.find({ $or: [{ guest: { $in: userIds } }, { user: { $in: userIds } }, { email: { $in: emails } }] }).select('status totalAmount checkIn checkOut createdAt').lean(),
    HotelReservation.find({ $or: [{ customer: { $in: userIds } }, { user: { $in: userIds } }, { guestEmail: { $in: emails } }] }).select('status totalAmount checkIn checkOut createdAt').lean(),
    FinancialDocument.find({ $or: [{ 'customer.userId': { $in: userIds } }, { 'customer.email': { $in: emails } }] }).select('documentType documentNumber status currency totalMinor amountAllocatedMinor refundedAmountMinor balanceMinor issueDate createdAt').lean(),
    Conversation.find({ participants: { $in: userIds } }).select('lastMessage relatedProperty relatedEvent updatedAt').lean(),
    Message.find({ $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }] }).select('subject content conversation createdAt').sort({ createdAt: -1 }).limit(50).lean(),
    Notification.find({ recipient: { $in: userIds } }).select('type title destination entityType entityId createdAt').sort({ createdAt: -1 }).limit(50).lean(),
    CrmOpportunity.find({ customer: customer._id }).populate('assignedTo', 'name').sort({ updatedAt: -1 }).lean(),
    CrmActivity.find({ customer: customer._id }).populate('assignedTo createdBy', 'name').sort({ dueAt: 1, createdAt: -1 }).lean(),
    ContactMessage.find({ email: { $in: emails } }).select('subject status submittedAt').lean(),
    QuoteRequest.find({ email: { $in: emails } }).select('source service status date createdAt').lean(),
    AltcomProject.find({ email: { $in: emails } }).select('projectName projectType status submittedAt').lean(),
  ]);
  const revenueMinor = financialDocs.reduce((n, d) => n + (d.amountAllocatedMinor || 0) - (d.refundedAmountMinor || 0), 0);
  const timeline = buildTimeline([
    ...customer.sourceRefs.map((r) => ({ date: customer.createdAt, label: `Source ${r.entityType} reliée`, type: 'identity', meta: { entityType: r.entityType, entityId: r.entityId } })),
    ...properties.map((x) => ({ date: x.createdAt, label: `Bien : ${x.title}`, type: 'property', meta: { id: x._id } })),
    ...contracts.map((x) => ({ date: x.createdAt, label: `Contrat ${x.type}`, type: 'contract', meta: { id: x._id, status: x.statut } })),
    ...visits.map((x) => ({ date: x.scheduledStartAt || x.createdAt, label: 'Visite immobilière', type: 'visit', meta: { id: x._id, status: x.statut } })),
    ...financialDocs.map((x) => ({ date: x.issueDate || x.createdAt, label: `${x.documentType} ${x.documentNumber || ''}`.trim(), type: 'financial_document', meta: { id: x._id, status: x.status } })),
    ...messages.map((x) => ({ date: x.createdAt, label: x.subject || 'Message', type: 'message', meta: { id: x._id, conversation: x.conversation } })),
    ...activities.map((x) => ({ date: x.dueAt || x.createdAt, label: x.title, type: `crm_${x.type}`, meta: { id: x._id, status: x.status } })),
  ]);
  return {
    customer,
    relations: { properties, contracts, visits, transactions, accommodationReservations: stays, hotelReservations: hotelStays, contacts, quotes, altcomProjects: projects },
    communication: { conversations, messages, notifications, channels: { email: emails.length > 0, sms: customer.phones.length > 0, whatsapp: 'prepared', calls: customer.phones.length > 0 } },
    finance: { currency: 'XAF', revenueMinor, refundsMinor: financialDocs.reduce((n, d) => n + (d.refundedAmountMinor || 0), 0), outstandingMinor: financialDocs.reduce((n, d) => n + (d.balanceMinor || 0), 0), expensesMinor: null, documents: financialDocs },
    dossiers: [...properties.map((x) => ({ domain: 'bien', entityId: x._id, label: x.title })), ...contracts.map((x) => ({ domain: 'gestion_locative', entityId: x._id, label: `Contrat ${x.type}` }))],
    opportunities, activities, timeline,
  };
}

async function createOpportunity(customerId, payload, actor) {
  if (!await CrmCustomer.exists({ _id: customerId })) throw new CrmError('Customer introuvable.', 404);
  return CrmOpportunity.create({ customer: customerId, title: payload.title, pole: payload.pole, stage: payload.stage || 'prospect', valueMinor: payload.valueMinor || 0, currency: payload.currency || 'XAF', probability: payload.probability || 0, expectedCloseAt: payload.expectedCloseAt || null, assignedTo: payload.assignedTo || actor, sourceRef: payload.sourceRef, history: [{ to: payload.stage || 'prospect', actor, note: payload.note || 'Création' }] });
}
async function moveOpportunity(id, { stage, note }, actor) {
  const item = await CrmOpportunity.findById(id); if (!item) throw new CrmError('Opportunité introuvable.', 404);
  const from = item.stage; item.stage = stage; item.history.push({ from, to: stage, actor, note });
  if (stage === 'ancien_client') item.closedAt = new Date(); await item.save(); return item;
}
async function createActivity(customerId, payload, actor) {
  if (!await CrmCustomer.exists({ _id: customerId })) throw new CrmError('Customer introuvable.', 404);
  const activity = await CrmActivity.create({ customer: customerId, opportunity: payload.opportunity || null, type: payload.type, title: payload.title, content: payload.content || '', dueAt: payload.dueAt || null, assignedTo: payload.assignedTo || actor, createdBy: actor, history: [{ action: 'created', actor }] });
  await notify({ recipient: activity.assignedTo, sender: actor, type: 'crm_activity_assigned', title: 'Nouvelle activité CRM', body: activity.title, destination: 'CRM_CUSTOMER_DETAILS', entityType: 'crmCustomer', entityId: customerId, audience: 'staff', dedupeKey: `crm-activity:${activity._id}` }).catch(() => {});
  return activity;
}
async function updateActivity(id, payload, actor) {
  const item = await CrmActivity.findById(id); if (!item) throw new CrmError('Activité introuvable.', 404);
  ['status', 'dueAt', 'assignedTo', 'title', 'content'].forEach((key) => { if (payload[key] !== undefined) item[key] = payload[key]; });
  if (item.status === 'terminee' && !item.completedAt) item.completedAt = new Date(); item.history.push({ action: 'updated', actor, metadata: payload }); await item.save(); return item;
}

module.exports = { CrmError, synchronizeCustomers, listCustomers, getCustomer360, createOpportunity, moveOpportunity, createActivity, updateActivity };
