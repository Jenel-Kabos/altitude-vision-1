// GL-LIFE-1 — Phase 3 : renouvellement d'un bail, règle métier validée par
// l'utilisateur (pas un choix technique) :
//   - Par défaut, un renouvellement PROLONGE le contrat existant (avenant
//     de type 'renouvellement' sur le MÊME Contrat — jamais de recréation
//     de bien/propriétaire/locataire, jamais de nouveau Contrat).
//   - Un nouveau Contrat lié n'est créé QUE si le changement est majeur au
//     sens juridique/économique : changement de locataire, de propriétaire,
//     de bien ou de type de contrat. Le staff ne choisit jamais librement —
//     la décision découle automatiquement des champs modifiés.
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const { LifecycleError, transition } = require('./rentalLeaseLifecycleService');
const { addAvenant, buildChampsModifies } = require('./rentalLeaseAmendmentService');
const { syncLeaseOccupation } = require('./rentalManagementLeaseSyncService');
const { generatePaiements } = require('../controllers/contratController');
const { notifyStaff } = require('./notificationService');
const { notifyContractTenant } = require('./rentalTenantNotificationService');

// Un changement sur l'un de ces champs impose juridiquement un nouveau
// contrat — jamais une simple prolongation du bail existant.
const MAJOR_CHANGE_FIELDS = ['locataire', 'proprietaire', 'bien', 'type'];

function isMajorChange(contrat, payload) {
  return MAJOR_CHANGE_FIELDS.some((field) => payload[field] !== undefined && String(payload[field]) !== String(contrat[field] || ''));
}

