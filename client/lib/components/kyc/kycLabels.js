export const KYC_STATUS_LABELS = {
  draft: 'Brouillon',
  pending_documents: 'Justificatifs attendus',
  ready_for_submission: 'Prêt à soumettre',
  submitted: 'Soumis à Altitude Vision',
  under_review: 'En cours d’examen',
  additional_information_required: 'Compléments demandés',
  approved: 'Identité attestée',
  rejected: 'Refusé',
  cancelled: 'Annulé',
  expired: 'Expiré',
  suspended: 'Attestation suspendue',
  revoked: 'Attestation révoquée',
};
export const KYC_STATUS_TONES = {
  approved: 'success', rejected: 'danger', revoked: 'danger', suspended: 'warning', expired: 'warning',
  additional_information_required: 'warning', submitted: 'info', under_review: 'info',
};
export const KYC_SLOT_LABELS = { ID_FRONT: 'Carte d’identité — recto', ID_BACK: 'Carte d’identité — verso', PASSPORT_DATA_PAGE: 'Passeport — page d’identité' };
export const KYC_DOCUMENT_KIND_LABELS = { NATIONAL_ID: 'Carte nationale d’identité', PASSPORT: 'Passeport' };
export const KYC_PURPOSE_LABELS = { SENSITIVE_FINANCIAL_GRANT: 'Habilitation financière sensible', OWNER_FINANCIAL_OPERATIONS: 'Opérations financières propriétaire' };
export const KYC_STEPS = ['draft', 'pending_documents', 'ready_for_submission', 'submitted', 'under_review', 'approved'];
export const KYC_EDITABLE = ['draft', 'pending_documents', 'ready_for_submission', 'additional_information_required'];
