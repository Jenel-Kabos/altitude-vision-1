// server/controllers/tenantPortalController.js — Dette technique GL-B2 (Mission 2)
//
// Contrôleurs fins : toute la logique reste dans tenantPortalService.js /
// tenantLinkService.js. Jamais de `locataireId` accepté depuis le corps de
// la requête — le dossier est TOUJOURS résolu depuis `req.user.id`.

const mongoose = require('mongoose');
const tenantPortalService = require('../services/tenantPortalService');
const tenantLinkService = require('../services/tenantLinkService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { destroyFromCloudinary } = require('../config/cloudinary');
const { uploadPrivateAsset, deletePrivateAsset, readPrivateAsset } = require('../services/storage/secureStorageService');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const Locataire = require('../models/Locataire');
const { streamRemoteDocument } = require('../services/storage/documentStreamingService');

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ status: statusCode >= 500 ? 'error' : 'fail', message });

exports.getMe = async (req, res) => {
  try {
    const profile = await tenantPortalService.getMyProfile(req.user.id);
    res.json({ status: 'success', data: { locataire: profile } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.downloadMyIdentityDocument = async (req, res) => {
  try {
    const linked = await tenantPortalService.requireLocataire(req.user.id);
    const locataire = await Locataire.findById(linked._id)
      .select('+pieceIdentiteAsset.publicId +pieceIdentiteAsset.resourceType +pieceIdentiteAsset.deliveryType +pieceIdentiteAsset.version +pieceIdentiteAsset.format');
    if (!locataire?.pieceIdentiteAsset && locataire?.pieceIdentite) {
      return streamRemoteDocument({ url: locataire.pieceIdentite, name: 'identity-document', res, context: { userId: req.user.id, source: 'tenant_portal' } });
    }
    if (!locataire?.pieceIdentiteAsset) return fail(res, 404, 'Pièce d’identité introuvable.');
    const buffer = await readPrivateAsset(locataire.pieceIdentiteAsset.toObject());
    res.set({
      'Content-Type': locataire.pieceIdentiteAsset.mimeType || 'application/octet-stream',
      'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="identity-document"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    }).send(buffer);
  } catch (error) { return fail(res, error.statusCode || 403, 'Accès refusé.'); }
};

exports.getLease = async (req, res) => {
  try {
    const lease = await tenantPortalService.getMyLease(req.user.id);
    res.json({ status: 'success', data: { lease } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
exports.getLeases = async (req, res) => {
  try { res.json({ status: 'success', data: { leases: await tenantPortalService.getMyLeases(req.user.id) } }); }
  catch (error) { fail(res, error.statusCode || 500, error.message); }
};
exports.getDashboard = async (req, res) => {
  try { res.json({ status: 'success', data: { dashboard: await tenantPortalService.getDashboard(req.user.id) } }); }
  catch (error) { fail(res, error.statusCode || 500, error.message); }
};

exports.getPayments = async (req, res) => {
  try {
    res.json({ status: 'success', data: await tenantPortalService.getMyPaymentPage(req.user.id, req.query) });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.getDocuments = async (req, res) => {
  try {
    res.json({ status: 'success', data: await tenantPortalService.getMyDocumentPage(req.user.id, req.query) });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
exports.downloadDocument = async (req, res) => {
  try {
    const document = await tenantPortalService.getMyDocumentDownload(req.user.id, req.params.documentId);
    if (document.asset) {
      const buffer = await readPrivateAsset(document.asset);
      res.setHeader('Content-Type', document.asset.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="document"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    }
    return streamRemoteDocument({
      url: document.url,
      name: document.name || 'document',
      res,
      context: { documentId: req.params.documentId, userId: req.user.id, source: 'tenant_portal' },
    });
  } catch (error) { return fail(res, error.statusCode || 500, error.message); }
};
exports.getMaintenance = async (req, res) => {
  try { res.json({ status: 'success', data: await tenantPortalService.getMyMaintenance(req.user.id, req.query) }); }
  catch (error) { fail(res, error.statusCode || 500, error.message); }
};

exports.getNotice = async (req, res) => {
  try {
    const notice = await tenantPortalService.getMyNotice(req.user.id);
    res.json({ status: 'success', data: { notice } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.createMaintenanceRequest = async (req, res) => {
  const attachments = [];
  try {
    const { category, description } = req.body;
    for (const file of (req.files || [])) {
      const asset = await uploadPrivateAsset(file.buffer, {
        purpose: 'maintenance', ownerType: 'Locataire', ownerId: req.user.id,
        filename: file.originalname, mimeType: file.mimetype,
      });
      attachments.push({ asset, nom: file.originalname });
    }
    const ticket = await tenantPortalService.createMyMaintenanceRequest(req.user.id, { category, description, attachments });
    res.status(201).json({ status: 'success', data: { ticket } });
  } catch (error) {
    await Promise.allSettled(attachments.map((file) => file.asset ? deletePrivateAsset(file.asset) : destroyFromCloudinary(file.url)));
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.downloadMaintenanceAttachment = async (req, res) => {
  try {
    const locataire = await tenantPortalService.requireLocataire(req.user.id);
    const ticket = await RentalMaintenanceTicket.findOne({ _id: req.params.ticketId, tenant: locataire._id })
      .select('+attachments.asset.publicId +attachments.asset.resourceType +attachments.asset.deliveryType +attachments.asset.version +attachments.asset.format');
    const attachment = ticket?.attachments?.[Number(req.params.attachmentIndex)];
    if (!attachment) return fail(res, 404, 'Pièce jointe introuvable.');
    if (!attachment.asset && attachment.url) return streamRemoteDocument({ url: attachment.url, name: attachment.nom, res, context: { ticketId: ticket._id } });
    const buffer = await readPrivateAsset(attachment.asset.toObject());
    res.setHeader('Content-Type', attachment.asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="maintenance-evidence"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) { return fail(res, error.statusCode || 403, 'Accès refusé.'); }
};
exports.getLinkStatus = async (req, res) => {
  try { res.json({ status: 'success', data: await tenantPortalService.getLinkStatus(req.user.id) }); }
  catch (error) { fail(res, error.statusCode || 500, error.message); }
};

// ─────────────────────────────────────────────
// Rattachement (Mission 3) — actions initiées par le locataire lui-même.
// ─────────────────────────────────────────────
exports.activate = async (req, res) => {
  try {
    const { token } = req.body;
    const { locataire } = await tenantLinkService.activateInvitation({ rawToken: token, userId: req.user.id });
    logAction({
      action: 'Espace locataire activé', description: `Locataire ${locataire.prenom || ''} ${locataire.nom || ''} rattaché`, module: 'GestionLocative',
      typeAction: 'MODIFICATION', auteur: buildAuteur(req.user),
      cible: { id: String(locataire._id), type: 'Locataire' }, req,
    });
    res.json({ status: 'success', data: { locataire: { _id: locataire._id, nom: locataire.nom, prenom: locataire.prenom } } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};

exports.requestLink = async (req, res) => {
  try {
    const { locataireId } = req.body;
    if (!mongoose.isValidObjectId(locataireId)) return fail(res, 422, 'Identifiant invalide.');
    const request = await tenantLinkService.requestLink({ locataireId, userId: req.user.id });
    res.status(201).json({ status: 'success', data: { request: { _id: request._id, status: request.status } } });
  } catch (error) {
    fail(res, error.statusCode || 500, error.message);
  }
};
