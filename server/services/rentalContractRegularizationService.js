const mongoose = require('mongoose');
const Contrat = require('../models/Contrat');
const Property = require('../models/Property');
const RentalManagement = require('../models/RentalManagement');
const Reconciliation = require('../models/RentalContractReconciliation');
const onboarding = require('./rentalAssetOnboardingService');
const { ensureRentalManagementActive, syncLeaseOccupation } = require('./rentalManagementLeaseSyncService');
const { logAction, buildAuteur } = require('./actionLogService');

class RegularizationError extends Error {
  constructor(message, statusCode = 409, code = 'REGULARIZATION_ERROR') { super(message); this.statusCode = statusCode; this.code = code; }
}

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const snapshot = (contract, property, rental) => ({
  contract: { bien: contract.bien || null, statut: contract.statut, cycleVie: contract.cycleVie || null },
  property: property ? { _id: property._id, availability: property.availability, isPublished: property.isPublished, assetCycle: property.assetCycle || null } : null,
  rental: rental ? {
    _id: rental._id, active: rental.active, managementActivated: rental.managementActivated,
    activeLease: rental.activeLease || null, currentTenant: rental.currentTenant || null,
    occupancyStatus: rental.occupancyStatus, availabilityStatus: rental.availabilityStatus,
    publicationStatus: rental.publicationStatus,
  } : null,
});

function scoreProperty(contract, property, ownerUserId) {
  const reasons = [];
  let score = 0;
  if (ownerUserId && String(property.owner) === String(ownerUserId)) { score += 55; reasons.push('propriétaire explicitement lié'); }
  if (normalize(contract.villeBien) && normalize(property.address?.city) === normalize(contract.villeBien)) { score += 20; reasons.push('même ville'); }
  const address = normalize(contract.adresseBien);
  const street = normalize(property.address?.street);
  if (address && street && (address.includes(street) || street.includes(address))) { score += 20; reasons.push('adresse proche'); }
  if (contract.montantLoyer && property.price) {
    const delta = Math.abs(contract.montantLoyer - property.price) / Math.max(contract.montantLoyer, property.price);
    if (delta <= 0.1) { score += 5; reasons.push('loyer proche'); }
  }
  return { score, reasons };
}

async function getCases() {
  const decisions = await Reconciliation.find({}).lean();
  const contracts = await Contrat.find({
    type: 'location',
    $or: [
      { statut: { $in: ['actif', 'en_attente'] }, bien: null },
      { _id: { $in: decisions.map((decision) => decision.contract) } },
    ],
  })
    .populate('locataire', 'nom prenom email telephone')
    .populate('proprietaire', 'nom prenom email telephone ville user biensPropres')
    .sort({ createdAt: 1 }).lean();
  const properties = await Property.find({ status: 'location' }).select('title type price address owner availability assetCycle internalManagedOnly').lean();
  const decisionByContract = new Map(decisions.map((decision) => [String(decision.contract), decision]));
  return contracts.map((contract) => {
    const scored = properties.map((property) => ({ ...property, ...scoreProperty(contract, property, contract.proprietaire?.user) }))
      .filter((property) => property.score > 0 && !['Vendu', 'Retiré'].includes(property.availability) && !['vendu', 'archive'].includes(property.assetCycle))
      .sort((a, b) => b.score - a.score).slice(0, 8);
    return {
      contract,
      decision: decisionByContract.get(String(contract._id)) || null,
      missingFields: ['montantLoyer', 'dateEntree', 'dateFinBail'].filter((field) => !contract[field]),
      compatibleProperties: scored,
      ownerAssets: contract.proprietaire?.biensPropres || [],
    };
  });
}

async function loadOpenCase(contractId) {
  if (!mongoose.isValidObjectId(contractId)) throw new RegularizationError('Contrat invalide.', 400, 'INVALID_CONTRACT');
  const contract = await Contrat.findOne({ _id: contractId, type: 'location', statut: { $in: ['actif', 'en_attente'] }, bien: null }).populate('proprietaire');
  if (!contract) throw new RegularizationError('Ce contrat n’est plus régularisable.', 409, 'CASE_NOT_PENDING');
  const existing = await Reconciliation.findOne({ contract: contract._id });
  if (existing && existing.status !== 'pending' && existing.status !== 'reverted') throw new RegularizationError('Une décision active existe déjà.', 409, 'DECISION_ALREADY_EXISTS');
  return { contract, record: existing || new Reconciliation({ contract: contract._id }) };
}

async function assertProperty(contract, propertyId) {
  const property = await Property.findById(propertyId);
  if (!property || property.status !== 'location') throw new RegularizationError('Property locatif introuvable.', 404, 'PROPERTY_NOT_FOUND');
  if (['Vendu', 'Retiré'].includes(property.availability) || ['vendu', 'archive'].includes(property.assetCycle)) throw new RegularizationError('Ce bien est clôturé ou indisponible.', 409, 'PROPERTY_BLOCKED');
  if (!contract.proprietaire?.user || String(property.owner) !== String(contract.proprietaire.user)) throw new RegularizationError('Le propriétaire du Property ne correspond pas à la fiche du contrat.', 409, 'OWNER_MISMATCH');
  const competing = await Contrat.exists({ _id: { $ne: contract._id }, bien: property._id, type: 'location', statut: { $in: ['actif', 'en_attente'] } });
  if (competing) throw new RegularizationError('Un autre contrat ouvert existe sur ce Property.', 409, 'OPEN_CONTRACT_CONFLICT');
  return property;
}

