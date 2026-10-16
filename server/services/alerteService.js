const Paiement = require('../models/Paiement');
const RentLatePenaltyAssessment = require('../models/RentLatePenaltyAssessment');
const zohoMailService = require('./zohoMailService');
const { activePenaltyEngine, ENGINES } = require('./finance/billing/rentPenaltyEngine');

const TAUX_PENALITE = 0.03;
const SEUIL_RETARD  = 5; // jours (retard >= 5j = à partir du 6 du mois)

const MOIS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

const penaltyEmailKey = (paiement) => `rental-penalty:${paiement._id}:${paiement.annee}-${paiement.mois}:v1`;

const claimAndSendPenaltyEmail = async ({ paiement, penalite, retardJours, now = new Date() }) => {
  const key = penaltyEmailKey(paiement);
  const claimed = await Paiement.findOneAndUpdate(
    {
      _id: paiement._id,
      penaliteAppliquee: { $ne: true },
      'penaltyEmailDelivery.status': { $exists: false },
    },
    {
      $set: {
        retardJours,
        statut: 'en_retard',
        penaliteAppliquee: true,
        penaliteMontant: penalite,
        montantTotal: paiement.montant + penalite,
        dateDebutRetard: new Date(paiement.annee, (paiement.mois || 1) - 1, 1),
        penaltyEmailDelivery: { key, status: 'sending', claimedAt: now },
      },
    },
    { new: true },
  );
  if (!claimed) return { claimed: false, sent: false, key };

  const locataire = paiement.contrat?.locataire;
  if (!locataire?.email) {
    await Paiement.updateOne(
      { _id: paiement._id, 'penaltyEmailDelivery.key': key, 'penaltyEmailDelivery.status': 'sending' },
      { $set: { 'penaltyEmailDelivery.status': 'unknown', 'penaltyEmailDelivery.error': 'recipient_missing' } },
    );
    return { claimed: true, sent: false, key, status: 'unknown' };
  }

  try {
    await envoyerEmailRetard(paiement, penalite, retardJours, locataire);
    await Paiement.updateOne(
      { _id: paiement._id, 'penaltyEmailDelivery.key': key, 'penaltyEmailDelivery.status': 'sending' },
      { $set: { 'penaltyEmailDelivery.status': 'sent', 'penaltyEmailDelivery.sentAt': new Date() }, $unset: { 'penaltyEmailDelivery.error': 1 } },
    );
    return { claimed: true, sent: true, key, status: 'sent' };
  } catch (error) {
    await Paiement.updateOne(
      { _id: paiement._id, 'penaltyEmailDelivery.key': key, 'penaltyEmailDelivery.status': 'sending' },
      { $set: { 'penaltyEmailDelivery.status': 'unknown', 'penaltyEmailDelivery.error': String(error.message || error).slice(0, 500) } },
    );
    return { claimed: true, sent: false, key, status: 'unknown' };
  }
};

