// F-U2.1 — Facturation des loyers à partir des baux (Contrat type location).
//
// Une obligation = un FinancialDocument (domaine `rental`, établissement =
// bien) par bail et par mois, clé `rent:<bail>:<AAAA-MM>`. Un changement de
// bail ne peut pas refacturer un mois déjà facturé pour le même bien.
//
// Règles (aucune valeur inventée) :
//   - loyer = Contrat.montantLoyer ; charges = Contrat.montantCharges si elles
//     ne sont pas incluses ; AUCUNE pénalité ni frais (le bail ne les porte pas
//     dans un champ contractuel exploitable — la pénalité historique de
//     `Paiement` n'est pas reprise) ;
//   - F-U2.10 : facturation à partir du 30 (février : 28), échéance au 5 du
//     mois suivant (fin de journée, Africa/Brazzaville) — rentCalendarService ;
//   - premier loyer au prorata (jour d'entrée inclus, base 30) si une clause du
//     bail est citée ; règles proposées (mois de 31 jours, février), sortie
//     anticipée, changement de loyer en cours de mois, prorata des charges :
//     NON décidés → refus explicite ;
//   - l'échéancier historique (`Paiement`) reste informatif (écart signalé).
//   - émetteur : mandataire (PLATFORM/TENANT) en encaissement agence, ou
//     organisation gestionnaire ; bailleur personne physique (paiement direct
//     ou sans organisation) → brouillon de suivi uniquement.

const mongoose = require('mongoose');
const Contrat = require('../../../models/Contrat');
const Property = require('../../../models/Property');
const Locataire = require('../../../models/Locataire');
const Paiement = require('../../../models/Paiement');
const User = require('../../../models/User');
const FinancialDocument = require('../../../models/FinancialDocument');
const ManagementMandate = require('../../../models/ManagementMandate');
const ManagementMandateVersion = require('../../../models/ManagementMandateVersion');
const C = require('../../../constants/contractualFinanceConstants');
const { BILLING_KINDS } = require('../../../constants/billingConstants');
const { fail } = require('../financialError');
const { runFinancialOperation } = require('../financialTransactionService');
const { computePayoutPeriod } = require('../contractual/mandateTermsService');
const counters = require('../contractual/financialLimitCounterService');
const authz = require('../contractual/contractualFinanceAuthorizationService');
const { createBillingDraft } = require('./billingDocumentService');
const calendar = require('./rentCalendarService');
const { resourceScope, authorizeOnProperty } = require('./rentPropertyAuthorityService');
const RentLeaseExit = require('../../../models/RentLeaseExit');
const { resolvePolicyForPeriod } = require('./leasePolicyService');
const { RENT_PRORATA_POLICY } = require('../../../constants/rentCollectionConstants');

const { CONTRACTUAL_CAPABILITIES: CAP } = authz;
const DAY = 86400000;

function parsePeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) fail('BILLING_PERIOD_INVALID', 'Période attendue au format AAAA-MM.', 422);
  const year = Number(match[1]); const month = Number(match[2]);
  // Mois contractuel dans le fuseau WAT (même découpage que les mandats).
  const { start, end } = computePayoutPeriod({ frequency: C.PAYOUT_FREQUENCIES.MONTHLY, at: new Date(Date.UTC(year, month - 1, 15)) });
  return { year, month, start, end, label: period };
}

// Arrondi entier « moitié vers le haut », déterministe.
const prorateMinor = (amount, numerator, denominator) => Math.floor((amount * numerator * 2 + denominator) / (denominator * 2));

function leaseCoverage(lease, period) {
  const startLease = lease.dateEntree ? new Date(lease.dateEntree) : null;
  if (!startLease) fail('LEASE_START_UNDETERMINED', 'Date d’entrée du bail absente.', 409);
  const endDate = lease.dateSortie || lease.dateFinBail;
  const endExclusive = endDate ? new Date(new Date(endDate).getTime() + DAY) : null;
  const from = Math.max(startLease.getTime(), period.start.getTime());
  const to = Math.min(endExclusive ? endExclusive.getTime() : Infinity, period.end.getTime());
  const coveredDays = Math.max(0, Math.round((to - from) / DAY));
  const monthDays = Math.round((period.end - period.start) / DAY);
  return { coveredDays, monthDays, full: coveredDays === monthDays };
}

