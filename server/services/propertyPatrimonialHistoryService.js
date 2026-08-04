// GL-ASSET-1 — Phase 2 : historique patrimonial. Pure lecture/agrégation
// (même principe que server/services/dossier/) : aucune donnée n'est
// copiée ni stockée, tout est reconstruit à la demande depuis les
// collections déjà existantes.
const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const Transaction = require('../models/Transaction');
const Visite = require('../models/Visite');
const Document = require('../models/Document');

async function getPropertyHistory(propertyId) {
  const contrats = await Contrat.find({ bien: propertyId })
    .populate('proprietaire', 'nom prenom telephone')
    .populate('locataire', 'nom prenom telephone')
    .sort({ createdAt: 1 })
    .lean();

  const contratIds = contrats.map((c) => c._id);

  const [paiements, maintenances, transactions, visites, documents] = await Promise.all([
    contratIds.length ? Paiement.find({ contrat: { $in: contratIds } }).sort({ annee: 1, mois: 1 }).lean() : [],
    RentalMaintenanceTicket.find({ property: propertyId }).sort({ createdAt: 1 }).lean(),
    Transaction.find({ property: propertyId }).sort({ createdAt: 1 }).lean(),
    Visite.find({ property: propertyId }).sort({ createdAt: 1 }).lean(),
    Document.find({ $or: [{ relatedProperty: propertyId }, { entityType: 'Property', entityId: propertyId }] }).sort({ createdAt: 1 }).lean(),
  ]);

  // Propriétaires et locataires distincts qui se sont succédé sur ce bien —
  // reconstruits depuis les Contrat déjà chargés, jamais un second tableau.
  const proprietaires = [];
  const locataires = [];
  const seenProprietaires = new Set();
  const seenLocataires = new Set();
  contrats.forEach((c) => {
    if (c.proprietaire && !seenProprietaires.has(String(c.proprietaire._id))) {
      seenProprietaires.add(String(c.proprietaire._id));
      proprietaires.push(c.proprietaire);
    }
    if (c.locataire && !seenLocataires.has(String(c.locataire._id))) {
      seenLocataires.add(String(c.locataire._id));
      locataires.push(c.locataire);
    }
  });

  const etatsDesLieux = contrats.flatMap((c) => (c.etatsDesLieux || []).map((e) => ({ ...e, contratId: c._id })));

  return {
    propertyId,
    proprietaires, locataires, contrats, paiements, maintenances, transactions, visites, documents, etatsDesLieux,
  };
}

module.exports = { getPropertyHistory };
