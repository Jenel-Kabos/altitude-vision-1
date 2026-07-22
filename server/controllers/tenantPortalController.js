// server/controllers/tenantPortalController.js — Dette technique GL-B2 (Mission 2)
//
// Contrôleurs fins : toute la logique reste dans tenantPortalService.js /
// tenantLinkService.js. Jamais de `locataireId` accepté depuis le corps de
// la requête — le dossier est TOUJOURS résolu depuis `req.user.id`.

const mongoose = require('mongoose');
const tenantPortalService = require('../services/tenantPortalService');
const tenantLinkService = require('../services/tenantLinkService');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { uploadToCloudinary, destroyFromCloudinary } = require('../config/cloudinary');

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
    if (!/^https:\/\//i.test(document.url)) return fail(res, 422, 'Document indisponible.');
    res.set('Cache-Control', 'private, no-store');
    return res.redirect(document.url);
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
      const uploaded = await uploadToCloudinary(file.buffer, { folder: 'altitude-vision/rental-maintenance', resource_type: 'image' });
      attachments.push({ url: uploaded.secure_url, nom: file.originalname });
    }
    const ticket = await tenantPortalService.createMyMaintenanceRequest(req.user.id, { category, description, attachments });
    res.status(201).json({ status: 'success', data: { ticket } });
  } catch (error) {
    await Promise.allSettled(attachments.map((file) => destroyFromCloudinary(file.url)));
    fail(res, error.statusCode || 500, error.message);
  }
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
