const Paiement = require('../models/Paiement');

// Génère les échéances mensuelles inclusives d'un bail. Les décisions de
// création/renouvellement restent dans leurs orchestrateurs respectifs.
async function generatePaiements(contratId, dateEntree, dateFinBail, montantLoyer) {
  if (!dateEntree || !dateFinBail || !montantLoyer) return;

  const start = new Date(dateEntree);
  const end = new Date(dateFinBail);
  const rows = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    rows.push({
      contrat: contratId,
      mois: current.getMonth() + 1,
      annee: current.getFullYear(),
      montant: montantLoyer,
      statut: 'impayé',
    });
    current.setMonth(current.getMonth() + 1);
  }

  if (rows.length > 0) await Paiement.insertMany(rows);
}

module.exports = { generatePaiements };
