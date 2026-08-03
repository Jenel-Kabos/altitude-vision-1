// DOC-EVO-1 — Adaptateur "dossier métier" pour un bail (Contrat de type
// location), le domaine le plus riche de la plateforme. Pure lecture/
// agrégation : aucune donnée n'est copiée, seulement lue et assemblée.
// Réutilise exactement les mêmes modèles et la même règle RBAC que
// rentalDocumentController.js (staff ROLES_DOCS / propriétaire via
// Property.owner / locataire via Locataire.user) — jamais une nouvelle
// notion de permission.
const mongoose = require('mongoose');
const Contrat = require('../../models/Contrat');
const RentalManagement = require('../../models/RentalManagement');
const Paiement = require('../../models/Paiement');
const RentalMaintenanceTicket = require('../../models/RentalMaintenanceTicket');
const Document = require('../../models/Document');
const { ROLES_DOCS } = require('../../utils/roles');
const { buildTimeline } = require('./dossierRegistry');

const DOC_TYPE_LABELS = {
  bail: 'Bail', quittance: 'Quittance', mise_en_demeure: 'Mise en demeure', preavis: 'Préavis',
  etat_entree: "État des lieux d'entrée", etat_sortie: 'État des lieux de sortie',
};

class DossierError extends Error {
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
}

function assertAccess(user, contrat) {
  const userId = String(user._id || user.id);
  const isStaff = ROLES_DOCS.includes(user.role);
  const isOwnerMatch = user.role === 'Proprietaire' && contrat.bien?.owner && String(contrat.bien.owner) === userId;
  const isTenantMatch = Boolean(contrat.locataire?.user) && String(contrat.locataire.user) === userId;
  if (!isStaff && !isOwnerMatch && !isTenantMatch) throw new DossierError('Accès refusé à ce dossier.', 403);
}

// DOC-EVO-1 — dérivation pure (aucun champ stocké) : Actif/En cours/
// Terminé/Archivé. Ne modifie jamais Contrat.statut ni
// RentalManagement.occupancyStatus — juste une lecture combinée pour
// l'affichage du Centre documentaire.
function computeStatus(contrat, rental) {
  if (contrat.statut === 'en_attente') return 'En cours';
  if (contrat.statut === 'actif') {
    return rental?.occupancyStatus === 'sortie_programmee' ? 'En cours' : 'Actif';
  }
  // résilié / expiré
  return rental?.exitInspectionClearedAt ? 'Archivé' : 'Terminé';
}

