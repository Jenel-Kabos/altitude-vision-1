const aggregatePaymentSummary = async (Paiement, match) => {
  const rows = await Paiement.aggregate([
    { $match: match },
    { $project: {
      due: { $ifNull: ['$montantTotal', { $ifNull: ['$montant', 0] }] },
      received: { $ifNull: ['$montantRecu', 0] },
      penalties: { $ifNull: ['$penaliteMontant', 0] },
    } },
    { $group: {
      _id: null,
      du: { $sum: '$due' },
      recu: { $sum: '$received' },
      penalites: { $sum: '$penalties' },
      restant: { $sum: { $max: [0, { $subtract: ['$due', '$received'] }] } },
    } },
  ]);
  return rows[0] ? { du: rows[0].du, recu: rows[0].recu, penalites: rows[0].penalites, restant: rows[0].restant } : { du: 0, recu: 0, penalites: 0, restant: 0 };
};

const publicPayment = (payment) => ({
  ...payment,
  restant: Math.max(0, (payment.montantTotal ?? payment.montant ?? 0) - (payment.montantRecu ?? 0)),
  recuDisponible: payment.statut === 'payé',
});

module.exports = { aggregatePaymentSummary, publicPayment };
