// GL-ASSET-1 — Phase 4 : valorisation du patrimoine. TOUT est calculé à la
// lecture depuis les données déjà existantes — rien n'est stocké.
//
// IMPORTANT (audit) : un fichier `propertyValuationService.js` existe déjà
// et sert un ENGIN D'ESTIMATION DE MARCHÉ totalement différent (comparables,
// coût de remplacement, capitalisation de revenu — utilisé par
// estimationController.js pour les demandes d'estimation gratuites,
// adresse-based, sans lien fiable vers un Property existant par ObjectId).
// Ce fichier NE le duplique PAS : il réutilise sa fonction pure
// `calculateRentalEstimate` (déjà exportée) pour le calcul de rentabilité
// brute/nette, au lieu de réécrire cette formule. `Estimation` (le modèle
// des demandes d'estimation) n'a aucun champ de rattachement fiable vers un
// Property réel — impossible de le joindre sans risquer une correspondance
// fausse ; `valeurEstimee` reste donc honnêtement `null` (aucune donnée),
// jamais inventée.
const Property = require('../models/Property');
const { calculateRentalEstimate } = require('./propertyValuationService');
const { getPropertyHistory } = require('./propertyPatrimonialHistoryService');
const { getMaintenanceLogbook } = require('./propertyMaintenanceLogbookService');

const DAY_MS = 24 * 60 * 60 * 1000;

function computeOccupiedDays(contrats) {
  return contrats.reduce((total, c) => {
    if (!c.dateEntree) return total;
    const start = new Date(c.dateEntree);
    const end = c.dateSortie ? new Date(c.dateSortie) : (c.statut === 'actif' ? new Date() : (c.dateFinBail ? new Date(c.dateFinBail) : new Date()));
    const days = Math.max(0, (end.getTime() - start.getTime()) / DAY_MS);
    return total + days;
  }, 0);
}

async function computeValuation(propertyId) {
  const property = await Property.findById(propertyId).select('price createdAt').lean();
  if (!property) return null;

  const [history, logbook] = await Promise.all([getPropertyHistory(propertyId), getMaintenanceLogbook(propertyId)]);
  const { contrats, paiements } = history;

  const currentYear = new Date().getFullYear();
  const paiementsPayes = paiements.filter((p) => p.statut === 'payé');
  const revenusGeneres = paiementsPayes.reduce((sum, p) => sum + (p.montantRecu || p.montant || 0), 0);
  const revenusAnnuels = paiementsPayes.filter((p) => p.annee === currentYear).reduce((sum, p) => sum + (p.montantRecu || p.montant || 0), 0);

  const revenusParAnnee = {};
  paiementsPayes.forEach((p) => {
    revenusParAnnee[p.annee] = (revenusParAnnee[p.annee] || 0) + (p.montantRecu || p.montant || 0);
  });

  const joursDepuisCreation = Math.max(1, (Date.now() - new Date(property.createdAt).getTime()) / DAY_MS);
  const joursOccupes = computeOccupiedDays(contrats);
  const tauxOccupation = Math.min(1, joursOccupes / joursDepuisCreation);
  const joursVacants = Math.max(0, joursDepuisCreation - joursOccupes);

  const coutMaintenance = logbook.coutTotal;
  const prix = property.price || 0;
  const loyerMoyenMensuel = revenusAnnuels > 0 ? revenusAnnuels / 12 : (contrats.find((c) => c.statut === 'actif')?.montantLoyer || 0);

  // Réutilise EXACTEMENT le calcul de rendement déjà écrit pour les
  // estimations (server/services/propertyValuationService.js) plutôt que
  // de réécrire la formule grossYield/netYield.
  let rentabilite = null;
  if (prix > 0 && loyerMoyenMensuel > 0) {
    try {
      rentabilite = calculateRentalEstimate({ monthlyRent: loyerMoyenMensuel, annualCharges: coutMaintenance, propertyValue: prix });
    } catch { rentabilite = null; }
  }

  return {
    propertyId,
    revenusGeneres, revenusAnnuels, revenusParAnnee,
    joursOccupes: Math.round(joursOccupes), joursVacants: Math.round(joursVacants), tauxOccupation,
    coutMaintenance,
    rentabiliteBrute: rentabilite?.grossYield ?? null,
    rentabiliteNette: rentabilite?.netYield ?? null,
    valeurReference: prix || null,
    valeurEstimee: null, // aucun moteur d'estimation fiable rattaché à ce Property — jamais inventé
  };
}

module.exports = { computeValuation };