// N'insère que les échéances qui n'existent pas encore pour ce contrat —
// une prolongation ne doit jamais dupliquer un Paiement déjà généré.
async function generateMissingPaiements(contratId, dateEntree, dateFinBail, montantLoyer) {
  if (!dateEntree || !dateFinBail || !montantLoyer) return;
  const existing = await Paiement.find({ contrat: contratId }).select('mois annee').lean();
  const existingKeys = new Set(existing.map((p) => `${p.annee}-${p.mois}`));

  const start = new Date(dateEntree);
  const end = new Date(dateFinBail);
  const rows = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    const key = `${cur.getFullYear()}-${cur.getMonth() + 1}`;
    if (!existingKeys.has(key)) {
      rows.push({ contrat: contratId, mois: cur.getMonth() + 1, annee: cur.getFullYear(), montant: montantLoyer, statut: 'impayé' });
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  if (rows.length > 0) await Paiement.insertMany(rows);
}

// GL-UX-1 — aperçu SANS AUCUNE PERSISTANCE (Phase 3 : "visualiser les
// modifications" avant confirmation). Réutilise EXACTEMENT la même décision
// automatique (`isMajorChange`) et le même calcul de différence
// (`buildChampsModifies`) que `renewLease` ci-dessous — le frontend ne fait
// que soumettre un formulaire et afficher ce que le backend renvoie, aucune
// règle métier n'est dupliquée ni devinée côté React.
async function previewRenewal(contratId, payload = {}) {
  const contrat = await Contrat.findById(contratId).populate('bien', 'title');
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') throw new LifecycleError('Seuls les baux de location peuvent être renouvelés.', 422);

  const major = isMajorChange(contrat, payload);
  if (!major) {
    const changes = {};
    if (payload.dateFinBail !== undefined) changes.dateFinBail = payload.dateFinBail;
    if (payload.montantLoyer !== undefined) changes.montantLoyer = payload.montantLoyer;
    if (payload.montantCaution !== undefined) changes.montantCaution = payload.montantCaution;
    return { mode: 'prolongation', champsModifies: buildChampsModifies(contrat, changes) };
  }
  const champsModifies = buildChampsModifies(contrat, {
    locataire: payload.locataire, proprietaire: payload.proprietaire, bien: payload.bien, type: payload.type,
    dateFinBail: payload.dateFinBail, montantLoyer: payload.montantLoyer, montantCaution: payload.montantCaution,
  });
  return { mode: 'nouveau_contrat', champsModifies };
}

// GL-LIFE-1 — point d'entrée UNIQUE du renouvellement. Aucun autre code ne
// doit créer un Contrat "de renouvellement" en dehors de cette fonction.
async function renewLease(contratId, payload = {}) {
  const { actor, motif } = payload;
  const contrat = await Contrat.findById(contratId).populate('bien', 'title');
  if (!contrat) throw new LifecycleError('Contrat introuvable.', 404);
  if (contrat.type !== 'location') throw new LifecycleError('Seuls les baux de location peuvent être renouvelés.', 422);
  if (contrat.statut !== 'actif') throw new LifecycleError('Seul un bail actif peut être renouvelé.', 409);

  if (!isMajorChange(contrat, payload)) {
    // ── Prolongation du même contrat (cas par défaut) ──────────────────
    const changes = {};
    if (payload.dateFinBail !== undefined) changes.dateFinBail = payload.dateFinBail;
    if (payload.montantLoyer !== undefined) changes.montantLoyer = payload.montantLoyer;
    if (payload.montantCaution !== undefined) changes.montantCaution = payload.montantCaution;

    const updated = await addAvenant(contrat._id, { type: 'renouvellement', motif, dateEffet: payload.dateEffet, actor, changes });

    if (payload.dateFinBail) {
      await generateMissingPaiements(updated._id, updated.dateEntree, updated.dateFinBail, updated.montantLoyer);
    }

    notifyStaff({ type: 'rental_lease_renewed', title: 'Bail prolongé', body: `Le bail #${updated._id} (${contrat.bien?.title || 'bien'}) a été prolongé.`, entityType: 'Contrat', entityId: updated._id }).catch(() => {});
    notifyContractTenant(updated, { type: 'rental_lease_renewed', title: 'Votre bail a été renouvelé', body: 'Votre bail a été prolongé sans interruption.', entityType: 'Contrat', entityId: updated._id, dedupeKey: `tenant:lease_renewed:${updated._id}:${updated.avenants[updated.avenants.length - 1]._id}` }).catch(() => {});

    return { mode: 'prolongation', contrat: updated, ancien: null };
  }

  // ── Changement majeur : nouveau Contrat lié (règle métier) ───────────
  await transition(contrat._id, 'resilie', { actor, comment: motif || 'Renouvellement : changement majeur, nouveau contrat lié', action: 'renewal_major_change' });
  await transition(contrat._id, 'archive', { actor, comment: 'Superseded by renewal', action: 'renewal_major_change_archive' });

  const nouveauPayload = {
    type: payload.type || contrat.type,
    bien: payload.bien || contrat.bien?._id || contrat.bien,
    proprietaire: payload.proprietaire || contrat.proprietaire,
    locataire: payload.locataire || contrat.locataire,
    adresseBien: contrat.adresseBien,
    villeBien: contrat.villeBien,
    dateEntree: payload.dateEntree || new Date(),
    dateFinBail: payload.dateFinBail || contrat.dateFinBail,
    montantLoyer: payload.montantLoyer ?? contrat.montantLoyer,
    montantCaution: payload.montantCaution ?? contrat.montantCaution,
    dureePreavis: contrat.dureePreavis,
    indexationAnnuelle: contrat.indexationAnnuelle,
    chargesIncluses: contrat.chargesIncluses,
    montantCharges: contrat.montantCharges,
    statut: 'actif',
    cycleVie: 'actif',
    renouvelleDe: contrat._id,
  };
  const nouveau = await Contrat.create(nouveauPayload);
  contrat.renouvelePar = nouveau._id;
  await contrat.save();

  await generatePaiements(nouveau._id, nouveau.dateEntree, nouveau.dateFinBail, nouveau.montantLoyer);
  await syncLeaseOccupation(nouveau, actor);

  notifyStaff({ type: 'rental_lease_renewed', title: 'Nouveau bail (renouvellement majeur)', body: `Le bail #${contrat._id} a été renouvelé par un nouveau contrat #${nouveau._id}.`, entityType: 'Contrat', entityId: nouveau._id }).catch(() => {});
  notifyContractTenant(nouveau, { type: 'rental_lease_renewed', title: 'Nouveau bail établi', body: 'Un nouveau bail a été établi pour le renouvellement de votre location.', entityType: 'Contrat', entityId: nouveau._id, dedupeKey: `tenant:lease_renewed_new:${nouveau._id}` }).catch(() => {});

  return { mode: 'nouveau_contrat', contrat: nouveau, ancien: contrat };
}

module.exports = { renewLease, previewRenewal, isMajorChange, MAJOR_CHANGE_FIELDS };
