import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BillingOwnerPage from '../pages/BillingOwnerPage';
import BillingAdministrationPage from '../pages/dashboard/BillingAdministrationPage';
import * as billing from '../services/billingService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/billingService', () => ({
  getOwnerBilling: vi.fn(), getAdministrationBilling: vi.fn(), getIssuerReadiness: vi.fn(), getBillingDocument: vi.fn(),
  generateRentInvoice: vi.fn(), generateCommissionInvoice: vi.fn(), issueBillingDocument: vi.fn(), cancelBillingDraft: vi.fn(), creditBillingDocument: vi.fn(),
  getCollectionOverview: vi.fn(), getOwnerCollection: vi.fn(), decideDifficultyReport: vi.fn(), generateOwnerTrackingDue: vi.fn(), recordOwnerRentReceipt: vi.fn(),
  createLeasePolicy: vi.fn(), getLeasePolicies: vi.fn(),
  submitDirectReceiptEvidence: vi.fn(), cancelDirectReceipt: vi.fn(), getDirectReceiptReviewQueue: vi.fn(), reviewDirectReceipt: vi.fn(),
  getAutonomousSummary: vi.fn(), getAutonomousPricing: vi.fn(), generateAutonomousInvoice: vi.fn(), acceptPortfolioQuote: vi.fn(), rejectPortfolioQuote: vi.fn(),
}));

const summary = { rentExpectedMinor: 160000, rentPaidAllocatedMinor: 100000, unpaidMinor: 60000, overdueMinor: 60000, overdueCount: 1, commissionsInvoicedMinor: 15000, subscriptionsInvoicedMinor: 0, documentCount: 2 };
const doc = (overrides) => ({ id: 'D1', billingKind: 'RENT', period: '2026-02', documentNumber: null, status: 'draft', lifecycle: 'draft', documentType: 'invoice', customer: { name: 'Locataire fictif' }, dueDate: '2026-02-05', totalMinor: 160000, balanceMinor: 160000, ...overrides });

beforeEach(() => { vi.clearAllMocks(); billing.getAutonomousSummary.mockResolvedValue({ subscribed: false }); billing.getOwnerCollection.mockRejectedValue(new Error('n/a')); billing.getCollectionOverview.mockRejectedValue(new Error('n/a')); billing.getDirectReceiptReviewQueue.mockResolvedValue([]); });
afterEach(() => vi.restoreAllMocks());

test('propriétaire : synthèse dont loyers confirmés et commissions acquises, lecture seule', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary: { ...summary, rentCollectedConfirmedMinor: 150000, commissionsAcquiredMinor: 15000 }, documents: [doc({ status: 'issued', lifecycle: 'overdue', documentNumber: 'FAC-X-2026-000001' })] });
  render(<BillingOwnerPage />);
  expect(await screen.findByText('Loyers encaissés et confirmés')).toBeInTheDocument();
  expect(screen.getByText('En retard', { selector: 'span' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Émettre|Avoir|Annuler/ })).not.toBeInTheDocument();
});

