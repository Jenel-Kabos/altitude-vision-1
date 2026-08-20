// PAY-4 — adaptateur `mtn_direct` conforme au contrat du provider registry
// (server/services/finance/paymentProviderRegistry.js, posé en PAY-3).
// Aucune décision financière ici (allocation, ledger, confirmation
// définitive) — voir services/finance/mtnHotelPaymentBridge.js pour
// l'orchestration, qui appelle exclusivement les services canoniques du
// Financial Core (mandat §30 : « le provider doit appeler le mécanisme
// canonique existant »).
const mtnClient = require('./mtnMoMoClient');
const { fail } = require('../../../finance/financialError');

// PAY-4 — source canonique du vocabulaire de statut MTN MoMo Collections
// (voir server/docs/PAY4_MTN_MOMO_REPORT.md §7). Le registre
// (paymentProviderRegistry.js) importe cette constante plutôt que de la
// redéfinir, pour n'avoir qu'une seule source de vérité et éviter toute
// dépendance circulaire entre ce fichier et le registre.
const MTN_STATUS_MAP = Object.freeze({ PENDING: 'pending', SUCCESSFUL: 'succeeded', FAILED: 'failed' });

// PAY-4 §15 — validation/normalisation MSISDN serveur uniquement. Le seul
// marché confirmé (momo.mtn.com/api/, voir PAY4_MTN_MOMO_REPORT.md §6) est
// Congo-Brazzaville (indicatif 242). Aucune détection d'opérateur par
// préfixe (mandat : « ne devine pas les préfixes opérateur ») — le client a
// déjà choisi explicitement "MTN Mobile Money" en amont ; cette fonction
// vérifie seulement une forme plausible de numéro congolais, jamais qu'il
// appartient réellement au réseau MTN (MTN elle-même rejettera sinon).
function normalizeMsisdn(rawInput) {
  const digitsOnly = String(rawInput || '').replace(/[^\d]/g, '');
  // Les 9 derniers chiffres constituent le numéro significatif national
  // (indépendamment d'un préfixe international +242/00242 ou d'un simple
  // format local à 9 chiffres) — tolère les variantes d'écriture sans
  // deviner d'opérateur (mandat §15).
  if (digitsOnly.length < 9) fail('MTN_MOMO_INVALID_MSISDN', 'Numéro MTN Mobile Money invalide.', 422);
  const canonical = `242${digitsOnly.slice(-9)}`;
  if (!/^242\d{9}$/.test(canonical)) {
    fail('MTN_MOMO_INVALID_MSISDN', 'Numéro MTN Mobile Money invalide.', 422);
  }
  return canonical;
}

// PAY-4 §14/§17/§28 — la référence provider (X-Reference-Id) est toujours
// générée côté serveur, jamais transmise par un appelant externe au Financial
// Core. `referenceId` peut être fournie par l'orchestrateur
// (mtnHotelPaymentBridge) lorsqu'elle a déjà été persistée sur le
// FinancialPayment AVANT cet appel réseau — ce qui permet, en cas de timeout
// réseau ici, de savoir quelle référence interroger ensuite (status inquiry)
// plutôt que de risquer une seconde RequestToPay et un double débit.
async function initiatePayment({ referenceId: providedReferenceId, amountMinor, msisdn, externalId, payerMessage, payeeNote }) {
  const referenceId = providedReferenceId || mtnClient.generateReferenceId();
  const normalizedMsisdn = normalizeMsisdn(msisdn);
  const result = await mtnClient.requestToPay({
    referenceId, amountMinor, msisdn: normalizedMsisdn, externalId, payerMessage, payeeNote,
  });
  // PAY-4 §19 — un 202 MTN ne devient jamais un paiement confirmé ici.
  return { providerPaymentId: result.referenceId, providerStatus: result.providerStatus, normalizedStatus: normalizeStatus(result.providerStatus) };
}

async function getStatus({ providerPaymentId }) {
  const result = await mtnClient.getTransactionStatus({ referenceId: providerPaymentId });
  return { ...result, normalizedStatus: normalizeStatus(result.status) };
}

function normalizeStatus(rawStatus) {
  const normalized = MTN_STATUS_MAP[rawStatus];
  if (!normalized) fail('FINANCIAL_PROVIDER_STATUS_UNKNOWN', `Statut MTN MoMo "${rawStatus}" non reconnu.`, 422);
  return normalized;
}

// PAY-4 §21/§22 — un callback MTN n'est JAMAIS une preuve suffisante à lui
// seul (pas de signature exploitable documentée pour Collections — voir
// PAY4_MTN_MOMO_REPORT.md §21-22). Cette fonction n'extrait que la
// référence permettant de savoir QUEL paiement corroborer ; elle ne renvoie
// jamais `trusted: true`. C'est l'orchestrateur (mtnHotelPaymentBridge) qui
// doit systématiquement rappeler `getStatus()` auprès de MTN avant toute
// confirmation — jamais `body.status` du callback directement.
function extractCallbackReference(req) {
  const referenceId = req?.headers?.['x-reference-id'] || req?.params?.referenceId || req?.body?.externalId;
  if (!referenceId) fail('MTN_MOMO_CALLBACK_INVALID', 'Callback MTN MoMo sans référence exploitable.', 400);
  return { referenceId: String(referenceId), trusted: false };
}

module.exports = { initiatePayment, getStatus, normalizeStatus, normalizeMsisdn, extractCallbackReference, MTN_STATUS_MAP };
