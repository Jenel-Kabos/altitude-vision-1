// GL-ASSET-1 — Phase 7 : alertes intelligentes du bien. Même convention que
// server/services/dossier/dossierHealthEngine.js (liste de checks
// {key, level, label}, jamais un champ stocké) — toutes dérivées à la
// lecture depuis les données déjà agrégées (historique, carnet d'entretien,
// valorisation).
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const { getPropertyHistory } = require('./propertyPatrimonialHistoryService');
const { getMaintenanceLogbook } = require('./propertyMaintenanceLogbookService');
const { computeValuation } = require('./propertyAssetValuationService');

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL_RANK = { conforme: 0, attention: 1, critique: 2 };
const worst = (a, b) => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);

// Types de documents attendus pour un bien en gestion locative active —
// même liste que celle déjà utilisée par le Centre documentaire
// (dossierHealthEngine.js : 'etat_entree' manquant, pièce d'identité
// manquante) : pas une nouvelle règle, juste appliquée au niveau du bien
// plutôt qu'au niveau d'un seul bail.
async function computeAlerts(propertyId) {
  const property = await Property.findById(propertyId).lean();
  if (!property) return { level: 'conforme', checks: [] };

  const [rental, history, logbook, valuation] = await Promise.all([
    RentalManagement.findOne({ property: propertyId }).lean(),
    getPropertyHistory(propertyId),
    getMaintenanceLogbook(propertyId),
    computeValuation(propertyId),
  ]);

  const checks = [];
  const now = Date.now();
  const contratActif = history.contrats.find((c) => c.statut === 'actif');

  if (contratActif?.dateFinBail) {
    const joursRestants = Math.ceil((new Date(contratActif.dateFinBail).getTime() - now) / DAY_MS);
    if (joursRestants <= 15 && joursRestants >= 0) checks.push({ key: 'bail_expire_imminent', level: 'critique', label: `Bail expire dans ${joursRestants} jour(s)` });
    else if (joursRestants <= 60 && joursRestants >= 0) checks.push({ key: 'bail_bientot_termine', level: 'attention', label: `Bail expire dans ${joursRestants} jours` });
  }

  if (rental?.plannedExitAt && !rental?.exitInspectionClearedAt && new Date(rental.plannedExitAt).getTime() < now) {
    checks.push({ key: 'inspection_oubliee', level: 'critique', label: "Sortie planifiée passée sans inspection validée" });
  }

  const ticketsEnRetard = logbook.tickets.filter((t) => !['resolu', 'cloture'].includes(t.status) && t.scheduledFor && new Date(t.scheduledFor).getTime() < now);
  if (ticketsEnRetard.length > 0) {
    checks.push({ key: 'entretien_en_retard', level: 'attention', label: `${ticketsEnRetard.length} intervention(s) programmée(s) en retard` });
  }

  // Aucun champ "assurance" n'existe sur aucun modèle du patrimoine —
  // signalé honnêtement comme non disponible plutôt qu'inventé.
  checks.push({ key: 'assurance_non_suivie', level: 'attention', label: 'Aucune donnée d\'assurance disponible dans le système' });

  const hasIdentiteDocs = history.documents.some((d) => d.type === "Pièce d'identité");
  if (history.locataires.length > 0 && !hasIdentiteDocs) {
    checks.push({ key: 'document_manquant', level: 'attention', label: "Pièce d'identité locataire manquante" });
  }

  if (property.availability === 'Disponible') {
    const dernierContrat = [...history.contrats].reverse().find((c) => c.dateSortie || c.dateFinBail);
    const depuis = dernierContrat ? new Date(dernierContrat.dateSortie || dernierContrat.dateFinBail) : new Date(property.createdAt);
    const joursVacant = Math.floor((now - depuis.getTime()) / DAY_MS);
    if (joursVacant >= 90) checks.push({ key: 'vacance_prolongee', level: 'critique', label: `Bien vacant depuis ${joursVacant} jours` });
    else if (joursVacant >= 30) checks.push({ key: 'vacance_prolongee', level: 'attention', label: `Bien vacant depuis ${joursVacant} jours` });
  }

  if (valuation?.rentabiliteNette !== null && valuation?.rentabiliteNette !== undefined && valuation.rentabiliteNette < 2) {
    checks.push({ key: 'faible_rentabilite', level: 'attention', label: `Rentabilité nette faible (${valuation.rentabiliteNette}%)` });
  }

  const paiementsPayes = history.paiements.filter((p) => p.statut === 'payé' && p.montantRecu);
  if (paiementsPayes.length >= 3) {
    const montants = paiementsPayes.map((p) => p.montantRecu);
    const moyenne = montants.reduce((s, m) => s + m, 0) / montants.length;
    const dernier = paiementsPayes[paiementsPayes.length - 1];
    if (moyenne > 0 && Math.abs(dernier.montantRecu - moyenne) / moyenne > 0.5) {
      checks.push({ key: 'paiement_inhabituel', level: 'attention', label: `Dernier paiement inhabituel (${dernier.montantRecu} vs moyenne ${Math.round(moyenne)})` });
    }
  }

  const level = checks.reduce((acc, c) => worst(acc, c.level), 'conforme');
  return { level, checks };
}

module.exports = { computeAlerts };