// Plan d'émission selon le mandat applicable et la relation commerciale.
function issuerPlanFor({ mandate, terms, property }) {
  if (mandate && terms?.offer === C.MANAGEMENT_OFFERS.DELEGATED_MANAGEMENT) {
    if (terms.collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION) {
      return { role: mandate.mandataryType, tenantId: mandate.tenant || null, onBehalfOfOwner: true };
    }
    return null; // OWNER_DIRECT : le bailleur facture lui-même.
  }
  return property.tenant ? { role: 'TENANT', tenantId: property.tenant, onBehalfOfOwner: false } : null;
}


// F-U2.12 — loyer applicable à une période : avenants « loyer » (champ
// montantLoyer, avant/après) ordonnés ; loyer au début de période et
// éventuel changement prenant effet DANS la période. Toute incohérence
// (chaîne rompue, valeurs manquantes, plusieurs changements dans le mois) →
// émission bloquée avec simulation.
function rentTimelineFor(lease, period) {
  const current = Number(lease.montantLoyer);
  const changes = (lease.avenants || []).filter((a) => a.type === 'loyer' && a.dateEffet)
    .map((a) => {
      const field = (a.champsModifies || []).find((c) => c.champ === 'montantLoyer');
      return { effectiveDate: new Date(a.dateEffet), previousRentMinor: Number(field?.avant), newRentMinor: Number(field?.apres), reference: String(a._id || ''), motif: a.motif || null, author: a.creePar || null, recordedAt: a.createdAt || null };
    })
    .sort((x, y) => x.effectiveDate - y.effectiveDate);
  const relevant = changes.filter((c) => c.effectiveDate > period.start);
  if (!relevant.length) return { rentAtStartMinor: current, change: null };
  const invalid = relevant.some((c) => !Number.isSafeInteger(c.previousRentMinor) || !Number.isSafeInteger(c.newRentMinor) || c.previousRentMinor <= 0 || c.newRentMinor <= 0);
  const broken = relevant.some((c, i) => i > 0 && relevant[i - 1].newRentMinor !== c.previousRentMinor) || relevant[relevant.length - 1].newRentMinor !== current;
  const inPeriod = relevant.filter((c) => c.effectiveDate < period.end);
  if (invalid || broken || inPeriod.length > 1) {
    fail('RENT_CHANGE_CALCULATION_AMBIGUOUS', `Historique de loyer incohérent ou plusieurs changements dans le mois : émission bloquée (loyer actuel ${current} FCFA).`, 409);
  }
  return { rentAtStartMinor: relevant[0].previousRentMinor, change: inPeriod[0] || null };
}

async function loadLeaseContext(leaseId) {
  const lease = mongoose.isValidObjectId(leaseId) ? await Contrat.findById(leaseId).lean() : null;
  if (!lease || lease.type !== 'location') fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bail inaccessible.', 404);
  const property = lease.bien ? await Property.findById(lease.bien).select('owner tenant title').lean() : null;
  if (!property) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bail inaccessible.', 404);
  const mandate = await ManagementMandate.findOne({ property: property._id, status: { $in: C.LIVE_MANDATE_STATUSES } }).lean();
  return { lease, property, mandate };
}

async function generateRentInvoice({ actor, leaseId, period: periodLabel, prorataClauseReference = null, now = new Date() }) {
  const { lease, property, mandate } = await loadLeaseContext(leaseId);
  const authority = await authorizeOnProperty(actor, CAP.BILLING_MANAGE, property, mandate);
  return prepareRentDue({ lease, property, mandate, periodLabel, prorataClauseReference, now, actorId: authority.userId, tracking: false });
}

// F-U2.11 — Bailleur personne physique sans organisation ni mandat : échéance
// de SUIVI (brouillon marqué `trackingObligation`, jamais émis : aucune
// identité légale d'émetteur n'est inventée). Réservé au propriétaire du bien.
async function generateOwnerTrackingRentDue({ actor, leaseId, period: periodLabel, prorataClauseReference = null, now = new Date() }) {
  const { lease, property, mandate } = await loadLeaseContext(leaseId);
  const actorId = authz.idOf(actor);
  if (!actorId || String(property.owner) !== String(actorId)) fail('FINANCIAL_RESOURCE_OUT_OF_SCOPE', 'Bail inaccessible.', 404);
  if (property.tenant || mandate) fail('RENT_OWNER_SELF_SERVICE_NOT_APPLICABLE', 'Bien géré par une organisation ou sous mandat : l’échéance relève du gestionnaire.', 403);
  return prepareRentDue({ lease, property, mandate: null, periodLabel, prorataClauseReference, now, actorId, tracking: true });
}

