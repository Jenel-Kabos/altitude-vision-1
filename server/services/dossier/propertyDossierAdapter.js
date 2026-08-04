// GL-ASSET-1 — Phase 5/8 : adaptateur "dossier métier" pour un BIEN
// (Property), 5ème domaine du moteur de dossier générique (DOC-EVO-1/2) —
// entityId = Property._id (à la différence de 'gestion_locative' dont
// entityId est un Contrat). Pure lecture/agrégation, comme tous les
// adaptateurs existants : aucune donnée copiée, aucun nouveau stockage.
// Réutilise exclusivement propertyPatrimonialHistoryService (Phase 2),
// propertyMaintenanceLogbookService (Phase 3), propertyAssetValuationService
// (Phase 4) et propertyAlertsService (Phase 7) déjà construits — zéro
// logique dupliquée.
const mongoose = require('mongoose');
const Property = require('../../models/Property');
const FinancialDocument = require('../../models/FinancialDocument');
const { ROLES_DOCS } = require('../../utils/roles');
const { buildTimeline } = require('./dossierRegistry');
const { getPropertyHistory } = require('../propertyPatrimonialHistoryService');
const { getMaintenanceLogbook } = require('../propertyMaintenanceLogbookService');
const { computeValuation } = require('../propertyAssetValuationService');
const { computeAlerts } = require('../propertyAlertsService');
const { deriveAssetCycle } = require('../propertyAssetLifecycleService');

const ASSET_CYCLE_LABELS = {
  disponible: 'Disponible', reserve: 'Réservé', en_location: 'En location', preavis: 'Préavis',
  inspection: 'Inspection', travaux: 'Travaux', vendu: 'Vendu', archive: 'Archivé',
};

class PropertyDossierError extends Error {
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
}

function assertAccess(user, property) {
  const userId = String(user._id || user.id);
  const isStaff = ROLES_DOCS.includes(user.role);
  const isOwnerMatch = String(property.owner) === userId;
  if (!isStaff && !isOwnerMatch) throw new PropertyDossierError('Accès refusé à ce dossier.', 403);
}

async function load({ entityId, user }) {
  if (!mongoose.isValidObjectId(entityId)) throw new PropertyDossierError('Identifiant de dossier invalide.', 400);
  const property = await Property.findById(entityId);
  if (!property) throw new PropertyDossierError('Dossier introuvable.', 404);
  assertAccess(user, property);

  const [history, logbook, valuation, alerts, financialDocuments] = await Promise.all([
    getPropertyHistory(property._id),
    getMaintenanceLogbook(property._id),
    computeValuation(property._id),
    computeAlerts(property._id),
    FinancialDocument.find({ establishmentType: 'Property', establishmentId: property._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  const proprietairesSection = history.proprietaires.map((p) => ({
    id: String(p._id), label: `${p.prenom || ''} ${p.nom || ''}`.trim(), date: null, meta: { telephone: p.telephone },
  }));
  const locatairesSection = history.locataires.map((l) => ({
    id: String(l._id), label: `${l.prenom || ''} ${l.nom || ''}`.trim(), date: null, meta: { telephone: l.telephone },
  }));
  const contratsSection = history.contrats.map((c) => ({
    id: String(c._id), label: `Contrat ${c.type} — ${c.statut}`, date: c.createdAt,
    meta: { type: c.type, statut: c.statut, dateFinBail: c.dateFinBail },
  }));
  const visitesSection = history.visites.map((v) => ({
    id: String(v._id), label: `Visite — ${v.statut}`, date: v.createdAt, meta: { statut: v.statut },
  }));
  const transactionsSection = history.transactions.map((t) => ({
    id: String(t._id), label: `${t.transactionType} — ${t.status}`, date: t.createdAt,
    meta: { finalAmount: t.finalAmount, status: t.status },
  }));
  const maintenanceSection = logbook.tickets.map((t) => ({
    id: String(t._id), label: `${t.category} — ${t.priority}`, date: t.createdAt,
    meta: { status: t.status, actualCost: t.actualCost, entrepriseIntervenante: t.entrepriseIntervenante, garantieJusquau: t.garantieJusquau },
  }));
  const documentsSection = [
    ...history.documents.map((d) => ({
      id: String(d._id), label: d.type || 'Document', date: d.createdAt || d.issueDate,
      meta: { type: d.type }, previewUrl: null,
    })),
    ...financialDocuments.map((fd) => ({
      id: String(fd._id), label: `${fd.documentType} ${fd.documentNumber || ''}`.trim(), date: fd.createdAt,
      meta: { status: fd.status, totalMinor: fd.totalMinor, currency: fd.currency },
    })),
  ];
  const etatsDesLieuxSection = history.etatsDesLieux.map((e, i) => ({
    id: `${e.contratId}-${i}`, label: `État des lieux — ${e.type}`, date: e.date, meta: { validatedByStaff: e.validatedByStaff },
  }));

  const timeline = buildTimeline([
    { date: property.createdAt, label: 'Bien créé', type: 'bien' },
    ...contratsSection.map((c) => ({ date: c.date, label: `Contrat créé — ${c.meta.type}`, type: 'contrat' })),
    ...visitesSection.map((v) => ({ date: v.date, label: 'Visite', type: 'visite' })),
    ...maintenanceSection.map((m) => ({ date: m.date, label: `Maintenance — ${m.label}`, type: 'maintenance' })),
    ...transactionsSection.map((t) => ({ date: t.date, label: `Transaction — ${t.label}`, type: 'transaction' })),
    ...(property.assetCycleHistory || []).map((h) => ({ date: h.at, label: `Cycle de vie — ${ASSET_CYCLE_LABELS[h.to] || h.to}`, type: 'cycle_vie' })),
  ]);

  const assetCycle = deriveAssetCycle(property);

  return {
    domain: 'bien',
    entityId: String(property._id),
    status: ASSET_CYCLE_LABELS[assetCycle] || property.availability,
    health: alerts,
    summary: {
      title: property.title,
      subtitle: property.address?.city || null,
      badges: [property.type, property.availability].filter(Boolean),
      fields: {
        assetCycle, prix: property.price,
        revenusGeneres: valuation?.revenusGeneres ?? null, revenusAnnuels: valuation?.revenusAnnuels ?? null,
        tauxOccupation: valuation?.tauxOccupation ?? null, rentabiliteNette: valuation?.rentabiliteNette ?? null,
        coutMaintenance: valuation?.coutMaintenance ?? null,
      },
    },
    relatedLinks: [
      { label: property.title, domain: 'property', entityType: 'Property', entityId: String(property._id) },
    ],
    sections: [
      { key: 'proprietaires', label: 'Propriétaires', items: proprietairesSection },
      { key: 'locataires', label: 'Locataires', items: locatairesSection },
      { key: 'contrats', label: 'Contrats', items: contratsSection },
      { key: 'visites', label: 'Visites', items: visitesSection },
      { key: 'transactions', label: 'Ventes / Transactions', items: transactionsSection },
      { key: 'maintenance', label: 'Carnet d\'entretien', items: maintenanceSection },
      { key: 'etats_des_lieux', label: 'États des lieux', items: etatsDesLieuxSection },
      { key: 'documents', label: 'Documents', items: documentsSection },
    ],
    timeline,
    actions: [],
  };
}

module.exports = { load, PropertyDossierError };
