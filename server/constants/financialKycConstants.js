// F-U1.I — KYC financier à deux niveaux.
//
// Règle définitive : les organisations PRÉPARENT les dossiers ; Altitude
// Vision seule DÉLIVRE l'attestation finale. Toute valeur de procédure non
// validée par la direction / le conseil juridique reste à l'état
// « non validé » et bloque la fonction concernée, sans valeur inventée.

const KYC_CASE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_DOCUMENTS: 'pending_documents',
  READY_FOR_SUBMISSION: 'ready_for_submission',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  ADDITIONAL_INFORMATION_REQUIRED: 'additional_information_required',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});
const S = KYC_CASE_STATUSES;
// États dans lesquels le demandeur / l'organisation peuvent compléter le dossier.
const KYC_EDITABLE_STATUSES = Object.freeze([S.DRAFT, S.PENDING_DOCUMENTS, S.READY_FOR_SUBMISSION, S.ADDITIONAL_INFORMATION_REQUIRED]);
const KYC_OPEN_STATUSES = Object.freeze([...KYC_EDITABLE_STATUSES, S.SUBMITTED, S.UNDER_REVIEW]);

const KYC_APPLICANT_TYPES = Object.freeze({ TENANT_MEMBER: 'TENANT_MEMBER', INDIVIDUAL: 'INDIVIDUAL' });
const KYC_PURPOSES = Object.freeze({
  SENSITIVE_FINANCIAL_GRANT: 'SENSITIVE_FINANCIAL_GRANT',
  OWNER_FINANCIAL_OPERATIONS: 'OWNER_FINANCIAL_OPERATIONS',
});

// Procédure applicable. `validated: false` tant que la liste des pièces, les
// contrôles et la base légale n'ont pas été validés : l'attestation finale
// exige que KYC_PROCEDURE_VALIDATED_VERSION désigne explicitement cette version.
const KYC_PROCEDURE = Object.freeze({
  version: 'KYC-FIN-2026-10-DRAFT',
  acceptedDocuments: Object.freeze({
    NATIONAL_ID: Object.freeze({ slots: Object.freeze(['ID_FRONT', 'ID_BACK']) }),
    PASSPORT: Object.freeze({ slots: Object.freeze(['PASSPORT_DATA_PAGE']) }),
  }),
});

// Information de la personne concernée (version affichée et acceptée à la
// soumission). Texte à faire valider juridiquement (droit congolais).
const KYC_PRIVACY_NOTICE = Object.freeze({
  version: 'KYC-NOTICE-2026-10-DRAFT',
  purpose: 'Vérifier votre identité avant toute habilitation à des opérations financières sensibles sur Altimmo.',
  recipients: 'Agents Altitude Vision habilités à la vérification d’identité ; l’organisation qui prépare votre dossier, pour les seules informations de suivi.',
  retention: 'Durée de conservation en cours de validation juridique ; aucune suppression automatique n’est activée.',
});

// Conservation : aucune durée légale n'est supposée. La politique n'est
// ACTIVE que si une durée ET la référence de la décision juridique qui la
// fixe sont fournies (KYC_RETENTION_DURATION_DAYS, KYC_RETENTION_DECISION_REFERENCE).
// Départ du délai : clôture du dossier (annulé, refusé, révoqué, expiré).
const KYC_RETENTION_POLICY = Object.freeze({ status: 'UNCONFIGURED', startEvent: 'CASE_CLOSED' });
const KYC_CLOSED_STATUSES = Object.freeze(['cancelled', 'rejected', 'revoked', 'expired']);
function kycRetentionPolicy(env = process.env) {
  const days = Number.parseInt(env.KYC_RETENTION_DURATION_DAYS, 10);
  const reference = String(env.KYC_RETENTION_DECISION_REFERENCE || '').trim();
  if (!Number.isSafeInteger(days) || days <= 0 || !reference) return KYC_RETENTION_POLICY;
  return Object.freeze({ status: 'ACTIVE', startEvent: 'CASE_CLOSED', durationDays: days, decisionReference: reference });
}

const KYC_DOCUMENT_ALLOWED_MIME_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png']);
const KYC_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

module.exports = {
  KYC_CASE_STATUSES, KYC_EDITABLE_STATUSES, KYC_OPEN_STATUSES, KYC_APPLICANT_TYPES, KYC_PURPOSES,
  KYC_PROCEDURE, KYC_PRIVACY_NOTICE, KYC_RETENTION_POLICY, KYC_CLOSED_STATUSES, kycRetentionPolicy, KYC_DOCUMENT_ALLOWED_MIME_TYPES, KYC_DOCUMENT_MAX_BYTES,
};
