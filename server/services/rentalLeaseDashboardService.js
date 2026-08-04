// GL-LIFE-1 — Phase 8 : tableau de bord du cycle de vie, entièrement
// calculé à partir des données déjà existantes (Contrat/RentalManagement),
// jamais un nouveau champ stocké — même principe que le moteur de dossier
// DOC-EVO-1/2.
const Contrat = require('../models/Contrat');
const RentalManagement = require('../models/RentalManagement');
const { contractAlertWindowDays } = require('./rentalFinancialAutomationService');

async function getLeaseLifecycleDashboard() {
  const windowDays = contractAlertWindowDays();
  const now = new Date();
  const soon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const [echeances, preavisEnAttente, cautionsARestituer, dossiersBloques] = await Promise.all([
    Contrat.find({ type: 'location', statut: 'actif', dateFinBail: { $gte: now, $lte: soon } })
      .select('bien locataire dateFinBail montantLoyer cycleVie avenants')
      .populate('bien', 'title').populate('locataire', 'nom prenom').lean(),
    RentalManagement.find({ occupancyStatus: 'sortie_programmee', noticeAcknowledgedAt: null })
      .select('property noticeStartedAt plannedExitAt').populate('property', 'title').lean(),
    Contrat.find({ type: 'location', 'caution.statut': { $in: ['versee', 'bloquee'] }, cycleVie: { $in: ['inspection_sortie', 'cloture_financiere'] } })
      .select('bien locataire montantCaution caution cycleVie').populate('bien', 'title').populate('locataire', 'nom prenom').lean(),
    Contrat.find({ type: 'location', $or: [{ 'etatsDesLieux.blockingReason': { $nin: [null, ''] } }] })
      .select('bien cycleVie etatsDesLieux').populate('bien', 'title').lean(),
  ]);

  // "Renouvellements à préparer" et "inspections à programmer" sont dérivés
  // des mêmes ensembles ci-dessus plutôt que d'un second aller-retour DB.
  const renouvellementsAPreparer = echeances.filter((c) => !(c.avenants || []).some((a) => a.type === 'renouvellement' && new Date(a.dateEffet) > now));
  const inspectionsPourPreavis = preavisEnAttente; // le préavis lui-même déclenche l'inspection (Phase 5)
  const dossiersBloquesFiltres = dossiersBloques.filter((c) => (c.etatsDesLieux || []).some((e) => e.blockingReason && !e.validatedByStaff));

  return {
    windowDays,
    bauxAEcheance: echeances.map((c) => ({ contratId: String(c._id), bien: c.bien?.title || null, locataire: c.locataire ? `${c.locataire.prenom || ''} ${c.locataire.nom || ''}`.trim() : null, dateFinBail: c.dateFinBail })),
    renouvellementsAPreparer: renouvellementsAPreparer.map((c) => ({ contratId: String(c._id), bien: c.bien?.title || null, dateFinBail: c.dateFinBail })),
    preavisEnAttente: preavisEnAttente.map((r) => ({ rentalManagementId: String(r._id), bien: r.property?.title || null, noticeStartedAt: r.noticeStartedAt, plannedExitAt: r.plannedExitAt })),
    inspectionsAProgrammer: inspectionsPourPreavis.map((r) => ({ rentalManagementId: String(r._id), bien: r.property?.title || null, plannedExitAt: r.plannedExitAt })),
    cautionsARestituer: cautionsARestituer.map((c) => ({ contratId: String(c._id), bien: c.bien?.title || null, locataire: c.locataire ? `${c.locataire.prenom || ''} ${c.locataire.nom || ''}`.trim() : null, montantCaution: c.montantCaution, statutCaution: c.caution?.statut })),
    dossiersBloques: dossiersBloquesFiltres.map((c) => ({ contratId: String(c._id), bien: c.bien?.title || null, motif: (c.etatsDesLieux || []).find((e) => e.blockingReason)?.blockingReason || null })),
  };
}

module.exports = { getLeaseLifecycleDashboard };
