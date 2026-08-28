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
const Contrat = require('../models/Contrat');
const logger = require('../utils/logger');
const { ROLES_DOCS } = require('../utils/roles');
const { resolveTenantForUser } = require('../services/platformTenant/tenantContextService');
const { assertResourceTenantOrUnattributed } = require('../services/platformTenant/tenantResourceAttributionService');
const { readPrivateAsset } = require('../services/storage/secureStorageService');
const { safeFilename, streamRemoteDocument } = require('../services/storage/documentStreamingService');

const isStaffDoc = (role) => ROLES_DOCS.includes(role);

const fail = (res, status, message) => res.status(status).json({ status: status >= 500 ? 'error' : 'fail', message });

// GET /api/rental-documents/:documentId/download
exports.download = async (req, res) => {
  const { documentId } = req.params;
  if (!mongoose.isValidObjectId(documentId)) return fail(res, 400, 'Identifiant de document invalide.');

  const contrat = await Contrat.findOne({ 'documents._id': documentId })
    .select('+documents.asset.publicId +documents.asset.resourceType +documents.asset.deliveryType +documents.asset.version +documents.asset.format')
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
  let staffTenantMatch = false;
  if (isStaffDoc(user.role)) {
    try {
      // PLATFORM-ADMIN-CERT-1 — voir accommodationController.js pour la même justification.
      const explicitTenantId = req.get('X-Platform-Tenant-Id') || req.get('X-Tenant-Id') || null;
      const tenant = await resolveTenantForUser(user._id || user.id, explicitTenantId);
      await assertResourceTenantOrUnattributed({ resourceType: 'Contrat', resource: contrat, tenantId: tenant?._id });
      staffTenantMatch = true;
    } catch {
      staffTenantMatch = false;
    }
  }
  const allowed = staffTenantMatch || isOwnerMatch || isTenantMatch;

  if (!allowed) {
    logger.warn('rental_document.access_denied', { documentId, contratId: String(contrat._id), userId, role: user.role });
    return fail(res, 403, 'Accès refusé à ce document.');
  }

  if (!doc.url && !doc.asset) return fail(res, 404, 'Ce document n’a pas de fichier associé.');

  // Journal d'accès — jamais l'URL/publicId, seulement les identifiants et
  // le contexte métier (voir utils/logger.js pour la rédaction automatique
  // des clés sensibles en production).
  logger.info('rental_document.accessed', {
    documentId, contratId: String(contrat._id), docType: doc.type, userId, role: user.role,
  });

  if (doc.asset) {
    try {
      const buffer = await readPrivateAsset(doc.asset.toObject());
      res.setHeader('Content-Type', doc.asset.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${safeFilename(doc.asset.originalFilename || `${doc.nom}.pdf`)}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error) {
      logger.error('rental_document.private_stream_failed', { documentId, contratId: String(contrat._id), error: error.message });
      return fail(res, 502, 'Impossible de récupérer le document.');
    }
  }
  return streamRemoteDocument({ url: doc.url, name: `${doc.nom}.pdf`, res, context: { documentId } });
};