async function prepareRentDue({ lease, property, mandate, periodLabel, prorataClauseReference, now, actorId, tracking }) {
  const period = parsePeriod(periodLabel);
  // F-U2.13 — dates et conventions issues de la politique contractuelle du
  // bail pour cette période (jamais d'une valeur globale) ; sans politique :
  // suivi du loyer mensuel sans échéance, tolérance ni prorata présumés.
  const resolution = await resolvePolicyForPeriod({ lease, propertyId: property._id, periodLabel: period.label });
  const policyTerms = resolution.status === 'RESOLVED' ? resolution.terms : null;
  const cal = calendar.policyCalendar(period.label, policyTerms);
  if (new Date(now) < cal.billingDate) fail('RENT_BILLING_DATE_NOT_REACHED', `Échéance de ${period.label} établie à partir du ${cal.billingDate.toISOString().slice(0, 10)} selon la politique du bail.`, 409);
  const policySnapshot = { status: resolution.status, reason: resolution.reason, id: resolution.policy?._id || null, type: resolution.policy?.type || null, version: resolution.policy?.version || null, expectedType: resolution.expectedType, managementMode: resolution.managementMode };
  if (lease.statut === 'en_attente') fail('LEASE_NOT_ACTIVE_FOR_PERIOD', 'Le bail n’est pas encore actif.', 409);

  const rentMinor = Number(lease.montantLoyer);
  if (!Number.isSafeInteger(rentMinor) || rentMinor <= 0) fail('LEASE_RENT_UNDETERMINED', 'Montant du loyer du bail invalide.', 409);
  const exit = await RentLeaseExit.findOne({ lease: lease._id }).lean();
  const leaseEnd = lease.dateSortie || lease.dateFinBail || null;
  const obligationEnd = exit ? exit.obligationEndDate : leaseEnd;
  const coverage = leaseCoverage({ ...lease, dateSortie: obligationEnd, dateFinBail: obligationEnd }, period);
  if (coverage.coveredDays === 0) fail('LEASE_NOT_ACTIVE_FOR_PERIOD', 'Le bail ne couvre pas cette période.', 409);
  // F-U2.12 — sortie : sans décision de sortie, le départ ne réduit pas la dette.
  const endsInPeriod = obligationEnd && new Date(obligationEnd) < period.end && !calendar.exitCoversConventionalMonth(period.label, obligationEnd);
  let exitSnapshot = null; let planEnd = null;
  if (endsInPeriod) {
    if (!exit) fail('RENT_EXIT_DECISION_REQUIRED', 'Fin de bail en cours de mois : enregistrer la décision de sortie (date de fin d’obligation et fondement du prorata, ou mois dû en entier).', 409);
    planEnd = exit.prorataBasis === 'NONE' ? null : exit.obligationEndDate;
    exitSnapshot = { exitId: exit._id, prorataBasis: exit.prorataBasis, basisReference: exit.basisReference, obligationEndDate: exit.obligationEndDate, physicalDepartureDate: exit.physicalDepartureDate, keysReturnedDate: exit.keysReturnedDate, contractualEndDate: exit.contractualEndDate, agreementEffectiveDate: exit.agreementEffectiveDate };
  }
  const timeline = rentTimelineFor(lease, period);
  const plan = calendar.conventionalRentPlan({ period: period.label, rentAtStartMinor: timeline.rentAtStartMinor, rentChange: timeline.change, entryDate: lease.dateEntree, obligationEndDate: planEnd });
  const prorataAgreed = policyTerms?.prorata?.method === 'CONVENTIONAL_30';
  if ((!plan.billable || !plan.full) && !prorataAgreed) {
    fail('RENT_PRORATA_POLICY_MISSING', `Mois partiel : aucune convention de prorata dans la politique du bail (${resolution.status === 'RESOLVED' ? 'non stipulée' : resolution.reason}).`, 409);
  }
  if (!plan.billable) fail('RENT_PERIOD_NOT_BILLABLE_ENTRY_ON_31', `Entrée le 31 : aucun supplément pour ce jour ; premier loyer complet sur ${plan.firstFullPeriod}.`, 409);
  const entryProrata = plan.startDay > 1;
  if (entryProrata && !String(prorataClauseReference || '').trim()) fail('RENT_PRORATION_CLAUSE_REQUIRED', 'Premier loyer au prorata : citer la clause du bail prévoyant le prorata.', 422);
  const ratio = plan.full ? null : {
    rule: entryProrata ? (plan.february ? 'FEBRUARY_CONVENTIONAL' : 'THIRTY_DAY_BASE') : (exitSnapshot ? 'EXIT_WITH_BASIS' : 'RENT_CHANGE_SEGMENTS'),
    ruleStatus: 'VALIDATED', ruleVersion: plan.policyVersion, baseDays: plan.baseDays, days: plan.conventionalDays, coveredDays: plan.conventionalDays,
    startDay: plan.startDay, endDay: plan.endDay, segments: plan.segments, amountMinor: plan.totalMinor, monthlyRentMinor: timeline.rentAtStartMinor,
    entryDate: entryProrata ? lease.dateEntree : null, coveredFrom: entryProrata ? lease.dateEntree : period.start, coveredTo: cal.billingDate,
    clause: entryProrata ? String(prorataClauseReference).trim() : null, exit: exitSnapshot, rentChange: timeline.change,
  };
  // F-U2.12 — charges selon leur nature : périodiques (forfait, provision)
  // au prorata des jours conventionnels ; au réel, individualisées,
  // exceptionnelles : hors facture mensuelle automatique ; nature inconnue sur
  // un mois partiel : bloqué. Jamais dans l'assiette de la pénalité, du 1 % ni des 10 %.
  const charges = Number(lease.montantCharges || 0);
  const nature = lease.natureCharges || null;
  let chargesLine = null; let chargesTreatment = 'NONE';
  if (!lease.chargesIncluses && Number.isSafeInteger(charges) && charges > 0) {
    if (RENT_PRORATA_POLICY.excludedChargeNatures.includes(nature)) chargesTreatment = 'EXCLUDED_NOT_MONTHLY';
    else if (plan.conventionalDays === 30) { chargesTreatment = 'FULL'; chargesLine = charges; }
    else if (RENT_PRORATA_POLICY.proratableChargeNatures.includes(nature)) { chargesTreatment = 'PRORATED'; chargesLine = prorateMinor(charges, plan.conventionalDays, plan.baseDays); }
    else fail('RENT_CHARGES_PRORATA_RULE_UNDECIDED', 'Mois partiel : nature des charges non renseignée (forfait, provision, réel…) — prorata impossible.', 409);
  }

  const schedule = await Paiement.findOne({ contrat: lease._id, mois: period.month, annee: period.year }).select('jourEcheance montant').lean();
  const dueDate = cal.dueDate; // null sans échéance stipulée

  let mandateSnapshot = null; let terms = null;
  if (mandate) {
    const version = await ManagementMandateVersion.findOne({ mandate: mandate._id, effectiveFrom: { $lte: period.start } }).sort({ versionNumber: -1 }).lean()
      || await ManagementMandateVersion.findById(mandate.currentVersion).lean();
    terms = version?.terms || null;
    mandateSnapshot = { id: mandate._id, versionId: version?._id || null, termsHash: version?.termsHash || null, offer: terms?.offer || null, collectionMode: terms?.collectionMode || null };
  }
  const issuerPlan = issuerPlanFor({ mandate, terms, property });
  const tenant = lease.locataire ? await Locataire.findById(lease.locataire).select('nom prenom email telephone').lean() : null;
  const owner = await User.findById(property.owner).select('name').lean();

  const lines = plan.segments.map((segment) => ({
    lineType: 'rent', quantity: 1, unitAmountMinor: segment.amountMinor, sourceType: 'Contrat', sourceId: lease._id,
    description: `Loyer ${period.label}${plan.full ? '' : ` (${segment.days}/30 j conventionnels à ${segment.rentMinor} FCFA${segment.source === 'AMENDMENT' ? ', avenant' : ''})`}`,
    metadata: { fromDay: segment.fromDay, toDay: segment.toDay, days: segment.days, monthlyRentMinor: segment.rentMinor, source: segment.source },
  }));
  if (chargesLine) {
    lines.push({ lineType: 'charges', description: `Charges locatives ${period.label}${chargesTreatment === 'PRORATED' ? ` (${plan.conventionalDays}/30)` : ''}`, quantity: 1, unitAmountMinor: chargesLine, sourceType: 'Contrat', sourceId: lease._id, metadata: { nature, treatment: chargesTreatment } });
  }
  const businessOperationKey = `rent:${lease._id}:${period.label}`;
  const lockKey = `rent:${property._id}:${period.label}`;
  await counters.ensureCounters([{ key: lockKey, scopeType: 'BILLING_LOCK' }]);

  return runFinancialOperation({ operationName: 'billing.rent.generate', transactionMode: 'transactional' }, async ({ session }) => {
    await counters.lock({ key: lockKey, session });
    const other = await FinancialDocument.findOne({
      domain: 'rental', establishmentId: property._id, 'metadata.billingKind': BILLING_KINDS.RENT, 'metadata.period': period.label,
      status: { $ne: 'cancelled' }, businessOperationKey: { $ne: businessOperationKey },
    }).session(session).lean();
    if (other) fail('RENT_PERIOD_ALREADY_BILLED', 'Ce mois est déjà facturé pour ce bien (autre bail) : annuler ou corriger d’abord.', 409);
    return createBillingDraft({
      session, actorId, lines,
      draft: {
        tenant: property.tenant || null, domain: 'rental', establishmentType: 'Property', establishmentId: property._id, currency: 'XAF',
        subjectType: 'Contrat', subjectId: lease._id, businessOperationKey, dueDate, servicePeriodStart: period.start, servicePeriodEnd: period.end,
        customer: tenant ? { name: [tenant.prenom, tenant.nom].filter(Boolean).join(' '), email: tenant.email, phone: tenant.telephone } : { name: 'Locataire' },
        metadata: {
          billingKind: BILLING_KINDS.RENT, period: period.label, issuerPlan, mandate: mandateSnapshot, proration: ratio, scope: resourceScope(property, mandate),
          policy: policySnapshot,
          calendar: { policyVersion: cal.policyVersion, timeZone: cal.timeZone, billingDate: cal.billingDate, exigibleAt: cal.exigibleAt, occupancyEnd: cal.end, conventionalDays: cal.conventionalDays, dueDate: cal.dueDate, lateFrom: cal.lateFrom, formalNoticeDate: cal.formalNoticeDate, decisions: cal.decisions },
          rentPrincipalMinor: plan.totalMinor,
          charges: { nature, treatment: chargesTreatment, monthlyMinor: charges || 0 },
          ...(tracking ? { trackingObligation: true, legalInvoice: false, ownerSelfManaged: true, ownerScope: property.owner } : {}),
          legacySchedule: schedule ? { paiementAmount: schedule.montant ?? null, jourEcheance: schedule.jourEcheance ?? null, amountMismatch: schedule.montant != null && schedule.montant !== rentMinor } : null,
          parties: {
            serviceProvider: { role: 'OWNER', userId: property.owner, name: owner?.name || null },
            issuer: issuerPlan ? { role: issuerPlan.role, tenant: issuerPlan.tenantId || null, onBehalfOfOwner: issuerPlan.onBehalfOfOwner } : { role: 'OWNER', supported: false },
            collectionAgent: mandateSnapshot?.collectionMode === C.COLLECTION_MODES.AGENCY_COLLECTION ? { role: mandate.mandataryType, tenant: mandate.tenant || null } : { role: 'OWNER' },
            economicBeneficiary: { role: 'OWNER', userId: property.owner },
            payer: { role: 'LOCATAIRE', locataire: lease.locataire || null },
          },
        },
      },
    });
  });
}

