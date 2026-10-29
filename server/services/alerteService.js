const Paiement = require('../models/Paiement');
const Litige = require('../models/Litige');
const RentLatePenaltyAssessment = require('../models/RentLatePenaltyAssessment');
const zohoMailService = require('./zohoMailService');
const { activePenaltyEngine, ENGINES } = require('./finance/billing/rentPenaltyEngine');
const { ALTIMMO_MANDATORY_LATE_PENALTY: POLITIQUE, POLICY_TYPES } = require('../constants/leasePolicyConstants');

const JOUR_MS = 1000 * 60 * 60 * 24;
const LITIGE_OUVERT = ['Ouvert', 'En_cours_médiation', 'Escaladé'];

// Exigible au plus tard le 5 : le retard commence le 6 à 00:00, heure de
// Brazzaville (UTC+1, sans heure d'été), quel que soit le fuseau du serveur.
const BRAZZAVILLE_OFFSET_MS = 60 * 60 * 1000;
const premierJourPenalite = (paiement) => new Date(Date.UTC(paiement.annee, (paiement.mois || 1) - 1, POLITIQUE.firstPenaltyDay) - BRAZZAVILLE_OFFSET_MS);
const montantPenalite = (montant) => Math.round((montant * POLITIQUE.rateBasisPoints) / 10000);

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
const verifierPaiementsEnRetard = async ({ contratIds = null, now = null } = {}) => {
  // F-U2.11 — choke point unique de l'ancien moteur (cron + routes
  // `calculer-penalites`) : inactif dès que le moteur canonique est retenu.
  const engine = activePenaltyEngine();
  if (engine !== ENGINES.LEGACY) {
    console.log(`⚠️ [Alerte] ancien moteur de pénalités inactif (moteur : ${engine}) — aucun calcul`);
    return { verifies: 0, penalites: 0, skipped: true, engine };
  }
  const aujourd_hui = now ? new Date(now) : new Date();

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
  let nbARevoir = 0;

  for (const paiement of paiements) {
    const debutRetard = premierJourPenalite(paiement);
    if (aujourd_hui < debutRetard) continue; // payable jusqu'au 5 inclus
    const retardJours = Math.floor((aujourd_hui - debutRetard) / JOUR_MS) + 1;

    const update = { retardJours, statut: 'en_retard' };

    if (!paiement.penaliteAppliquee && !canonicalKeys.has(periodKey(paiement))) {
      const decision = await decisionPenaliteObligatoire(paiement);
      if (decision.action === 'APPLY') {
        const penalite = montantPenalite(paiement.montant);
        const outcome = await claimAndSendPenaltyEmail({ paiement, penalite, retardJours, now: aujourd_hui });
        if (outcome.claimed) { nbPenalitesAppliquees++; continue; }
      } else if (decision.action === 'REVIEW') {
        const flagged = await Paiement.updateOne(
          { _id: paiement._id, penaliteAppliquee: { $ne: true }, 'penaltyReview.status': { $exists: false } },
          { $set: { penaltyReview: { status: 'REQUIRED', reason: decision.reason, flaggedAt: aujourd_hui } } },
        );
        if (flagged.modifiedCount) nbARevoir++;
      } else continue; // payé dans le délai : ni retard ni pénalité
    }

    await Paiement.findByIdAndUpdate(paiement._id, update);
  }

  console.log(
    `✅ [Alerte] ${paiements.length} paiements vérifiés, ` +
    `${nbPenalitesAppliquees} pénalités appliquées, ${nbARevoir} dossiers à revoir`,
  );
  return { verifies: paiements.length, penalites: nbPenalitesAppliquees, aRevoir: nbARevoir };
};

// GIT-INTEGRATION-02A — politique de retard obligatoire Altimmo. Aucune option
// de bail ne neutralise ni ne modifie le taux ; l'absence de politique
// contractuelle n'exonère pas. Ce que le code ne peut pas trancher
// (conditions propres divergentes, litige de paiement ouvert, données
// incohérentes) est signalé pour décision humaine : ni pénalité, ni exonération.
const APPLY = (reason) => ({ action: 'APPLY', reason });
const REVIEW = (reason) => ({ action: 'REVIEW', reason });

const decisionPenaliteObligatoire = async (paiement) => {
  const contrat = paiement.contrat;
  if (!contrat?._id || !contrat.bien || !paiement.annee || !paiement.mois) return REVIEW('LEASE_DATA_INCOMPLETE');
  if (paiement.datePaiement && new Date(paiement.datePaiement) < premierJourPenalite(paiement)) return { action: 'SKIP', reason: 'PAID_BEFORE_DEADLINE' };
  const litige = await Litige.exists({ type: 'Problème_paiement', bienConcerné: contrat.bien, statut: { $in: LITIGE_OUVERT } });
  if (litige) return REVIEW('PAYMENT_DISPUTE_OPEN');

  const { resolvePolicyForPeriod } = require('./finance/billing/leasePolicyService');
  const label = `${paiement.annee}-${String(paiement.mois).padStart(2, '0')}`;
  const resolution = await resolvePolicyForPeriod({ lease: contrat._id, propertyId: contrat.bien, periodLabel: label });
  if (resolution.status !== 'RESOLVED') {
    return resolution.reason === 'NO_POLICY' ? APPLY('ALTIMMO_POLICY_NO_LEASE_POLICY') : REVIEW(resolution.reason || 'POLICY_UNRESOLVED');
  }
  if (resolution.policy.type === POLICY_TYPES.ALTITUDE_DELEGATED) return APPLY('ALTIMMO_POLICY_DELEGATED');
  // Conditions propres au bail : appliquées seulement si identiques à la
  // politique Altimmo ; sinon droits contractuels préexistants à vérifier.
  const stipulated = resolution.terms?.penalty;
  if (stipulated?.rateBasisPoints === POLITIQUE.rateBasisPoints && stipulated.base === POLITIQUE.base) return APPLY('LEASE_TERMS_MATCH_ALTIMMO_POLICY');
  return REVIEW(stipulated ? 'LEASE_PENALTY_RATE_DIFFERS' : 'LEASE_POLICY_WITHOUT_PENALTY');
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

    <p>Conformément à la politique de gestion locative Altimmo, le loyer est exigible
    au plus tard le 5 ; une pénalité unique de 3 % est appliquée à partir du 6 du mois.</p>

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

module.exports = { verifierPaiementsEnRetard, claimAndSendPenaltyEmail, penaltyEmailKey, decisionPenaliteObligatoire };