// USER-TENANT-MEMBERSHIP-ARCHITECTURE-2E.1.X-I-TENANT-CONTEXT-B.2 —
// `contratIds` (optionnel) : restreint la vérification aux Contrats
// canoniquement scopés au tenant appelant (résolus en amont par le
// contrôleur via `scopedContratIdsForTenant`). Sans argument (scheduler
// SYSTEM_INTERNAL), comportement inchangé — traite tous les paiements en
// retard, comportement historique préservé. L'absence d'argument N'EST
// JAMAIS déduite d'une absence d'input de requête : c'est l'appelant
// interne qui décide explicitement d'un scope tenant.
const verifierPaiementsEnRetard = async ({ contratIds = null } = {}) => {
  // F-U2.11 — choke point unique de l'ancien moteur (cron + routes
  // `calculer-penalites`) : inactif dès que le moteur canonique est retenu.
  const engine = activePenaltyEngine();
  if (engine !== ENGINES.LEGACY) {
    console.log(`⚠️ [Alerte] ancien moteur de pénalités inactif (moteur : ${engine}) — aucun calcul`);
    return { verifies: 0, penalites: 0, skipped: true, engine };
  }
  const aujourd_hui = new Date();

  const filter = { statut: { $in: ['impayé', 'en_retard'] } };
  if (Array.isArray(contratIds)) {
    // Tenant-local execution : aucune fuite cross-tenant.
    if (contratIds.length === 0) return { verifies: 0, penalites: 0 };
    filter.contrat = { $in: contratIds };
  }

  const paiements = await Paiement.find(filter).populate({
    path: 'contrat',
    populate: [
      { path: 'locataire',    select: 'nom prenom email' },
      { path: 'proprietaire', select: 'nom prenom email' },
    ],
  });

  let nbPenalitesAppliquees = 0;
  // F-U2.11 — garde par échéance : jamais de pénalité historique sur une
  // échéance déjà évaluée par le moteur canonique (retour arrière compris).
  const leaseIds = [...new Set(paiements.map((p) => String(p.contrat?._id || p.contrat)).filter(Boolean))];
  const canonical = leaseIds.length ? await RentLatePenaltyAssessment.find({ lease: { $in: leaseIds } }).select('lease period').lean() : [];
  const canonicalKeys = new Set(canonical.map((a) => `${a.lease}:${a.period}`));
  const periodKey = (p) => `${p.contrat?._id || p.contrat}:${p.annee}-${String(p.mois).padStart(2, '0')}`;
  // F-U2.13 — l'ancien moteur ne peut plus imposer une pénalité hors politique
  // contractuelle : seulement si la politique du bail pour la période stipule
  // une pénalité (et, pour les conditions Altitude Vision, après acceptation
  // du locataire). Sinon : aucun calcul ni e-mail de pénalité.
  const allowedByPolicy = async (paiement) => {
    const contrat = paiement.contrat;
    if (!contrat?._id || !contrat.bien || !paiement.annee || !paiement.mois) return false;
    const { resolvePolicyForPeriod, consentStatusAt } = require('./finance/billing/leasePolicyService');
    const label = `${paiement.annee}-${String(paiement.mois).padStart(2, '0')}`;
    const resolution = await resolvePolicyForPeriod({ lease: contrat._id, propertyId: contrat.bien, periodLabel: label });
    if (resolution.status !== 'RESOLVED' || !resolution.terms?.penalty) return false;
    return (await consentStatusAt(resolution, aujourd_hui)).valid;
  };

  for (const paiement of paiements) {
    const dateEcheance = new Date(paiement.annee, (paiement.mois || 1) - 1, 1);
    const retardJours  = Math.floor(
      (aujourd_hui - dateEcheance) / (1000 * 60 * 60 * 24),
    );

    if (retardJours <= 0) continue;

    const update = { retardJours, statut: 'en_retard' };

    if (retardJours >= SEUIL_RETARD && !paiement.penaliteAppliquee && !canonicalKeys.has(periodKey(paiement)) && await allowedByPolicy(paiement)) {
      const penalite = Math.round(paiement.montant * TAUX_PENALITE);
      const outcome = await claimAndSendPenaltyEmail({ paiement, penalite, retardJours, now: aujourd_hui });
      if (outcome.claimed) nbPenalitesAppliquees++;
      if (outcome.claimed) continue;
    }

    await Paiement.findByIdAndUpdate(paiement._id, update);
  }

  console.log(
    `✅ [Alerte] ${paiements.length} paiements vérifiés, ` +
    `${nbPenalitesAppliquees} pénalités appliquées`,
  );
  return { verifies: paiements.length, penalites: nbPenalitesAppliquees };
};

const envoyerEmailRetard = async (paiement, penalite, retardJours, locataire) => {
  const moisLabel = `${MOIS_FR[(paiement.mois || 1) - 1]} ${paiement.annee}`;
  const total     = paiement.montant + penalite;
  const fmt       = (n) => n.toLocaleString('fr-FR');

  const subject = `⚠️ Loyer en retard — ${moisLabel}`;
  const html = `
    <p>Bonjour ${locataire.prenom} ${locataire.nom},</p>

    <p>Votre loyer du mois de <strong>${moisLabel}</strong> est en retard
    de <strong>${retardJours} jour(s)</strong>.</p>

    <h3>Détail du montant dû :</h3>
    <table style="border-collapse:collapse;margin:12px 0">
      <tr>
        <td style="padding:6px 16px 6px 0">Loyer mensuel</td>
        <td><strong>${fmt(paiement.montant)} FCFA</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;color:#D42B2B">Pénalité (3%)</td>
        <td style="color:#D42B2B"><strong>${fmt(penalite)} FCFA</strong></td>
      </tr>
      <tr style="border-top:1px solid #eee">
        <td style="padding:6px 16px 6px 0"><strong>TOTAL À PAYER</strong></td>
        <td><strong>${fmt(total)} FCFA</strong></td>
      </tr>
    </table>

    <p>Conformément aux conditions de votre bail, une pénalité de 3 % est appliquée
    à partir du 6 du mois.</p>

    <p>Merci de régulariser votre situation dans les plus brefs délais.</p>

    <p>Cordialement,<br/>Altitude Vision — Altimmo</p>
  `;

  await zohoMailService.sendEmail(
    process.env.ZOHO_FROM || 'altimmo@altitudevision.agency',
    locataire.email,
    subject,
    html,
  );
};

module.exports = { verifierPaiementsEnRetard, claimAndSendPenaltyEmail, penaltyEmailKey };