async function load({ entityId, user }) {
  if (!mongoose.isValidObjectId(entityId)) throw new DossierError('Identifiant de dossier invalide.', 400);
  const contrat = await Contrat.findById(entityId)
    .populate('bien', 'title address owner')
    .populate('proprietaire', 'nom prenom telephone email')
    .populate('locataire', 'nom prenom telephone email user');
  if (!contrat) throw new DossierError('Dossier introuvable.', 404);
  assertAccess(user, contrat);

  const rental = contrat.bien ? await RentalManagement.findOne({ property: contrat.bien._id }) : null;
  const [paiements, maintenanceTickets, identiteDocs] = await Promise.all([
    Paiement.find({ contrat: contrat._id }).sort({ annee: 1, mois: 1 }).lean(),
    RentalMaintenanceTicket.find({ lease: contrat._id }).sort({ createdAt: 1 }).lean(),
    Document.find({
      refType: { $in: ['Locataire', 'Proprietaire'] },
      refId: { $in: [contrat.locataire?._id, contrat.proprietaire?._id].filter(Boolean) },
    }).lean(),
  ]);

  const documentsSection = [
    ...(contrat.documents || []).map((doc) => ({
      id: String(doc._id), label: doc.nom || DOC_TYPE_LABELS[doc.type] || doc.type, date: doc.dateGeneration,
      meta: { type: doc.type, invalidated: doc.invalidated || false },
      previewUrl: doc.url ? `/api/rental-documents/${doc._id}/download` : null,
    })),
    ...identiteDocs.map((doc) => ({
      id: String(doc._id), label: doc.notes || `Pièce d'identité — ${doc.refNom || ''}`.trim(), date: doc.issueDate || doc.createdAt,
      meta: { type: 'piece_identite', refType: doc.refType },
      previewUrl: doc.content && doc.content.startsWith('http') ? doc.content : null,
    })),
  ];

  const paiementsSection = paiements.map((p) => ({
    id: String(p._id), label: `Échéance ${String(p.mois).padStart(2, '0')}/${p.annee}`, date: p.datePaiement || new Date(p.annee, (p.mois || 1) - 1, 1),
    meta: { statut: p.statut, montant: p.montant, montantRecu: p.montantRecu, penaliteAppliquee: p.penaliteAppliquee, penaliteMontant: p.penaliteMontant },
  }));

  const maintenanceSection = maintenanceTickets.map((t) => ({
    id: String(t._id), label: `${t.category} — ${t.priority}`, date: t.createdAt,
    meta: { status: t.status, description: t.description, estimatedCost: t.estimatedCost, actualCost: t.actualCost },
  }));

  const preavisSection = [];
  if (rental?.noticeStartedAt) {
    preavisSection.push({ id: 'notice-start', label: 'Préavis démarré', date: rental.noticeStartedAt, meta: { plannedExitAt: rental.plannedExitAt } });
  }
  if (rental?.noticeAcknowledgedAt) {
    preavisSection.push({ id: 'notice-ack', label: 'Préavis accusé réception', date: rental.noticeAcknowledgedAt });
  }
  if (rental?.exitInspectionClearedAt) {
    preavisSection.push({ id: 'exit-cleared', label: 'Sortie validée', date: rental.exitInspectionClearedAt });
  }

  const timeline = buildTimeline([
    { date: contrat.createdAt, label: 'Bail créé', type: 'contrat' },
    ...(contrat.documents || []).map((doc) => ({ date: doc.dateGeneration, label: `Document généré — ${DOC_TYPE_LABELS[doc.type] || doc.type}`, type: 'document' })),
    ...paiementsSection.filter((p) => p.meta.statut === 'payé').map((p) => ({ date: p.date, label: `Paiement — ${p.label}`, type: 'paiement' })),
    ...maintenanceSection.map((t) => ({ date: t.date, label: `Maintenance ouverte — ${t.label}`, type: 'maintenance' })),
    ...maintenanceTickets.filter((t) => t.resolvedAt).map((t) => ({ date: t.resolvedAt, label: `Maintenance résolue — ${t.category}`, type: 'maintenance' })),
    ...(rental?.workflowHistory || []).map((h) => ({ date: h.at, label: `${h.action} (${h.from || '—'} → ${h.to || '—'})`, type: 'gestion' })),
  ]);

  const proprietaireName = contrat.proprietaire ? `${contrat.proprietaire.prenom || ''} ${contrat.proprietaire.nom || ''}`.trim() : null;
  const locataireName = contrat.locataire ? `${contrat.locataire.prenom || ''} ${contrat.locataire.nom || ''}`.trim() : null;

  return {
    domain: 'gestion_locative',
    entityId: String(contrat._id),
    status: computeStatus(contrat, rental),
    summary: {
      title: `Bail — ${contrat.bien?.title || contrat.adresseBien || 'Bien'}`,
      subtitle: locataireName ? `Locataire : ${locataireName}` : null,
      badges: [contrat.type, contrat.statut].filter(Boolean),
      fields: {
        loyer: contrat.montantLoyer, dateEntree: contrat.dateEntree, dateFinBail: contrat.dateFinBail,
        proprietaire: proprietaireName, locataire: locataireName,
      },
    },
    relatedLinks: [
      contrat.bien && { label: contrat.bien.title || 'Bien', domain: 'property', entityType: 'Property', entityId: String(contrat.bien._id) },
      contrat.proprietaire && { label: proprietaireName, domain: 'proprietaire', entityType: 'Proprietaire', entityId: String(contrat.proprietaire._id) },
      contrat.locataire && { label: locataireName, domain: 'locataire', entityType: 'Locataire', entityId: String(contrat.locataire._id) },
    ].filter(Boolean),
    sections: [
      { key: 'documents', label: 'Documents', items: documentsSection },
      { key: 'paiements', label: 'Paiements', items: paiementsSection },
      { key: 'maintenance', label: 'Maintenance', items: maintenanceSection },
      { key: 'preavis', label: 'Préavis', items: preavisSection },
    ],
    timeline,
    actions: [
      { key: 'generate_bail', label: 'Générer le bail' },
      { key: 'generate_quittance', label: 'Générer une quittance' },
      { key: 'generate_preavis', label: 'Générer un préavis' },
      { key: 'generate_etat_des_lieux', label: 'Générer un état des lieux' },
    ],
  };
}

module.exports = { load, DossierError };