async function finish({ contract, record, decision, property, rental, actor, reason, before, createdProperty = false }) {
  const after = snapshot(contract, property, rental);
  record.status = decision === 'flag_anomaly' ? 'anomaly' : 'resolved';
  record.decision = decision; record.property = property?._id || null; record.createdProperty = createdProperty;
  record.decidedBy = actor._id || actor.id; record.decidedAt = new Date();
  record.events.push({ action: decision, actor: actor._id || actor.id, reason, before, after });
  await record.save();
  await logAction({
    action: 'Régularisation contrat historique', description: `${decision} — ${reason}`, module: 'GestionLocative',
    auteur: buildAuteur(actor), cible: { id: String(contract._id), type: 'Contrat', nom: `Contrat #${contract._id}` },
    typeAction: decision === 'flag_anomaly' ? 'VALIDATION' : 'MODIFICATION',
    metadata: { ancienneValeur: JSON.stringify(before), nouvelleValeur: JSON.stringify(after) },
  });
  return record;
}

async function decide({ contractId, action, data, actor }) {
  const reason = String(data.reason || '').trim();
  if (reason.length < 5) throw new RegularizationError('Un motif explicite est obligatoire.', 422, 'REASON_REQUIRED');
  const { contract, record } = await loadOpenCase(contractId);

  if (action === 'flag_anomaly') return finish({ contract, record, decision: action, actor, reason, before: snapshot(contract), createdProperty: false });
  if (action === 'close_historical') {
    const before = snapshot(contract);
    contract.cycleHistory.push({ from: contract.cycleVie || 'actif', to: 'archive', action: 'regularization_historical_close', actor: actor._id || actor.id, comment: reason });
    contract.statut = 'résilié'; contract.cycleVie = 'archive'; await contract.save();
    return finish({ contract, record, decision: action, actor, reason, before });
  }

  let property; let rental; let createdProperty = false;
  if (action === 'link_existing') {
    property = await assertProperty(contract, data.propertyId);
    rental = await RentalManagement.findOne({ property: property._id });
    const before = snapshot(contract, property, rental);
    rental = await ensureRentalManagementActive({ property, actor: actor._id || actor.id, monthlyRent: contract.montantLoyer });
    contract.bien = property._id; await contract.save(); await syncLeaseOccupation(contract, actor._id || actor.id);
    rental = await RentalManagement.findOne({ property: property._id }); property = await Property.findById(property._id);
    return finish({ contract, record, decision: action, property, rental, actor, reason, before });
  }
  if (action === 'create_internal') {
    if (!contract.proprietaire?.user) throw new RegularizationError('La fiche Propriétaire doit être liée à un compte avant de créer le Property.', 422, 'OWNER_USER_REQUIRED');
    const created = await onboarding.createManaged({ data: { ...data.property, owner: contract.proprietaire.user, monthlyRent: data.property?.monthlyRent || contract.montantLoyer }, actor });
    property = created.property; rental = await RentalManagement.findOne({ property: property._id }); createdProperty = true;
    const before = snapshot(contract, property, rental);
    contract.bien = property._id; await contract.save(); await syncLeaseOccupation(contract, actor._id || actor.id);
    rental = await RentalManagement.findOne({ property: property._id }); property = await Property.findById(property._id);
    return finish({ contract, record, decision: action, property, rental, actor, reason, before, createdProperty });
  }
  throw new RegularizationError('Décision inconnue.', 422, 'UNKNOWN_DECISION');
}

async function revert({ contractId, reason, actor }) {
  if (actor.role !== 'Admin') throw new RegularizationError('Réversion réservée à l’Administrateur.', 403, 'ADMIN_REQUIRED');
  if (String(reason || '').trim().length < 5) throw new RegularizationError('Un motif de réversion est obligatoire.', 422, 'REASON_REQUIRED');
  const record = await Reconciliation.findOne({ contract: contractId });
  if (!record || !['resolved', 'anomaly'].includes(record.status)) throw new RegularizationError('Aucune décision réversible.', 409, 'NOT_REVERSIBLE');
  const event = record.events[record.events.length - 1];
  const contract = await Contrat.findById(contractId);
  if (!contract) throw new RegularizationError('Contrat introuvable.', 404, 'CONTRACT_NOT_FOUND');
  if (record.property && contract.bien && String(contract.bien) !== String(record.property)) throw new RegularizationError('Le contrat a divergé depuis la décision.', 409, 'STATE_DIVERGED');
  const beforeRevert = snapshot(contract);
  const original = event.before?.contract || {};
  contract.bien = original.bien || null; contract.statut = original.statut; contract.cycleVie = original.cycleVie || null; await contract.save();
  if (event.before?.property?._id) {
    const { _id, ...propertyState } = event.before.property;
    await Property.updateOne({ _id }, { $set: propertyState });
  }
  if (event.before?.rental?._id) {
    const { _id, ...rentalState } = event.before.rental;
    await RentalManagement.updateOne({ _id }, { $set: rentalState });
  } else if (record.property) {
    await RentalManagement.updateOne(
      { property: record.property, activeLease: contract._id },
      { $set: { activeLease: null, currentTenant: null, occupancyStatus: 'vacant', availabilityStatus: 'disponible', publicationStatus: 'brouillon' } },
    );
    await Property.updateOne({ _id: record.property }, { $set: { availability: 'Disponible', isPublished: false } });
  }
  record.status = 'reverted'; record.events.push({ action: 'revert', actor: actor._id || actor.id, reason, before: beforeRevert, after: snapshot(contract) }); await record.save();
  await logAction({ action: 'Réversion régularisation contrat', description: reason, module: 'GestionLocative', auteur: buildAuteur(actor), cible: { id: String(contract._id), type: 'Contrat', nom: `Contrat #${contract._id}` }, typeAction: 'MODIFICATION', metadata: { ancienneValeur: JSON.stringify(beforeRevert), nouvelleValeur: JSON.stringify(snapshot(contract)) } });
  return record;
}

module.exports = { getCases, decide, revert, RegularizationError };
