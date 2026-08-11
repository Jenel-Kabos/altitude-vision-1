const mongoose = require('mongoose');
const Document = require('../models/Document');
const Transaction = require('../models/Transaction');
const Property = require('../models/Property');
const { assertResourceTenant, resolveResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');

const tenantId = (req) => req.platformTenant?._id;
async function tenantDocumentFilter(req) {
  const propertyIds = await Property.find({ owner: { $in: req.tenantScopeUserIds || [] } }).distinct('_id');
  return {
    $or: [
      { tenant: tenantId(req) },
      { tenant: null, createdBy: { $in: req.tenantScopeUserIds || [] } },
      { tenant: null, client: { $in: req.tenantScopeUserIds || [] } },
      { tenant: null, relatedProperty: { $in: propertyIds } },
    ],
  };
}

// GL-DEBT-1 (Phase 4) — `{...req.query}` était injecté tel quel dans
// Document.find(), acceptant n'importe quelle clé et n'importe quelle valeur
// (y compris un objet d'opérateurs Mongo côté client, ex. ?client[$ne]=null).
// express-mongo-sanitize() (server.js) neutralise déjà les clés `$`/`.`, mais
// une whitelist explicite est la protection correcte et durable : seules les
// clés ci-dessous, avec un type scalaire validé, peuvent atteindre la
// requête Mongo — toute autre clé ou toute valeur non scalaire est ignorée.
const DOCUMENT_TYPE_VALUES = ['Devis', 'Facture', 'Contrat', 'Etat des Lieux', "Pièce d'identité"];
const DOCUMENT_STATUS_VALUES = ['Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Payé', 'En retard'];
const DOCUMENT_REF_TYPE_VALUES = ['Proprietaire', 'Locataire'];
// DOC-ARCH-1 — filtres de classement du Centre documentaire unifié.
const DOCUMENT_POLE_VALUES = ['Altimmo', 'Altcom', 'MilaEvents', 'Administration'];

const isScalar = (value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
const asObjectId = (value) => (isScalar(value) && mongoose.isValidObjectId(value) ? value : undefined);
const asEnum = (value, allowed) => (isScalar(value) && allowed.includes(value) ? value : undefined);

function buildDocumentFilter(query = {}) {
  const filter = {};
  const type = asEnum(query.type, DOCUMENT_TYPE_VALUES);
  if (type) filter.type = type;
  const status = asEnum(query.status, DOCUMENT_STATUS_VALUES);
  if (status) filter.status = status;
  const refType = asEnum(query.refType, DOCUMENT_REF_TYPE_VALUES);
  if (refType) filter.refType = refType;
  const client = asObjectId(query.client);
  if (client) filter.client = client;
  const createdBy = asObjectId(query.createdBy);
  if (createdBy) filter.createdBy = createdBy;
  const refId = asObjectId(query.refId);
  if (refId) filter.refId = refId;
  const relatedProperty = asObjectId(query.relatedProperty);
  if (relatedProperty) filter.relatedProperty = relatedProperty;
  if (isScalar(query.businessOperationKey)) filter.businessOperationKey = String(query.businessOperationKey).slice(0, 200);
  // DOC-ARCH-1 — navigation Pôle → Service → Catégorie du Centre
  // documentaire unifié. `service`/`categorie` sont du texte libre (comme
  // sur le modèle), whitelistés en scalaire uniquement.
  const pole = asEnum(query.pole, DOCUMENT_POLE_VALUES);
  if (pole) filter.pole = pole;
  if (isScalar(query.service)) filter.service = String(query.service).slice(0, 100);
  if (isScalar(query.categorie)) filter.categorie = String(query.categorie).slice(0, 100);
  if (isScalar(query.entityType)) filter.entityType = String(query.entityType).slice(0, 60);
  const entityId = asObjectId(query.entityId);
  if (entityId) filter.entityId = entityId;
  return filter;
}

// --- GET ALL DOCUMENTS ---
// Filtrable par type, statut, refType, client, createdBy, refId,
// relatedProperty, businessOperationKey — toute autre clé de query string
// est silencieusement ignorée (voir buildDocumentFilter).
// e.g., /api/documents?type=Facture&status=En retard
// GL-DEBT-1 (Phase 12) — pagination rétrocompatible : un client qui n'envoie
// ni `page` ni `limit` reçoit exactement l'ancien comportement (liste
// complète, non bornée) — aucun écran existant n'est cassé. Un client qui
// envoie `?page=`  bascule sur une liste bornée + `meta` (total/totalPages).
exports.getAllDocuments = async (req, res) => {
  try {
    const filter = { $and: [buildDocumentFilter(req.query), await tenantDocumentFilter(req)] };
    const pageRaw = Number(req.query.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : null;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;

    let query = Document.find(filter)
      .sort({ createdAt: -1 })
      .populate('client', 'name email')
      .populate('createdBy', 'name');

    let meta;
    if (page) {
      const total = await Document.countDocuments(filter);
      query = query.skip((page - 1) * limit).limit(limit);
      meta = { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
    }

    const documents = await query;

    res.status(200).json({
      status: 'success',
      results: documents.length,
      ...(meta && { meta }),
      data: {
        documents,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ status: error.statusCode ? 'fail' : 'error', code: error.code, message: error.message });
  }
};

exports.buildDocumentFilter = buildDocumentFilter;

// --- CREATE A NEW DOCUMENT ---
exports.createDocument = async (req, res) => {
  try {
    const docData = { ...req.body, tenant: tenantId(req), createdBy: req.user.id };
    const attribution = await resolveResourceTenant({ resourceType: 'Document', resource: docData });
    if (attribution.status !== 'resolved' || String(attribution.tenantId) !== String(tenantId(req))) {
      return res.status(422).json({ status: 'fail', code: 'TENANT_RELATION_MISMATCH', message: 'Les relations du document ne correspondent pas au tenant actif.' });
    }

    // --- Logic to calculate totals for Invoice/Quote ---
    if (docData.type === 'Devis' || docData.type === 'Facture') {
      let subTotal = 0;
      if (docData.items && docData.items.length > 0) {
        docData.items.forEach(item => {
          item.total = item.quantity * item.unitPrice;
          subTotal += item.total;
        });
      }
      docData.subTotal = subTotal;
      // Assuming a simple tax calculation for now
      docData.tax = docData.tax || 0; 
      docData.totalAmount = subTotal + docData.tax;
    }

    const newDocument = await Document.create(docData);
    res.status(201).json({
      status: 'success',
      data: {
        document: newDocument,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ status: 'fail', code: error.code, message: error.message });
  }
};


// --- GET A SINGLE DOCUMENT ---
exports.getDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id)
            .populate('client', 'name email phone')
            .populate('createdBy', 'name')
            .populate('relatedProperty', 'title address');

        if (!document) {
            return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
        }
        await assertResourceTenant({ resourceType: 'Document', resource: document, tenantId: tenantId(req) });
        res.status(200).json({
            status: 'success',
            data: { document }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ status: error.statusCode ? 'fail' : 'error', code: error.code, message: error.message });
    }
};

// --- UPDATE A DOCUMENT ---
exports.updateDocument = async (req, res) => {
  try {
    const existing = await Document.findById(req.params.id);
    if (!existing) return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
    await assertResourceTenant({ resourceType: 'Document', resource: existing, tenantId: tenantId(req) });
    const docData = { ...req.body };
    delete docData.tenant;
    const merged = { ...existing.toObject(), ...docData, tenant: existing.tenant || tenantId(req) };
    const attribution = await resolveResourceTenant({ resourceType: 'Document', resource: merged });
    if (attribution.status !== 'resolved' || String(attribution.tenantId) !== String(tenantId(req))) {
      return res.status(422).json({ status: 'fail', code: 'TENANT_RELATION_MISMATCH', message: 'Les relations du document ne correspondent pas au tenant actif.' });
    }
    docData.tenant = existing.tenant || tenantId(req);

     // Recalculate totals if items are updated for an Invoice/Quote
     if ((docData.type === 'Devis' || docData.type === 'Facture') && docData.items) {
        let subTotal = 0;
        docData.items.forEach(item => {
            item.total = item.quantity * item.unitPrice;
            subTotal += item.total;
        });
        docData.subTotal = subTotal;
        docData.tax = docData.tax || 0;
        docData.totalAmount = subTotal + docData.tax;
    }

    const document = await Document.findByIdAndUpdate(req.params.id, docData, {
      new: true,
      runValidators: true,
    });

    if (!document) {
      return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        document,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};


// --- DELETE A DOCUMENT ---
exports.deleteDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
        }
        await assertResourceTenant({ resourceType: 'Document', resource: document, tenantId: tenantId(req) });

        // Un document porteur d'un businessOperationKey ou lié à une
        // Transaction finalisée est un artefact du Financial Core (facture
        // de finalisation, écriture idempotente) : le supprimer casserait
        // l'idempotence de finalizeRealEstateTransaction (Document.findOne
        // par businessOperationKey / Transaction.linkedInvoice) et romprait
        // la piste d'audit. Il doit être conservé, jamais supprimé.
        const linkedToTransaction = await Transaction.exists({ linkedInvoice: document._id });
        if (document.businessOperationKey || linkedToTransaction) {
            return res.status(409).json({ status: 'fail', code: 'DOCUMENT_IMMUTABLE', message: 'Ce document est lié au Financial Core et ne peut pas être supprimé.' });
        }

        await Document.findByIdAndDelete(req.params.id);

        res.status(204).json({
            status: 'success',
            data: null,
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
