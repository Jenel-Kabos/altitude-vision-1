// server/controllers/rentalDocumentController.js — GL-DEBT-1 (Phase 3)
//
// Les documents de Gestion Locative (bail, quittance, mise en demeure,
// préavis, états des lieux) vivent dans Contrat.documents[] (voir
// gestionDocumentController.js) et étaient jusqu'ici consultés via leur URL
// Cloudinary directe, renvoyée telle quelle au client (RentalDocumentsPage,
// Sprint GL-UX1). N'importe qui en possession de l'URL pouvait y accéder,
// sans authentification ni vérification de la relation propriétaire /
// locataire / bail. Ce contrôleur ajoute une couche d'accès contrôlée qui
// réutilise Contrat (jamais un nouveau modèle de document) : vérifie
// l'authentification, le rôle, la relation réelle avec le bail, puis
// proxy-stream le fichier — l'URL Cloudinary sous-jacente et le publicId ne
// sont jamais renvoyés au client.

const mongoose = require('mongoose');
const http = require('http');
const https = require('https');
const Contrat = require('../models/Contrat');
const logger = require('../utils/logger');
const { ROLES_DOCS } = require('../utils/roles');

const isStaffDoc = (role) => ROLES_DOCS.includes(role);

const fail = (res, status, message) => res.status(status).json({ status: status >= 500 ? 'error' : 'fail', message });

const safeFilename = (name) => String(name || 'document').replace(/[^\w.\- ]/g, '_').slice(0, 120);

// GET /api/rental-documents/:documentId/download
exports.download = async (req, res) => {
  const { documentId } = req.params;
  if (!mongoose.isValidObjectId(documentId)) return fail(res, 400, 'Identifiant de document invalide.');

  const contrat = await Contrat.findOne({ 'documents._id': documentId })
    .populate('bien', 'owner title')
    .populate('locataire', 'user');
  if (!contrat) return fail(res, 404, 'Document introuvable.');

  const doc = contrat.documents.id(documentId);
  if (!doc) return fail(res, 404, 'Document introuvable.');

  const user = req.user;
  const userId = String(user._id || user.id);
  // 'Locataire' n'est jamais une valeur de User.role (voir models/User.js) —
  // un locataire est un User ordinaire relié via Locataire.user (rattachement
  // explicite validé, voir tenantLinkService.js). La relation avec CE bail
  // précis est le seul contrôle nécessaire, indépendant du rôle affiché.
  const isOwnerMatch = user.role === 'Proprietaire' && contrat.bien?.owner && String(contrat.bien.owner) === userId;
  const isTenantMatch = Boolean(contrat.locataire?.user) && String(contrat.locataire.user) === userId;
  const allowed = isStaffDoc(user.role) || isOwnerMatch || isTenantMatch;

  if (!allowed) {
    logger.warn('rental_document.access_denied', { documentId, contratId: String(contrat._id), userId, role: user.role });
    return fail(res, 403, 'Accès refusé à ce document.');
  }

  if (!doc.url) return fail(res, 404, 'Ce document n’a pas de fichier associé.');

  // Journal d'accès — jamais l'URL/publicId, seulement les identifiants et
  // le contexte métier (voir utils/logger.js pour la rédaction automatique
  // des clés sensibles en production).
  logger.info('rental_document.accessed', {
    documentId, contratId: String(contrat._id), docType: doc.type, userId, role: user.role,
  });

  const client = doc.url.startsWith('https:') ? https : http;
  const upstream = client.get(doc.url, (upstreamRes) => {
    if (upstreamRes.statusCode >= 400) {
      logger.error('rental_document.upstream_error', { documentId, statusCode: upstreamRes.statusCode });
      upstreamRes.resume();
      return fail(res, 502, 'Impossible de récupérer le document.');
    }
    res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename(doc.nom)}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    upstreamRes.pipe(res);
  });
  upstream.on('error', (error) => {
    logger.error('rental_document.stream_failed', { documentId, error: error.message });
    if (!res.headersSent) fail(res, 502, 'Impossible de récupérer le document.');
  });
};
