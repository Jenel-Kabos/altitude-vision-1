// server/services/tenantPortalService.js — Dette technique GL-B2 (Mission 2)
//
// Prépare le futur portail locataire. Toutes les fonctions partent d'un
// `userId` (jamais d'un `locataireId` fourni par le frontend) et résolvent
// le dossier via tenantLinkService.resolveLocataireForUser — voir Mission 1 :
//
//   req.user ↓ Locataire ↓ Contrats ↓ Paiements
//
// N'expose que des projections minimales (jamais `notes` internes du
// dossier, jamais de champ d'un AUTRE locataire).

const Contrat = require('../models/Contrat');
const Paiement = require('../models/Paiement');
const RentalManagement = require('../models/RentalManagement');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const rentalMaintenanceService = require('./rentalMaintenanceService');
const { resolveLocataireForUser } = require('./tenantLinkService');

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function requireLocataire(userId) {
  const locataire = await resolveLocataireForUser(userId);
  if (!locataire) throw fail('Aucun dossier locataire rattaché à ce compte.', 404);
  return locataire;
}

/** Bail actif préféré, sinon le plus récent — même règle que locataireController.loadDossierData. */
async function getActiveLease(locataireId) {
  const leases = await Contrat.find({ locataire: locataireId, type: 'location' })
    .sort({ createdAt: -1 })
    .populate('bien', 'title address owner');
  return leases.find((c) => c.statut === 'actif') || leases[0] || null;
}

async function getMyProfile(userId) {
  const locataire = await requireLocataire(userId);
  // Jamais `notes` (commentaires internes staff) exposés au locataire.
  const { nom, prenom, email, telephone, adresse, ville, profession, revenuMensuel, pieceIdentite, _id } = locataire;
  return { _id, nom, prenom, email, telephone, adresse, ville, profession, revenuMensuel, pieceIdentite };
}

async function getMyLease(userId) {
  const locataire = await requireLocataire(userId);
  const lease = await getActiveLease(locataire._id);
  if (!lease) return null;
  return {
    _id: lease._id, bien: lease.bien, statut: lease.statut,
    dateEntree: lease.dateEntree, dateSortie: lease.dateSortie, dateFinBail: lease.dateFinBail,
    montantLoyer: lease.montantLoyer, montantCaution: lease.montantCaution, cautionVersee: lease.cautionVersee,
    dureePreavis: lease.dureePreavis, chargesIncluses: lease.chargesIncluses, montantCharges: lease.montantCharges,
  };
}

async function getMyPayments(userId) {
  const locataire = await requireLocataire(userId);
  const lease = await getActiveLease(locataire._id);
  if (!lease) return [];
  return Paiement.find({ contrat: lease._id })
    .select('mois annee montant montantTotal montantRecu statut modePaiement reference datePaiement penaliteAppliquee penaliteMontant retardJours')
    .sort({ annee: -1, mois: -1 });
}

/** Reçus/quittances — réutilise Contrat.documents[] (jamais dupliqué). */
async function getMyDocuments(userId) {
  const locataire = await requireLocataire(userId);
  const lease = await getActiveLease(locataire._id);
  const leaseDocuments = lease ? (lease.documents || []).map((d) => ({ nom: d.nom, url: d.url, type: d.type, dateGeneration: d.dateGeneration })) : [];
  return leaseDocuments;
}

async function getMyNotice(userId) {
  const locataire = await requireLocataire(userId);
  const lease = await getActiveLease(locataire._id);
  if (!lease) return null;
  const rental = await RentalManagement.findOne({ activeLease: lease._id }).select('occupancyStatus noticeStartedAt noticeAcknowledgedAt plannedExitAt');
  if (!rental || rental.occupancyStatus !== 'sortie_programmee') return null;
  return {
    noticeStartedAt: rental.noticeStartedAt, noticeAcknowledgedAt: rental.noticeAcknowledgedAt, plannedExitAt: rental.plannedExitAt,
  };
}

/**
 * Création d'une demande de maintenance depuis le portail — `propertyId`/
 * `leaseId`/`tenantId` sont TOUJOURS résolus côté serveur à partir du bail
 * actif du locataire connecté, jamais acceptés depuis le corps de la
 * requête (mission : "ne jamais faire confiance à un ID envoyé par le
 * frontend").
 */
async function createMyMaintenanceRequest(userId, { category, description }) {
  const locataire = await requireLocataire(userId);
  const lease = await getActiveLease(locataire._id);
  if (!lease) throw fail('Aucun bail actif — impossible de créer une demande de maintenance.', 409);
  if (!RentalMaintenanceTicket.RENTAL_MAINTENANCE_CATEGORIES.includes(category)) throw fail('Catégorie invalide.', 422);
  if (!description || !String(description).trim()) throw fail('La description du problème est requise.', 422);

  const property = lease.bien;
  const propertyId = property?._id || property;
  if (!propertyId) throw fail('Bien introuvable pour ce bail.', 409);
  // Réutilise rentalMaintenanceService.createTicket (synchronisation
  // RentalManagement.maintenanceStatus + notifications déjà centralisées
  // là, jamais dupliquées ici — Mission 6).
  return rentalMaintenanceService.createTicket({
    propertyId, leaseId: lease._id, tenantId: locataire._id, ownerId: property?.owner || null,
    category, priority: 'normale', description, actingUser: { id: userId },
  });
}

module.exports = {
  requireLocataire, getActiveLease,
  getMyProfile, getMyLease, getMyPayments, getMyDocuments, getMyNotice, createMyMaintenanceRequest,
};
