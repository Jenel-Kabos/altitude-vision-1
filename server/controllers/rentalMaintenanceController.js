// server/controllers/rentalMaintenanceController.js — Sprint GL-B2
//
// Contrôleurs fins : toute la logique reste dans rentalMaintenanceService.js.
// Ownership : propriétaire du bien (Property.owner, compte User self-service)
// ou staff (ROLES_GL, même périmètre que rentalManagementRoutes).

const mongoose = require('mongoose');
const Property = require('../models/Property');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const rentalMaintenanceService = require('../services/rentalMaintenanceService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { ROLES_GL } = require('../utils/roles');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { readPrivateAsset } = require('../services/storage/secureStorageService');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

async function assertPropertyAccess(req, propertyId) {
  const property = await Property.findById(propertyId);
  if (!property) return { error: 404 };
  const isOwner = property.owner && String(property.owner) === String(req.user.id);
  if (!isOwner && !ROLES_GL.includes(req.user.role)) return { error: 403 };
  if (ROLES_GL.includes(req.user.role)) {
    // TENANT-SCOPE-AUDIT-2A — même correction que propertyController.js :
    // un `Property.owner` sans OrgMembership n'est pas une preuve
    // d'appartenance à un AUTRE tenant, juste une absence de frontière
    // traçable. Réutilise la primitive fail-open déjà certifiée.
    try { await assertResourceTenantOrUnattributed({ resourceType: 'Property', resource: property, tenantId: req.platformTenant?._id }); }
    catch { return { error: 403 }; }
  }
  return { property };
}

const safeTicket = (value) => {
  const data = value?.toObject ? value.toObject() : { ...value };
  data.attachments = (data.attachments || []).map((attachment, index) => ({ nom: attachment.nom,
    mimeType: attachment.asset?.mimeType, size: attachment.asset?.size, legacy: !attachment.asset,
    canPreview: Boolean(attachment.asset || attachment.url), canDownload: Boolean(attachment.asset || attachment.url),
    previewEndpoint: `/api/rental-maintenance/${data._id}/attachments/${index}`,
    downloadEndpoint: `/api/rental-maintenance/${data._id}/attachments/${index}?download=1` }));
  return data;
};

async function loadTicketWithAccess(req, ticketId) {
  if (!mongoose.isValidObjectId(ticketId)) return { error: 400 };
  const ticket = await RentalMaintenanceTicket.findById(ticketId);
  if (!ticket) return { error: 404 };
  const { error } = await assertPropertyAccess(req, ticket.property);
  if (error) return { error };
  return { ticket };
}

// ─────────────────────────────────────────────
// GET /api/rental-maintenance
// ─────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const isStaff = ROLES_GL.includes(req.user.role);
    const { propertyId, status, priority, category } = req.query;

    const query = {};
    if (propertyId) {
      if (!mongoose.isValidObjectId(propertyId)) return fail(res, 400, 'Identifiant invalide.');
      const { error } = await assertPropertyAccess(req, propertyId);
      if (error === 404) return fail(res, 404, 'Bien introuvable.');
      if (error === 403) return fail(res, 403, 'Vous ne pouvez consulter que vos propres biens.');
      query.property = propertyId;
    } else {
      // HOTFIX-RENTAL-MANAGEMENT-DASHBOARD-SEMANTICS-1 — la vue d'ensemble
      // staff appelle cette liste sans propertyId. `requireTenantScope` a
      // déjà résolu l'autorité canonique dans `req.tenantScopeUserIds` : la
      // liste doit donc dériver ses Property de ce scope, exactement comme
      // les autres lectures Gestion locative, jamais retomber sur `{}`.
      // Un scope staff vide reste volontairement fail-closed (`$in: []`).
      const ownerIds = isStaff ? (req.tenantScopeUserIds || []) : [req.user.id];
      const properties = await Property.find({ owner: { $in: ownerIds } }).select('_id');
      query.property = { $in: properties.map((p) => p._id) };
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tickets = await RentalMaintenanceTicket.find(query)
      .populate('property', 'title address')
      .populate('tenant', 'nom prenom')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', data: { tickets: tickets.map(safeTicket) } });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ─────────────────────────────────────────────
// POST /api/rental-maintenance
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { propertyId, leaseId, tenantId, category, priority, description, estimatedCost } = req.body;
    if (!mongoose.isValidObjectId(propertyId)) return fail(res, 422, 'Identifiant de bien invalide.');
    const { error, property } = await assertPropertyAccess(req, propertyId);
    if (error === 404) return fail(res, 404, 'Bien introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres biens.');
    if (!RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES.includes(category)) return fail(res, 422, 'Catégorie invalide.');
    if (!description || !String(description).trim()) return fail(res, 422, 'La description du problème est requise.');

    const ticket = await rentalMaintenanceService.createTicket({
      propertyId, leaseId: leaseId || null, tenantId: tenantId || null, ownerId: property.owner || null,
      category, priority: priority || 'normale', description,
      estimatedCost: estimatedCost !== undefined ? Number(estimatedCost) : null,
      actingUser: req.user,
    });

    logAction({
      action: 'Ticket de maintenance locative créé', description: `Ticket ${category} créé pour ${property.title}`, module: 'GestionLocative',
      typeAction: 'CRÉATION', auteur: buildAuteur(req.user),
      cible: { id: String(ticket._id), type: 'RentalMaintenanceTicket', nom: property.title }, req,
    });

    res.status(201).json({ status: 'success', data: { ticket: safeTicket(ticket) } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id);
    if (error) return fail(res, error, 'Pièce jointe introuvable.');
    const secured = await RentalMaintenanceTicket.findById(ticket._id)
      .select('+attachments.asset.publicId +attachments.asset.resourceType +attachments.asset.deliveryType +attachments.asset.version +attachments.asset.format');
    const attachment = secured?.attachments?.[Number(req.params.attachmentIndex)];
    if (!attachment?.asset && attachment?.url) return streamRemoteDocument({ url: attachment.url, name: attachment.nom, res, context: { ticketId: secured._id } });
    if (!attachment?.asset) return fail(res, 404, 'Pièce jointe introuvable.');
    const buffer = await readPrivateAsset(attachment.asset.toObject());
    res.setHeader('Content-Type', attachment.asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="maintenance-evidence"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) { return fail(res, 502, 'Impossible de récupérer la pièce jointe.'); }
};

// ─────────────────────────────────────────────
// PATCH /api/rental-maintenance/:id/assign
// ─────────────────────────────────────────────
exports.assign = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres biens.');

    const { assignedToUserId } = req.body;
    if (!mongoose.isValidObjectId(assignedToUserId)) return fail(res, 422, 'Employé/technicien invalide.');

    const updated = await rentalMaintenanceService.assignTicket({ ticketId: ticket._id, assignedToUserId, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/rental-maintenance/:id/schedule
// ─────────────────────────────────────────────
exports.schedule = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres biens.');

    const updated = await rentalMaintenanceService.scheduleTicket({ ticketId: ticket._id, scheduledFor: req.body?.scheduledFor, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/rental-maintenance/:id/start
// ─────────────────────────────────────────────
exports.start = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres biens.');

    const updated = await rentalMaintenanceService.startWork({ ticketId: ticket._id, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/rental-maintenance/:id/resolve
// ─────────────────────────────────────────────
exports.resolve = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres biens.');

    const updated = await rentalMaintenanceService.resolveTicket({
      ticketId: ticket._id, actualCost: req.body?.actualCost, actingUser: req.user,
    });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/rental-maintenance/:id/close
// ─────────────────────────────────────────────
exports.close = async (req, res) => {
  try {
    const { error, ticket } = await loadTicketWithAccess(req, req.params.id);
    if (error === 400) return fail(res, 400, 'Identifiant invalide.');
    if (error === 404) return fail(res, 404, 'Ticket introuvable.');
    if (error === 403) return fail(res, 403, 'Vous ne pouvez gérer que vos propres biens.');

    const updated = await rentalMaintenanceService.closeTicket({ ticketId: ticket._id, actingUser: req.user });
    res.json({ status: 'success', data: { ticket: updated } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
