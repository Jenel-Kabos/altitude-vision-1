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
const Notification = require('../../models/Notification');
const { ROLES_DOCS } = require('../../utils/roles');
const { buildTimeline } = require('./dossierRegistry');
const { computeDossierHealth } = require('./dossierHealthEngine');
const { computeDossierActions } = require('./dossierActionsEngine');

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
// GL-LIFE-1 — affinée par `cycleVie` quand il est disponible (baux créés ou
// transitionnés depuis ce sprint) ; un contrat legacy sans `cycleVie` garde
// exactement l'ancienne dérivation, aucune régression.
function computeStatus(contrat, rental) {
  if (contrat.cycleVie) {
    if (['projet', 'en_preparation', 'a_signer'].includes(contrat.cycleVie)) return 'En cours';
    if (contrat.cycleVie === 'actif') return 'Actif';
    if (['preavis', 'inspection_sortie', 'cloture_financiere'].includes(contrat.cycleVie)) return 'En cours';
    if (contrat.cycleVie === 'archive') return 'Archivé';
    // 'resilie' — tombe dans la dérivation historique ci-dessous (Terminé/Archivé selon l'inspection).
  }
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
    .populate('bien', 'title type address surface bedrooms bathrooms status owner createdAt')
    .populate('proprietaire', 'nom prenom telephone email adresse ville')
    .populate('locataire', 'nom prenom telephone email profession revenuMensuel user');
  if (!contrat) throw new DossierError('Dossier introuvable.', 404);
  assertAccess(user, contrat);

  const rental = contrat.bien ? await RentalManagement.findOne({ property: contrat.bien._id }) : null;
  const [paiements, maintenanceTickets, identiteDocs, autresContrats, chaineRenouvellement, notifications] = await Promise.all([
    Paiement.find({ contrat: contrat._id }).sort({ annee: 1, mois: 1 }).lean(),
    RentalMaintenanceTicket.find({ lease: contrat._id }).sort({ createdAt: 1 }).lean(),
    Document.find({
      refType: { $in: ['Locataire', 'Proprietaire'] },
      refId: { $in: [contrat.locataire?._id, contrat.proprietaire?._id].filter(Boolean) },
    }).lean(),
    contrat.proprietaire ? Contrat.find({ proprietaire: contrat.proprietaire._id, _id: { $ne: contrat._id } }).select('bien type statut dateFinBail').populate('bien', 'title').lean() : [],
    // GL-LIFE-1 — chaîne de renouvellement (Phase 3/7) : jamais stockée
    // ailleurs, reconstruite ici par simple lecture des deux liens.
    Contrat.find({ _id: { $in: [contrat.renouvelleDe, contrat.renouvelePar].filter(Boolean) } }).select('statut cycleVie dateEntree dateFinBail').lean(),
    Notification.find({
      $or: [
        { entityType: 'Contrat', entityId: contrat._id },
        rental && { entityType: 'RentalManagement', entityId: rental._id },
        contrat.locataire && { entityType: 'Locataire', entityId: contrat.locataire._id },
        contrat.proprietaire && { entityType: 'Proprietaire', entityId: contrat.proprietaire._id },
      ].filter(Boolean),
    }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  // DOC-EVO-2 — Phase 6 : les notifications liées aux échéances de ce bail
  // (`entityType: 'Paiement'`, voir contratController.createPaiement) ne
  // peuvent être requêtées qu'une fois les paiements connus.
  const paiementNotifications = paiements.length
    ? await Notification.find({ entityType: 'Paiement', entityId: { $in: paiements.map((p) => p._id) } }).sort({ createdAt: -1 }).limit(30).lean()
    : [];
  const allNotifications = [...notifications, ...paiementNotifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);

  const documentsSection = [
    ...(contrat.documents || []).map((doc) => ({
      id: String(doc._id), label: doc.nom || DOC_TYPE_LABELS[doc.type] || doc.type, date: doc.dateGeneration,
      meta: { type: doc.type, invalidated: doc.invalidated || false },
      previewUrl: (doc.asset || doc.url) ? `/api/rental-documents/${doc._id}/download` : null,
    })),
    ...identiteDocs.map((doc) => ({
      id: String(doc._id), label: doc.notes || `Pièce d'identité — ${doc.refNom || ''}`.trim(), date: doc.issueDate || doc.createdAt,
      meta: { type: 'piece_identite', refType: doc.refType },
      previewUrl: doc.privateAsset && doc.refType && doc.refId
        ? `/api/${doc.refType === 'Locataire' ? 'locataires' : 'proprietaires'}/${doc.refId}/identity-document`
        : null,
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

  // DOC-EVO-2 — Phase 4 : "Bien" et "Propriétaire" deviennent de vraies
  // sections du cockpit (occupation/disponibilité/historique du bien,
  // portefeuille de contrats du propriétaire) — toujours en lecture, jamais
  // de duplication des collections Property/Proprietaire.
  const bienSection = contrat.bien ? [{
    id: String(contrat.bien._id),
    label: contrat.bien.title || 'Bien',
    date: contrat.bien.createdAt,
    meta: {
      type: contrat.bien.type, adresse: contrat.bien.address, statutPublication: contrat.bien.status,
      occupation: rental?.occupancyStatus || null, disponibilite: rental?.availabilityStatus || null,
    },
  }] : [];

  const proprietaireSection = contrat.proprietaire ? [{
    id: String(contrat.proprietaire._id),
    label: proprietaireNameOf(contrat),
    date: null,
    meta: {
      telephone: contrat.proprietaire.telephone, email: contrat.proprietaire.email,
      autresContrats: autresContrats.map((c) => ({ id: String(c._id), bien: c.bien?.title || null, type: c.type, statut: c.statut })),
    },
  }] : [];

  const locataireSection = contrat.locataire ? [{
    id: String(contrat.locataire._id),
    label: locataireNameOf(contrat),
    date: null,
    meta: {
      telephone: contrat.locataire.telephone, email: contrat.locataire.email, profession: contrat.locataire.profession,
      historiquePaiements: paiementsSection.length, historiqueMaintenance: maintenanceSection.length,
    },
  }] : [];

  // GL-LIFE-1 — Phase 1/7 : version actuelle + chaîne de renouvellement
  // réelle (Contrat #1 → renouvelé par → Contrat #2...), plus la caution.
  // Aucune donnée dupliquée : tout provient de `Contrat` lui-même.
  const ancien = chaineRenouvellement.find((c) => String(c._id) === String(contrat.renouvelleDe));
  const nouveau = chaineRenouvellement.find((c) => String(c._id) === String(contrat.renouvelePar));
  const contratSection = [{
    id: String(contrat._id),
    label: `Version actuelle — ${contrat.statut}`,
    date: contrat.updatedAt,
    meta: {
      createdAt: contrat.createdAt, updatedAt: contrat.updatedAt,
      cycleVie: contrat.cycleVie || null,
      resiliation: contrat.statut === 'résilié' ? { dateSortie: contrat.dateSortie || null } : null,
      renouvelleDe: ancien ? { contratId: String(ancien._id), statut: ancien.statut, dateFinBail: ancien.dateFinBail } : null,
      renouvelePar: nouveau ? { contratId: String(nouveau._id), statut: nouveau.statut, dateEntree: nouveau.dateEntree } : null,
      caution: contrat.caution ? { statut: contrat.caution.statut, montant: contrat.montantCaution, montantRetenu: contrat.caution.montantRetenu, montantRestitue: contrat.caution.montantRestitue } : null,
    },
  }];

  // GL-LIFE-1 — une seule chronologie continue (avenants ET
  // renouvellements-par-prolongation, puisqu'un renouvellement simple EST
  // un avenant de type 'renouvellement' — jamais deux tableaux distincts).
  const avenantsSection = (contrat.avenants || []).map((a) => ({
    id: String(a._id), label: a.type === 'renouvellement' ? 'Renouvellement (prolongation)' : `Avenant — ${a.type}`, date: a.dateEffet || a.createdAt,
    meta: { type: a.type, motif: a.motif, champsModifies: a.champsModifies },
  }));

  const notificationsSection = allNotifications.map((n) => ({
    id: String(n._id), label: n.title, date: n.createdAt,
    meta: { body: n.body, type: n.type, lu: n.read },
  }));

  const timeline = buildTimeline([
    contrat.bien?.createdAt && { date: contrat.bien.createdAt, label: 'Bien créé', type: 'bien' },
    rental?.lastPublishedAt && { date: rental.lastPublishedAt, label: 'Bien publié', type: 'bien' },
    { date: contrat.createdAt, label: 'Bail créé', type: 'contrat' },
    ...(contrat.documents || []).map((doc) => ({ date: doc.dateGeneration, label: `Document généré — ${DOC_TYPE_LABELS[doc.type] || doc.type}`, type: 'document' })),
    ...paiementsSection.filter((p) => p.meta.statut === 'payé').map((p) => ({ date: p.date, label: `Paiement — ${p.label}`, type: 'paiement' })),
    ...maintenanceSection.map((t) => ({ date: t.date, label: `Maintenance ouverte — ${t.label}`, type: 'maintenance' })),
    ...maintenanceTickets.filter((t) => t.resolvedAt).map((t) => ({ date: t.resolvedAt, label: `Maintenance résolue — ${t.category}`, type: 'maintenance' })),
    ...(rental?.workflowHistory || []).map((h) => ({ date: h.at, label: `${h.action} (${h.from || '—'} → ${h.to || '—'})`, type: 'gestion' })),
    rental?.exitInspectionClearedAt && { date: rental.exitInspectionClearedAt, label: 'Dossier archivé (sortie validée)', type: 'archivage' },
    // GL-LIFE-1 — cycle de vie (Phase 2) et avenants/renouvellements/caution
    // (Phase 3/4/6) rejoignent la même chronologie unique (Phase 7).
    ...(contrat.cycleHistory || []).map((h) => ({ date: h.at, label: `Cycle de vie — ${h.to}`, type: 'cycle_vie' })),
    ...avenantsSection.map((a) => ({ date: a.date, label: a.label, type: 'avenant' })),
    ...(contrat.caution?.historique || []).map((h) => ({ date: h.at, label: `Caution — ${h.action}`, type: 'caution' })),
  ].filter(Boolean));

  const proprietaireName = proprietaireNameOf(contrat);
  const locataireName = locataireNameOf(contrat);

  // DOC-EVO-2 — Phase 1 (synthèse) : durée restante, prochaine échéance et
  // solde actuel sont recalculés à chaque lecture, jamais stockés.
  const dureeRestanteJours = contrat.dateFinBail ? Math.ceil((new Date(contrat.dateFinBail).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
  const prochaineEcheance = paiementsSection.find((p) => p.meta.statut !== 'payé') || null;
  const soldeActuel = paiements.reduce((sum, p) => {
    if (p.statut === 'payé') return sum;
    return sum + ((p.montant || 0) - (p.montantRecu || 0));
  }, 0);

  const health = computeDossierHealth({ contrat, rental, paiements, maintenanceTickets, identiteDocs });
  const actions = computeDossierActions({ user, contrat, rental, paiements });

  return {
    domain: 'gestion_locative',
    entityId: String(contrat._id),
    status: computeStatus(contrat, rental),
    health,
    summary: {
      title: `Bail — ${contrat.bien?.title || contrat.adresseBien || 'Bien'}`,
      subtitle: locataireName ? `Locataire : ${locataireName}` : null,
      badges: [contrat.type, contrat.statut].filter(Boolean),
      fields: {
        loyer: contrat.montantLoyer, dateEntree: contrat.dateEntree, dateFinBail: contrat.dateFinBail,
        dureeRestanteJours, prochaineEcheance: prochaineEcheance ? { label: prochaineEcheance.label, date: prochaineEcheance.date } : null,
        soldeActuel, proprietaire: proprietaireName, locataire: locataireName,
      },
    },
    relatedLinks: [
      contrat.bien && { label: contrat.bien.title || 'Bien', domain: 'property', entityType: 'Property', entityId: String(contrat.bien._id) },
      contrat.proprietaire && { label: proprietaireName, domain: 'proprietaire', entityType: 'Proprietaire', entityId: String(contrat.proprietaire._id) },
      contrat.locataire && { label: locataireName, domain: 'locataire', entityType: 'Locataire', entityId: String(contrat.locataire._id) },
    ].filter(Boolean),
    sections: [
      { key: 'contrat', label: 'Contrat', items: contratSection },
      { key: 'avenants', label: 'Avenants & renouvellements', items: avenantsSection },
      { key: 'documents', label: 'Documents', items: documentsSection },
      { key: 'paiements', label: 'Paiements', items: paiementsSection },
      { key: 'maintenance', label: 'Maintenance', items: maintenanceSection },
      { key: 'preavis', label: 'Préavis', items: preavisSection },
      { key: 'bien', label: 'Bien immobilier', items: bienSection },
      { key: 'proprietaire', label: 'Propriétaire', items: proprietaireSection },
      { key: 'locataire', label: 'Locataire', items: locataireSection },
      { key: 'notifications', label: 'Notifications', items: notificationsSection },
    ],
    timeline,
    actions,
  };
}

function proprietaireNameOf(contrat) {
  return contrat.proprietaire ? `${contrat.proprietaire.prenom || ''} ${contrat.proprietaire.nom || ''}`.trim() : null;
}

function locataireNameOf(contrat) {
  return contrat.locataire ? `${contrat.locataire.prenom || ''} ${contrat.locataire.nom || ''}`.trim() : null;
}

module.exports = { load, DossierError };