// F-U2.12 — Décision de sortie (une par bail, jamais réécrite). Autorité :
// gestionnaire habilité du périmètre, ou bailleur sans organisation ni mandat.
// Les factures déjà émises ne sont jamais modifiées : l'écart éventuel est
// listé comme ajustement à décider (avoir contrôlé), sans remboursement.
async function recordLeaseExit({ actor, leaseId, obligationEndDate, prorataBasis, basisReference = null, physicalDepartureDate = null, keysReturnedDate = null, contractualEndDate = null, agreementEffectiveDate = null, now = new Date() }) {
  const { lease, property, mandate } = await loadLeaseContext(leaseId);
  const actorId = authz.idOf(actor);
  let plane;
  if (!property.tenant && !mandate && actorId && String(property.owner) === String(actorId)) plane = 'OWNER_SELF';
  else plane = (await authorizeOnProperty(actor, CAP.BILLING_MANAGE, property, mandate)).plane;
  if (!RentLeaseExit.PRORATA_BASES.includes(prorataBasis)) fail('RENT_EXIT_BASIS_INVALID', 'Fondement attendu : LEASE_CLAUSE, EXIT_AGREEMENT, LEGAL_PROVISION ou NONE.', 422);
  if (prorataBasis !== 'NONE' && !String(basisReference || '').trim()) fail('RENT_EXIT_BASIS_REFERENCE_REQUIRED', 'Référence de la clause, de l’accord ou du texte requise.', 422);
  if (prorataBasis === 'EXIT_AGREEMENT' && !agreementEffectiveDate) fail('RENT_EXIT_AGREEMENT_DATE_REQUIRED', 'Date de prise d’effet de l’accord de sortie requise.', 422);
  const end = new Date(obligationEndDate);
  if (Number.isNaN(end.getTime()) || (lease.dateEntree && end < new Date(lease.dateEntree))) fail('RENT_EXIT_DATE_INVALID', 'Date de fin d’obligation invalide.', 422);
  const date = (value) => (value ? new Date(value) : null);
  const draft = { lease: lease._id, property: property._id, owner: property.owner, tenant: property.tenant || null, obligationEndDate: end, prorataBasis, basisReference: basisReference ? String(basisReference).trim() : null, physicalDepartureDate: date(physicalDepartureDate), keysReturnedDate: date(keysReturnedDate), contractualEndDate: date(contractualEndDate), agreementEffectiveDate: date(agreementEffectiveDate), recordedBy: actorId, authorityPlane: plane };
  // Écarts avec les échéances déjà établies (émises ou de suivi).
  const documents = await FinancialDocument.find({ domain: 'rental', subjectType: 'Contrat', subjectId: lease._id, 'metadata.billingKind': BILLING_KINDS.RENT, status: { $in: ['issued', 'draft'] } }).lean();
  const adjustments = [];
  for (const document of documents) {
    const label = document.metadata?.period;
    if (!label) continue;
    const cal = calendar.rentCalendar(label);
    const billed = document.metadata?.rentPrincipalMinor ?? null;
    let recomputed = 0;
    if (end >= cal.start) {
      if (calendar.exitCoversConventionalMonth(label, end) || end >= cal.end || prorataBasis === 'NONE') continue;
      const timeline = rentTimelineFor(lease, parsePeriod(label));
      recomputed = calendar.conventionalRentPlan({ period: label, rentAtStartMinor: timeline.rentAtStartMinor, rentChange: timeline.change, entryDate: lease.dateEntree, obligationEndDate: end }).totalMinor;
    }
    if (billed != null && recomputed !== billed) adjustments.push({ document: document._id, period: label, billedRentMinor: billed, recomputedRentMinor: recomputed, deltaMinor: recomputed - billed, status: 'PENDING_DECISION' });
  }
  try {
    const [exit] = await RentLeaseExit.create([{ ...draft, adjustments, history: [{ action: 'recorded', actor: actorId, at: new Date(now), reason: prorataBasis }] }]);
    return exit.toObject();
  } catch (error) {
    if (error?.code === 11000) fail('RENT_EXIT_ALREADY_RECORDED', 'Une décision de sortie existe déjà pour ce bail : aucune réécriture silencieuse.', 409);
    throw error;
  }
}

module.exports = { recordLeaseExit, rentTimelineFor, generateRentInvoice, generateOwnerTrackingRentDue, parsePeriod, prorateMinor, issuerPlanFor, authorizeOnProperty };
