const Paiement = require('../models/Paiement');
const zohoMailService = require('./zohoMailService');

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

const verifierPaiementsEnRetard = async () => {
  const aujourd_hui = new Date();

  const paiements = await Paiement.find({
    statut: { $in: ['impayé', 'en_retard'] },
  }).populate({
    path: 'contrat',
    populate: [
      { path: 'locataire',    select: 'nom prenom email' },
      { path: 'proprietaire', select: 'nom prenom email' },
    ],
  });

  let nbPenalitesAppliquees = 0;

  for (const paiement of paiements) {
    const dateEcheance = new Date(paiement.annee, (paiement.mois || 1) - 1, 1);
    const retardJours  = Math.floor(
      (aujourd_hui - dateEcheance) / (1000 * 60 * 60 * 24),
    );

    if (retardJours <= 0) continue;

    const update = { retardJours, statut: 'en_retard' };

    if (retardJours >= SEUIL_RETARD && !paiement.penaliteAppliquee) {
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
