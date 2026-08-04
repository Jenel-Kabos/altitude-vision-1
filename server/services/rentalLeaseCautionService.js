// GL-LIFE-1 — Phase 6 : traçabilité complète de la caution. Enrichit
// `Contrat.caution{}` sans jamais dupliquer `montantCaution`/`cautionVersee`
// /`dateCautionVersee` (champs légaux déjà lus par pdfService/tenantPortal
// — laissés inchangés, tenus synchronisés). Encaissement → blocage →
// retenue éventuelle → restitution partielle ou totale, chaque étape tracée
// dans `caution.historique[]` (append-only).
const Contrat = require('../models/Contrat');
const { LifecycleError, transition } = require('./rentalLeaseLifecycleService');
const { notifyStaff } = require('./notificationService');
const { notifyContractTenant } = require('./rentalTenantNotificationService');

function assertLocation(contrat) {
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') throw new LifecycleError('La caution ne concerne que les baux de location.', 422);
}

async function encaisserCaution(contratId, { montant, actor } = {}) {
  const contrat = await Contrat.findById(contratId);
  assertLocation(contrat);
  contrat.cautionVersee = true;
  contrat.dateCautionVersee = new Date();
  contrat.caution.statut = 'versee';
  contrat.caution.historique.push({ action: 'encaissement', montant: montant ?? contrat.montantCaution, actor });
  await contrat.save();
  notifyStaff({ type: 'rental_deposit_encashed', title: 'Caution encaissée', body: `La caution du bail #${contrat._id} a été encaissée.`, entityType: 'Contrat', entityId: contrat._id }).catch(() => {});
  return contrat;
}

// Appelé automatiquement dès que le bail entre en préavis (voir
// rentalLeaseLifecycleController) — la caution reste bloquée jusqu'à
// l'issue de l'inspection de sortie, jamais restituable avant.
async function bloquerCaution(contratId, { actor, comment } = {}) {
  const contrat = await Contrat.findById(contratId);
  assertLocation(contrat);
  if (contrat.caution.statut !== 'versee') throw new LifecycleError('La caution doit être encaissée avant de pouvoir être bloquée.', 409);
  contrat.caution.statut = 'bloquee';
  contrat.caution.historique.push({ action: 'blocage', actor, motif: comment });
  await contrat.save();
  notifyStaff({ type: 'rental_deposit_blocked', title: 'Caution bloquée', body: `La caution du bail #${contrat._id} est bloquée dans l'attente de l'inspection de sortie.`, entityType: 'Contrat', entityId: contrat._id }).catch(() => {});
  return contrat;
}

async function appliquerRetenue(contratId, { montant, motif, actor } = {}) {
  const contrat = await Contrat.findById(contratId);
  assertLocation(contrat);
  if (contrat.caution.statut !== 'bloquee') throw new LifecycleError('La caution doit être bloquée avant d\'appliquer une retenue.', 409);
  if (montant > (contrat.montantCaution || 0)) throw new LifecycleError('La retenue ne peut pas dépasser le montant de la caution.', 422);
  contrat.caution.montantRetenu = montant;
  contrat.caution.motifRetenue = motif || '';
  contrat.caution.historique.push({ action: 'retenue', montant, motif, actor });
  await contrat.save();
  notifyStaff({ type: 'rental_deposit_withheld', title: 'Retenue sur caution', body: `Une retenue de ${montant} a été appliquée sur la caution du bail #${contrat._id}.`, entityType: 'Contrat', entityId: contrat._id }).catch(() => {});
  notifyContractTenant(contrat, { type: 'rental_deposit_withheld', title: 'Retenue sur votre caution', body: `Une retenue a été appliquée sur votre caution (${motif || 'motif non précisé'}).`, entityType: 'Contrat', entityId: contrat._id, dedupeKey: `tenant:deposit_withheld:${contrat._id}` }).catch(() => {});
  return contrat;
}

// Clôture la caution (partielle ou totale) et fait avancer le cycle de vie
// jusqu'à `resilie` — c'est la seule fonction qui referme financièrement le
// dossier (Phase 5 : "Calcul retenues → Restitution caution → Clôture").
async function restituerCaution(contratId, { montant, actor, comment } = {}) {
  const contrat = await Contrat.findById(contratId);
  assertLocation(contrat);
  if (!['bloquee', 'versee'].includes(contrat.caution.statut)) {
    throw new LifecycleError('La caution doit être encaissée ou bloquée avant restitution.', 409);
  }
  const restituable = (contrat.montantCaution || 0) - (contrat.caution.montantRetenu || 0);
  const montantRestitue = montant !== undefined ? montant : restituable;
  contrat.caution.montantRestitue = montantRestitue;
  contrat.caution.dateRestitution = new Date();
  contrat.caution.statut = montantRestitue >= restituable && contrat.caution.montantRetenu === 0 ? 'restituee'
    : montantRestitue > 0 ? 'partiellement_restituee' : 'retenue_totale';
  contrat.caution.historique.push({ action: 'restitution', montant: montantRestitue, motif: comment, actor });
  await contrat.save();

  notifyStaff({ type: 'rental_deposit_returned', title: 'Caution restituée', body: `La caution du bail #${contrat._id} a été restituée (${contrat.caution.statut}).`, entityType: 'Contrat', entityId: contrat._id }).catch(() => {});
  notifyContractTenant(contrat, { type: 'rental_deposit_returned', title: 'Votre caution a été restituée', body: `Un montant de ${montantRestitue} vous a été restitué.`, entityType: 'Contrat', entityId: contrat._id, dedupeKey: `tenant:deposit_returned:${contrat._id}` }).catch(() => {});

  let cycle = contrat.cycleVie || 'inspection_sortie';
  if (cycle === 'inspection_sortie') {
    const advanced = await transition(contrat._id, 'cloture_financiere', { actor, comment: 'Restitution de caution effectuée', action: 'caution_restitution' });
    cycle = advanced.cycleVie;
  }
  if (cycle === 'cloture_financiere') {
    await transition(contrat._id, 'resilie', { actor, comment: 'Clôture financière complète', action: 'caution_cloture' });
  }
  return Contrat.findById(contrat._id);
}

module.exports = { encaisserCaution, bloquerCaution, appliquerRetenue, restituerCaution };