test('administration : sans émetteur vérifié, aucune action d’émission ; préparation d’un loyer', async () => {
  billing.getAdministrationBilling.mockResolvedValue({ plane: 'TENANT', summary, documents: [doc()] });
  billing.getIssuerReadiness.mockResolvedValue({ ready: false, reason: 'ISSUER_IDENTITY_NOT_VERIFIED' });
  billing.generateRentInvoice.mockResolvedValue({});
  render(<BillingAdministrationPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('seuls des brouillons');
  expect(screen.queryByRole('button', { name: 'Émettre' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Identifiant du bail'), { target: { value: 'L1' } });
  fireEvent.change(screen.getByLabelText('Période'), { target: { value: '2026-03' } });
  fireEvent.click(screen.getByRole('button', { name: 'Préparer le loyer' }));
  await waitFor(() => expect(billing.generateRentInvoice).toHaveBeenCalledWith({ leaseId: 'L1', period: '2026-03' }));
});

test('administration : émission et avoir proposés selon le statut, refus serveur affiché', async () => {
  billing.getAdministrationBilling.mockResolvedValue({ plane: 'PLATFORM', summary, documents: [doc(), doc({ id: 'D2', status: 'issued', lifecycle: 'issued', documentNumber: 'FAC-X-2026-000002' })] });
  billing.getIssuerReadiness.mockResolvedValue({ ready: true });
  billing.issueBillingDocument.mockResolvedValue({});
  vi.spyOn(window, 'prompt').mockReturnValueOnce('10000').mockReturnValueOnce('Erreur de charges');
  billing.creditBillingDocument.mockRejectedValue({ response: { data: { message: 'Habilitation requise' } } });
  render(<BillingAdministrationPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Émettre' }));
  await waitFor(() => expect(billing.issueBillingDocument).toHaveBeenCalledWith('D1'));
  fireEvent.click(await screen.findByRole('button', { name: 'Avoir' }));
  await waitFor(() => expect(billing.creditBillingDocument).toHaveBeenCalledWith('D2', 10000, 'Erreur de charges'));
});

test('administration : accès refusé sans capacité', async () => {
  billing.getAdministrationBilling.mockRejectedValue({ response: { status: 403 } });
  billing.getIssuerReadiness.mockResolvedValue(null);
  render(<BillingAdministrationPage />);
  expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
});

const autonomousSummary = (overrides = {}) => ({
  subscribed: true, holderType: 'USER',
  classification: { formula: 'STANDARD', label: 'Standard', counted: 3, ambiguous: false, reasons: [], countingPolicyStatus: 'PROPOSED' },
  current: { fixedMonthlyMinor: 5000, confirmedRentBaseMinor: 600000, variableFeesMinor: 6000, totalDueEstimateMinor: 11000, quote: null },
  accruals: [{ kind: 'FEE', period: '2026-09', status: 'accrued', baseMinor: 600000, feeMinor: 6000 }], invoices: [{ id: 'I1', period: '2026-08', documentNumber: 'FAC-AV-2026-000001', totalMinor: 9000 }],
  ...overrides,
});

test('F-U2.9 propriétaire : coût fixe, loyers confirmés retenus, frais 1 %, total et factures passées', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary: { ...summary, rentCollectedConfirmedMinor: 0, commissionsAcquiredMinor: 0 }, documents: [] });
  billing.getAutonomousSummary.mockResolvedValue(autonomousSummary());
  render(<BillingOwnerPage />);
  expect(await screen.findByText('Frais de service 1 %')).toBeInTheDocument();
  expect(screen.getByText('Loyers encaissés et confirmés retenus')).toBeInTheDocument();
  expect(screen.getByText('Standard')).toBeInTheDocument();
  expect(screen.getByText(/11\s000/)).toBeInTheDocument();
  expect(screen.getByText(/FAC-AV-2026-000001/)).toBeInTheDocument();
  expect(screen.queryByText(/7 ?%/)).not.toBeInTheDocument();
});

test('F-U2.9 GRATUIT : mention transparente des frais de 1 %', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary, documents: [] });
  billing.getAutonomousSummary.mockResolvedValue(autonomousSummary({ classification: { formula: 'GRATUIT', label: 'Gratuit', counted: 1, ambiguous: false, reasons: [] }, current: { fixedMonthlyMinor: 0, confirmedRentBaseMinor: 100000, variableFeesMinor: 1000, totalDueEstimateMinor: 1000, quote: null } }));
  render(<BillingOwnerPage />);
  expect(await screen.findByText('Abonnement gratuit pour un bien. Frais de service de 1 % sur les loyers effectivement encaissés et confirmés.')).toBeInTheDocument();
});

test('F-U2.9 Grand portefeuille : devis accepté par le titulaire ; ambiguïté signalée', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary, documents: [] });
  billing.getAutonomousSummary.mockResolvedValue(autonomousSummary({
    classification: { formula: 'GRAND_PORTEFEUILLE', label: 'Grand portefeuille', counted: 21, ambiguous: true, reasons: ['COUNTING_RULE_UNDECIDED'] },
    current: { fixedMonthlyMinor: null, onQuote: true, confirmedRentBaseMinor: 0, variableFeesMinor: 0, totalDueEstimateMinor: null, quote: { id: 'Q1', status: 'proposed', monthlyPriceMinor: 15000 } },
  }));
  billing.acceptPortfolioQuote.mockResolvedValue({});
  render(<BillingOwnerPage />);
  expect(await screen.findByText('Sur devis')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('règle de comptage en attente de décision');
  fireEvent.click(screen.getByRole('button', { name: 'Accepter le devis' }));
  await waitFor(() => expect(billing.acceptPortfolioQuote).toHaveBeenCalledWith('Q1'));
});

test('F-U2.9 plateforme : préparation de la facture autonome', async () => {
  billing.getAdministrationBilling.mockResolvedValue({ plane: 'PLATFORM', summary, documents: [] });
  billing.getIssuerReadiness.mockResolvedValue({ ready: true });
  billing.generateAutonomousInvoice.mockResolvedValue({});
  render(<BillingAdministrationPage />);
  fireEvent.change(await screen.findByLabelText('Identifiant de l’abonnement'), { target: { value: 'S1' } });
  fireEvent.change(screen.getByLabelText('Mois facturé'), { target: { value: '2026-09' } });
  fireEvent.click(screen.getByRole('button', { name: 'Préparer la facture autonome' }));
  await waitFor(() => expect(billing.generateAutonomousInvoice).toHaveBeenCalledWith({ subscriptionType: 'IndividualSubscription', subscriptionId: 'S1', period: '2026-09' }));
});

const collectionData = {
  summary: { overdueCount: 1, overdueMinor: 150000, partialCount: 1, penaltiesEstimatedMinor: 4500, reports: 1, cases: 1, reportsToReview: 1, noticeDrafts: 1, suspended: 0 },
  reports: [{ id: 'R1', period: '2026-04', status: 'submitted', declaredAt: '2026-05-26T09:00:00Z', admissibleForSuspension: false, reason: 'Retard de salaire' }],
  cases: [{ id: 'C1', reference: 'REC-2026-04-ABC', period: '2026-04', status: 'notice_draft_prepared', evaluation: { unpaidRentMinor: 150000 } }],
  penalties: [],
};

test('F-U2.10 propriétaire : retards, pénalités prévisionnelles, signalements et dossiers en lecture seule', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary, documents: [] });
  billing.getOwnerCollection.mockResolvedValue(collectionData);
  render(<BillingOwnerPage />);
  expect(await screen.findByText('Recouvrement des loyers')).toBeInTheDocument();
  expect(screen.getByText('Pénalités prévisionnelles')).toBeInTheDocument();
  expect(screen.getByText('Projet de mise en demeure (non envoyé)')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Accorder|Clôturer|Prendre en compte/ })).not.toBeInTheDocument();
});

test('F-U2.10 gestionnaire : exception motivée sur un signalement tardif', async () => {
  billing.getAdministrationBilling.mockResolvedValue({ plane: 'TENANT', summary, documents: [] });
  billing.getIssuerReadiness.mockResolvedValue({ ready: true });
  billing.getCollectionOverview.mockResolvedValue(collectionData);
  billing.decideDifficultyReport.mockResolvedValue({});
  vi.spyOn(window, 'prompt').mockReturnValueOnce('Hospitalisation');
  render(<BillingAdministrationPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Accorder une exception' }));
  await waitFor(() => expect(billing.decideDifficultyReport).toHaveBeenCalledWith('R1', { decision: 'grant_exception', reason: 'Hospitalisation' }));
});

test('F-U2.11 bailleur sans organisation : échéance de suivi et loyer reçu', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary, documents: [] });
  billing.getOwnerCollection.mockResolvedValue({ ...collectionData, trackingDues: [{ id: 'T1', period: '2026-04', totalMinor: 150000, balanceMinor: 150000 }] });
  billing.generateOwnerTrackingDue.mockResolvedValue({});
  billing.recordOwnerRentReceipt.mockResolvedValue({});
  vi.spyOn(window, 'prompt').mockReturnValueOnce('100000').mockReturnValueOnce('2026-05-04');
  render(<BillingOwnerPage />);
  expect(await screen.findByText(/ce n’est pas une facture légale/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Bail à suivre'), { target: { value: 'L9' } });
  fireEvent.change(screen.getByLabelText('Mois à suivre'), { target: { value: '2026-05' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’échéance' }));
  await waitFor(() => expect(billing.generateOwnerTrackingDue).toHaveBeenCalledWith({ leaseId: 'L9', period: '2026-05' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un loyer reçu' }));
  await waitFor(() => expect(billing.recordOwnerRentReceipt).toHaveBeenCalledWith('T1', { amountMinor: 100000, receivedAt: '2026-05-04', method: 'cash' }));
});

test('F-U2.12 bailleur : encaissement déclaré, ajout d’une référence vérifiable', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary, documents: [] });
  billing.getOwnerCollection.mockResolvedValue({ ...collectionData, directReceipts: [{ id: 'DR1', amountMinor: 150000, receivedAt: '2026-05-03T10:00:00Z', status: 'DECLARED' }] });
  billing.submitDirectReceiptEvidence.mockResolvedValue({});
  vi.spyOn(window, 'prompt').mockReturnValueOnce('MTN-TX-1');
  render(<BillingOwnerPage />);
  expect(await screen.findByText(/qu’après confirmation indépendante/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter une référence' }));
  await waitFor(() => expect(billing.submitDirectReceiptEvidence).toHaveBeenCalledWith('DR1', { kind: 'MOBILE_MONEY_REFERENCE', reference: 'MTN-TX-1' }));
});

test('F-U2.12 plateforme : revue d’un encaissement direct', async () => {
  billing.getAdministrationBilling.mockResolvedValue({ plane: 'PLATFORM', summary, documents: [] });
  billing.getIssuerReadiness.mockResolvedValue({ ready: true });
  billing.getDirectReceiptReviewQueue.mockResolvedValue([{ id: 'DR1', amountMinor: 150000, receivedAt: '2026-05-03T10:00:00Z', status: 'UNDER_REVIEW', evidence: [{ kind: 'MOBILE_MONEY_REFERENCE', reference: 'MTN-TX-1' }] }]);
  billing.reviewDirectReceipt.mockResolvedValue({});
  vi.spyOn(window, 'prompt').mockReturnValueOnce('Relevé opérateur vérifié');
  render(<BillingAdministrationPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }));
  await waitFor(() => expect(billing.reviewDirectReceipt).toHaveBeenCalledWith('DR1', { decision: 'confirm', note: 'Relevé opérateur vérifié' }));
});

test('F-U2.13 bailleur autonome : conditions propres au bail, aucun champ prérempli, seuls les champs saisis sont envoyés', async () => {
  billing.getOwnerBilling.mockResolvedValue({ summary, documents: [] });
  billing.getOwnerCollection.mockResolvedValue(collectionData);
  billing.createLeasePolicy.mockResolvedValue({});
  render(<BillingOwnerPage />);
  expect(await screen.findByText(/n’applique aucune échéance, pénalité ni procédure que votre bail ne prévoit pas/)).toBeInTheDocument();
  expect(screen.getByLabelText('Pénalité % (facultatif)')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Bail concerné'), { target: { value: 'L1' } });
  fireEvent.change(screen.getByLabelText('Prise d’effet (AAAA-MM-JJ)'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('Référence du bail'), { target: { value: 'Bail 12' } });
  fireEvent.change(screen.getByLabelText('Jour d’échéance (facultatif)'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les conditions' }));
  await waitFor(() => expect(billing.createLeasePolicy).toHaveBeenCalledWith({ leaseId: 'L1', type: 'OWNER_AUTONOMOUS', terms: { due: { day: 1, monthOffset: 0 } }, effectiveFrom: '2026-11-01', documentReference: 'Bail 12' }));
});
