const mongoose = require('mongoose');
const FinancialDocument = require('../../models/FinancialDocument');
const FinancialPayment = require('../../models/FinancialPayment');
const PaymentAllocation = require('../../models/PaymentAllocation');
const FinancialLedgerEntry = require('../../models/FinancialLedgerEntry');
const FinancialDocumentArtifact = require('../../models/FinancialDocumentArtifact');
const FinancialDocumentDelivery = require('../../models/FinancialDocumentDelivery');
const HotelReservation = require('../../models/HotelReservation');
const C = require('../../constants/financialConstants');
const authz = require('./financialAuthorizationService');
const { scanFinancialConsistency } = require('./financialReconciliationService');
const { HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT } = require('./hotelCheckoutFinancialReadinessService');
const { fail } = require('./financialError');

const DOMAIN = 'hotel';
const TIMEZONE = 'Africa/Brazzaville';
const DAY_MS = 86400000;
const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 366;
const MAX_TREND_POINTS = 400;
const GRANULARITIES = ['day', 'week', 'month'];
const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'delivery_unknown', 'cancelled'];
const AGING_BUCKETS = [
  { key: '0_7', minDays: 0, maxDays: 7 },
  { key: '8_30', minDays: 8, maxDays: 30 },
  { key: '31_60', minDays: 31, maxDays: 60 },
  { key: '61_90', minDays: 61, maxDays: 90 },
  { key: 'over_90', minDays: 91, maxDays: Infinity },
];

const isObjectId = (value) => mongoose.isValidObjectId(value);
const oid = (value) => new mongoose.Types.ObjectId(String(value));
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', `${label} invalide.`, 422);
  return date;
}

function resolveGranularity(spanDays, requested) {
  if (requested) {
    if (!GRANULARITIES.includes(requested)) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'granularity inconnue.', 422);
    return requested;
  }
  if (spanDays <= 62) return 'day';
  if (spanDays <= 180) return 'week';
  return 'month';
}

// Fonction pure (pas d'accès DB) : validée indépendamment en test unitaire.
function validateDashboardFilters(query = {}) {
  const now = new Date();
  const dateTo = parseDate(query.dateTo, 'dateTo') || now;
  const defaultFrom = new Date(dateTo.getTime() - DEFAULT_PERIOD_DAYS * DAY_MS);
  const dateFrom = parseDate(query.dateFrom, 'dateFrom') || defaultFrom;
  if (dateFrom.getTime() > dateTo.getTime()) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'dateFrom doit précéder dateTo.', 422);
  const spanDays = (dateTo.getTime() - dateFrom.getTime()) / DAY_MS;
  if (spanDays > MAX_PERIOD_DAYS) fail('FINANCIAL_DASHBOARD_PERIOD_TOO_LARGE', `La période ne peut excéder ${MAX_PERIOD_DAYS} jours.`, 422);
  if (query.hotelId && !isObjectId(query.hotelId)) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'hotelId invalide.', 422);
  if (query.documentStatus && !C.FINANCIAL_DOCUMENT_STATUSES.includes(String(query.documentStatus))) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'documentStatus inconnu.', 422);
  if (query.paymentStatus && !C.FINANCIAL_PAYMENT_STATUSES.includes(String(query.paymentStatus))) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'paymentStatus inconnu.', 422);
  if (query.deliveryStatus && !DELIVERY_STATUSES.includes(String(query.deliveryStatus))) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'deliveryStatus inconnu.', 422);
  const granularity = resolveGranularity(spanDays, query.granularity ? String(query.granularity) : null);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  if (Number(query.page) < 0 || Number(query.limit) < 0) fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'page/limit ne peuvent être négatifs.', 422);
  const search = query.search ? escapeRegex(String(query.search).slice(0, 100)) : null;
  return {
    hotelId: query.hotelId ? String(query.hotelId) : null,
    dateFrom, dateTo, spanDays,
    documentStatus: query.documentStatus ? String(query.documentStatus) : null,
    paymentStatus: query.paymentStatus ? String(query.paymentStatus) : null,
    deliveryStatus: query.deliveryStatus ? String(query.deliveryStatus) : null,
    granularity, page, limit, search,
  };
}

function agingBucketFor(days) {
  return AGING_BUCKETS.find((bucket) => days >= bucket.minDays && days <= bucket.maxDays)?.key || 'over_90';
}

function dataStatusFromIssues(issues = []) {
  if (issues.some((issue) => issue.severity === 'critical')) return 'critical';
  if (issues.length > 0) return 'warning';
  return 'healthy';
}

async function resolveScope(user, hotelId, capabilityAssert) {
  const { hotel, global } = await capabilityAssert(user, hotelId);
  return { hotelMatch: global ? {} : { establishmentId: oid(hotelId) }, global, hotel };
}

function num(value) {
  return Number(value || 0);
}

async function getHotelFinancialDashboardSummary({ user, filters }) {
  const { hotelMatch, global } = await resolveScope(user, filters.hotelId, authz.assertCanViewFinancialDashboard);
  const period = { $gte: filters.dateFrom, $lte: filters.dateTo };

  const issuedMatch = { domain: DOMAIN, ...hotelMatch, status: 'issued', issueDate: period };
  const paymentMatch = { domain: DOMAIN, ...hotelMatch, status: 'succeeded', confirmedAt: period };
  const allocationMatch = { domain: DOMAIN, ...hotelMatch, status: 'active', allocatedAt: period };
  const artifactMatch = { domain: DOMAIN, ...hotelMatch, status: 'ready', generatedAt: period };
  const deliveryHotelMatch = global ? {} : { establishmentId: hotelMatch.establishmentId };

  const [documentAgg, paymentAgg, allocationAgg, artifactReadyCount, artifactMissingCount, deliveryAgg, overrideCount] = await Promise.all([
    FinancialDocument.aggregate([
      { $match: issuedMatch },
      { $group: {
        _id: null,
        invoicedMinor: { $sum: '$totalMinor' },
        outstandingMinor: { $sum: { $cond: [{ $gt: ['$balanceMinor', 0] }, '$balanceMinor', 0] } },
        issuedCount: { $sum: 1 },
        unpaidCount: { $sum: { $cond: [{ $and: [{ $eq: ['$amountAllocatedMinor', 0] }, { $gt: ['$balanceMinor', 0] }] }, 1, 0] } },
        partiallyPaidCount: { $sum: { $cond: [{ $and: [{ $gt: ['$amountAllocatedMinor', 0] }, { $gt: ['$balanceMinor', 0] }] }, 1, 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ['$balanceMinor', 0] }, 1, 0] } },
        nonXafCount: { $sum: { $cond: [{ $ne: ['$currency', 'XAF'] }, 1, 0] } },
      } },
    ]),
    FinancialPayment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, confirmedPaymentsMinor: { $sum: '$amountMinor' }, unallocatedConfirmedMinor: { $sum: '$availableAmountMinor' }, confirmedCount: { $sum: 1 } } },
    ]),
    PaymentAllocation.aggregate([
      { $match: allocationMatch },
      { $group: { _id: null, allocatedMinor: { $sum: '$amountMinor' } } },
    ]),
    FinancialDocumentArtifact.countDocuments(artifactMatch),
    FinancialDocument.countDocuments({ domain: DOMAIN, ...hotelMatch, status: 'issued', ...(global ? {} : {}) }).then(async (issuedTotal) => {
      const ready = await FinancialDocumentArtifact.countDocuments({ domain: DOMAIN, ...hotelMatch, status: 'ready' });
      return Math.max(0, issuedTotal - ready);
    }),
    FinancialDocumentDelivery.aggregate([
      { $match: { ...deliveryHotelMatch, requestedAt: period } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    FinancialLedgerEntry.countDocuments({ eventType: HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT.eventType, ...(global ? {} : { establishmentId: hotelMatch.establishmentId }), occurredAt: period }),
  ]);

  const doc = documentAgg[0] || { invoicedMinor: 0, outstandingMinor: 0, issuedCount: 0, unpaidCount: 0, partiallyPaidCount: 0, paidCount: 0, nonXafCount: 0 };
  const pay = paymentAgg[0] || { confirmedPaymentsMinor: 0, unallocatedConfirmedMinor: 0, confirmedCount: 0 };
  const alloc = allocationAgg[0] || { allocatedMinor: 0 };
  const deliveryByStatus = Object.fromEntries(deliveryAgg.map((row) => [row._id, row.count]));

  // Le décompte "check-out bloqué" est une projection légère (réservations checked_in dont le
  // document émis a un solde positif), pas une ré-évaluation complète de hotelCheckoutFinancialReadinessService
  // (qui coûterait un appel par réservation active). Voir server/docs/HOTEL_FINANCIAL_DASHBOARD_F2_5.md §16.
  const blockedCheckoutMatch = { domain: DOMAIN, ...hotelMatch, status: 'issued', balanceMinor: { $gt: 0 } };
  const blockedCheckoutCount = await FinancialDocument.aggregate([
    { $match: blockedCheckoutMatch },
    { $lookup: { from: 'hotelreservations', localField: 'subjectId', foreignField: '_id', as: 'reservation' } },
    { $unwind: '$reservation' },
    { $match: { 'reservation.status': 'checked_in' } },
    { $count: 'count' },
  ]).then((rows) => rows[0]?.count || 0);

  let anomalyCount = null;
  let dataStatus = 'unavailable';
  if (!global) {
    const scan = await scanFinancialConsistency({ domain: DOMAIN, establishmentId: hotelMatch.establishmentId });
    anomalyCount = scan.issues.length;
    dataStatus = dataStatusFromIssues(scan.issues);
  }
  if (doc.nonXafCount > 0 && dataStatus === 'healthy') dataStatus = 'warning';

  return {
    period: { from: filters.dateFrom.toISOString(), to: filters.dateTo.toISOString(), timezone: TIMEZONE },
    scope: { hotelId: filters.hotelId || null, global },
    currency: 'XAF',
    dataStatus,
    generatedAt: new Date().toISOString(),
    totals: {
      invoicedMinor: num(doc.invoicedMinor),
      confirmedPaymentsMinor: num(pay.confirmedPaymentsMinor),
      allocatedMinor: num(alloc.allocatedMinor),
      outstandingMinor: num(doc.outstandingMinor),
      unallocatedConfirmedMinor: num(pay.unallocatedConfirmedMinor),
    },
    documents: {
      issuedCount: num(doc.issuedCount),
      unpaidCount: num(doc.unpaidCount),
      partiallyPaidCount: num(doc.partiallyPaidCount),
      paidCount: num(doc.paidCount),
      anomalyCount,
      nonXafExcludedCount: num(doc.nonXafCount),
    },
    checkout: { blockedCount: blockedCheckoutCount, overrideCount: num(overrideCount) },
    delivery: {
      pdfReadyCount: artifactReadyCount,
      pdfMissingCount: artifactMissingCount,
      emailSentCount: deliveryByStatus.sent || 0,
      emailFailedCount: deliveryByStatus.failed || 0,
      emailUnknownCount: deliveryByStatus.delivery_unknown || 0,
    },
  };
}

function bucketBounds(date, granularity) {
  const d = new Date(date);
  if (granularity === 'day') { d.setUTCHours(0, 0, 0, 0); return d; }
  if (granularity === 'week') {
    d.setUTCHours(0, 0, 0, 0);
    const day = d.getUTCDay();
    const diff = (day + 6) % 7; // lundi = début de semaine
    d.setUTCDate(d.getUTCDate() - diff);
    return d;
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function getHotelFinancialDashboardTrends({ user, filters }) {
  const { hotelMatch } = await resolveScope(user, filters.hotelId, authz.assertCanViewFinancialDashboard);
  const period = { $gte: filters.dateFrom, $lte: filters.dateTo };
  const dateExpr = filters.granularity === 'day'
    ? { $dateTrunc: { date: '$issueDate', unit: 'day' } }
    : filters.granularity === 'week'
      ? { $dateTrunc: { date: '$issueDate', unit: 'week', startOfWeek: 'monday' } }
      : { $dateTrunc: { date: '$issueDate', unit: 'month' } };

  const rows = await FinancialDocument.aggregate([
    { $match: { domain: DOMAIN, ...hotelMatch, status: 'issued', issueDate: period } },
    { $group: {
      _id: dateExpr,
      invoicedMinor: { $sum: '$totalMinor' },
      outstandingMinor: { $sum: { $cond: [{ $gt: ['$balanceMinor', 0] }, '$balanceMinor', 0] } },
      documentCount: { $sum: 1 },
    } },
    { $sort: { _id: 1 } },
    { $limit: MAX_TREND_POINTS },
  ]);

  const paymentRows = await FinancialPayment.aggregate([
    { $match: { domain: DOMAIN, ...hotelMatch, status: 'succeeded', confirmedAt: period } },
    { $group: {
      _id: filters.granularity === 'day' ? { $dateTrunc: { date: '$confirmedAt', unit: 'day' } } : filters.granularity === 'week' ? { $dateTrunc: { date: '$confirmedAt', unit: 'week', startOfWeek: 'monday' } } : { $dateTrunc: { date: '$confirmedAt', unit: 'month' } },
      confirmedPaymentsMinor: { $sum: '$amountMinor' },
    } },
  ]);
  const allocationRows = await PaymentAllocation.aggregate([
    { $match: { domain: DOMAIN, ...hotelMatch, status: 'active', allocatedAt: period } },
    { $group: {
      _id: filters.granularity === 'day' ? { $dateTrunc: { date: '$allocatedAt', unit: 'day' } } : filters.granularity === 'week' ? { $dateTrunc: { date: '$allocatedAt', unit: 'week', startOfWeek: 'monday' } } : { $dateTrunc: { date: '$allocatedAt', unit: 'month' } },
      allocatedMinor: { $sum: '$amountMinor' },
    } },
  ]);

  const paymentByKey = new Map(paymentRows.map((row) => [row._id.getTime(), row.confirmedPaymentsMinor]));
  const allocationByKey = new Map(allocationRows.map((row) => [row._id.getTime(), row.allocatedMinor]));

  // Représenter les périodes sans facturation pour la lisibilité des séries.
  const points = [];
  let cursor = bucketBounds(filters.dateFrom, filters.granularity);
  const end = filters.dateTo;
  const byKey = new Map(rows.map((row) => [row._id.getTime(), row]));
  let guard = 0;
  while (cursor <= end && guard < MAX_TREND_POINTS) {
    const key = cursor.getTime();
    const row = byKey.get(key);
    points.push({
      periodStart: cursor.toISOString(),
      invoicedMinor: num(row?.invoicedMinor),
      confirmedPaymentsMinor: num(paymentByKey.get(key)),
      allocatedMinor: num(allocationByKey.get(key)),
      outstandingMinor: num(row?.outstandingMinor),
      documentCount: num(row?.documentCount),
    });
    const next = new Date(cursor);
    if (filters.granularity === 'day') next.setUTCDate(next.getUTCDate() + 1);
    else if (filters.granularity === 'week') next.setUTCDate(next.getUTCDate() + 7);
    else next.setUTCMonth(next.getUTCMonth() + 1);
    cursor = next;
    guard += 1;
  }

  return { granularity: filters.granularity, points };
}

async function getHotelFinancialDashboardBreakdown({ user, filters, dimension }) {
  const { hotelMatch } = await resolveScope(user, filters.hotelId, authz.assertCanViewFinancialDashboard);
  const period = { $gte: filters.dateFrom, $lte: filters.dateTo };
  const match = { domain: DOMAIN, ...hotelMatch, status: 'issued', issueDate: period };

  if (dimension === 'hotel') {
    const rows = await FinancialDocument.aggregate([
      { $match: match },
      { $group: { _id: '$establishmentId', invoicedMinor: { $sum: '$totalMinor' }, outstandingMinor: { $sum: { $cond: [{ $gt: ['$balanceMinor', 0] }, '$balanceMinor', 0] } }, documentCount: { $sum: 1 } } },
      { $sort: { invoicedMinor: -1 } },
      { $limit: 200 },
    ]);
    return { dimension, rows: rows.map((row) => ({ hotelId: row._id, invoicedMinor: num(row.invoicedMinor), outstandingMinor: num(row.outstandingMinor), documentCount: row.documentCount })) };
  }
  if (dimension === 'status') {
    const rows = await FinancialDocument.aggregate([
      { $match: { domain: DOMAIN, ...hotelMatch, issueDate: period } },
      { $group: { _id: '$status', invoicedMinor: { $sum: '$totalMinor' }, documentCount: { $sum: 1 } } },
    ]);
    return { dimension, rows: rows.map((row) => ({ status: row._id, invoicedMinor: num(row.invoicedMinor), documentCount: row.documentCount })) };
  }
  if (dimension === 'paymentMethod') {
    const rows = await FinancialPayment.aggregate([
      { $match: { domain: DOMAIN, ...hotelMatch, status: 'succeeded', confirmedAt: period } },
      { $group: { _id: '$method', amountMinor: { $sum: '$amountMinor' }, paymentCount: { $sum: 1 } } },
    ]);
    return { dimension, rows: rows.map((row) => ({ method: row._id, amountMinor: num(row.amountMinor), paymentCount: row.paymentCount })) };
  }
  if (dimension === 'documentType') {
    const rows = await FinancialDocument.aggregate([
      { $match: { domain: DOMAIN, ...hotelMatch, status: 'issued', issueDate: period } },
      { $group: { _id: '$documentType', invoicedMinor: { $sum: '$totalMinor' }, documentCount: { $sum: 1 } } },
    ]);
    return { dimension, rows: rows.map((row) => ({ documentType: row._id, invoicedMinor: num(row.invoicedMinor), documentCount: row.documentCount })) };
  }
  if (dimension === 'currency') {
    const rows = await FinancialDocument.aggregate([
      { $match: { domain: DOMAIN, ...hotelMatch, status: 'issued', issueDate: period } },
      { $group: { _id: '$currency', invoicedMinor: { $sum: '$totalMinor' }, documentCount: { $sum: 1 } } },
    ]);
    return { dimension, rows: rows.map((row) => ({ currency: row._id, invoicedMinor: num(row.invoicedMinor), documentCount: row.documentCount, isSupported: row._id === 'XAF' })) };
  }
  fail('FINANCIAL_DASHBOARD_FILTER_INVALID', 'Dimension de répartition inconnue.', 422);
}

async function getHotelFinancialDashboardAging({ user, filters }) {
  const { hotelMatch } = await resolveScope(user, filters.hotelId, authz.assertCanViewFinancialDashboard);
  const rows = await FinancialDocument.find({ domain: DOMAIN, ...hotelMatch, status: 'issued', balanceMinor: { $gt: 0 } })
    .select('issueDate balanceMinor establishmentId')
    .lean();
  const now = Date.now();
  const buckets = new Map(AGING_BUCKETS.map((bucket) => [bucket.key, { bucket: bucket.key, documentCount: 0, outstandingMinor: 0 }]));
  rows.forEach((row) => {
    const days = Math.floor((now - new Date(row.issueDate).getTime()) / DAY_MS);
    const key = agingBucketFor(Math.max(0, days));
    const entry = buckets.get(key);
    entry.documentCount += 1;
    entry.outstandingMinor += num(row.balanceMinor);
  });
  return { basis: 'issueDate', buckets: AGING_BUCKETS.map((bucket) => buckets.get(bucket.key)) };
}

function severityRank(severity) {
  return severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2;
}

async function getHotelFinancialDashboardAlerts({ user, filters }) {
  const { hotelMatch, global } = await resolveScope(user, filters.hotelId, authz.assertCanViewFinancialDashboardAlerts);
  const period = { $gte: filters.dateFrom, $lte: filters.dateTo };
  const alerts = [];

  const unpaidDocs = await FinancialDocument.find({ domain: DOMAIN, ...hotelMatch, status: 'issued', balanceMinor: { $gt: 0 } })
    .select('documentNumber balanceMinor establishmentId subjectId issueDate').sort({ balanceMinor: -1 }).limit(200).lean();
  unpaidDocs.forEach((docRow) => alerts.push({
    code: 'FINANCIAL_DASHBOARD_DOCUMENT_OUTSTANDING', severity: 'warning',
    title: 'Facture avec solde restant', message: `Facture ${docRow.documentNumber || docRow._id} : solde restant ${docRow.balanceMinor} XAF (minor).`,
    entityType: 'FinancialDocument', entityId: docRow._id, hotelId: docRow.establishmentId, reservationId: docRow.subjectId, documentId: docRow._id,
    createdAt: docRow.issueDate, actionLink: `/dashboard/hotel-finance/documents/${docRow._id}`,
  }));

  const unallocatedPayments = await FinancialPayment.find({ domain: DOMAIN, ...hotelMatch, status: 'succeeded', availableAmountMinor: { $gt: 0 } })
    .select('paymentReference availableAmountMinor establishmentId subjectId confirmedAt').sort({ availableAmountMinor: -1 }).limit(200).lean();
  unallocatedPayments.forEach((paymentRow) => alerts.push({
    code: 'FINANCIAL_DASHBOARD_PAYMENT_UNALLOCATED', severity: 'warning',
    title: 'Paiement confirmé non alloué', message: `Paiement ${paymentRow.paymentReference} : ${paymentRow.availableAmountMinor} XAF (minor) disponible.`,
    entityType: 'FinancialPayment', entityId: paymentRow._id, hotelId: paymentRow.establishmentId, reservationId: paymentRow.subjectId, documentId: null,
    createdAt: paymentRow.confirmedAt, actionLink: `/dashboard/hotel-finance/payments/${paymentRow._id}`,
  }));

  const failedDeliveries = await FinancialDocumentDelivery.find({ ...(global ? {} : { establishmentId: hotelMatch.establishmentId }), status: { $in: ['failed', 'delivery_unknown'] } })
    .select('financialDocument establishmentId reservationId status requestedAt normalizedErrorCode').sort({ requestedAt: -1 }).limit(200).lean();
  failedDeliveries.forEach((deliveryRow) => alerts.push({
    code: deliveryRow.status === 'failed' ? 'FINANCIAL_DASHBOARD_EMAIL_FAILED' : 'FINANCIAL_DASHBOARD_EMAIL_UNKNOWN',
    severity: deliveryRow.status === 'failed' ? 'warning' : 'warning',
    title: deliveryRow.status === 'failed' ? 'Email de facture échoué' : 'Statut de livraison incertain',
    message: deliveryRow.normalizedErrorCode || 'Statut de livraison à vérifier.',
    entityType: 'FinancialDocumentDelivery', entityId: deliveryRow._id, hotelId: deliveryRow.establishmentId, reservationId: deliveryRow.reservationId, documentId: deliveryRow.financialDocument,
    createdAt: deliveryRow.requestedAt, actionLink: `/dashboard/hotel-finance/documents/${deliveryRow.financialDocument}`,
  }));

  const missingPdfDocs = await FinancialDocument.find({ domain: DOMAIN, ...hotelMatch, status: 'issued' }).select('documentNumber establishmentId subjectId issueDate').limit(500).lean();
  if (missingPdfDocs.length) {
    const ready = await FinancialDocumentArtifact.find({ financialDocument: { $in: missingPdfDocs.map((d) => d._id) }, status: 'ready' }).select('financialDocument').lean();
    const readyIds = new Set(ready.map((a) => String(a.financialDocument)));
    missingPdfDocs.filter((d) => !readyIds.has(String(d._id))).forEach((docRow) => alerts.push({
      code: 'FINANCIAL_DASHBOARD_PDF_MISSING', severity: 'info',
      title: 'Document sans PDF officiel', message: `Facture ${docRow.documentNumber || docRow._id} sans PDF officiel généré.`,
      entityType: 'FinancialDocument', entityId: docRow._id, hotelId: docRow.establishmentId, reservationId: docRow.subjectId, documentId: docRow._id,
      createdAt: docRow.issueDate, actionLink: `/dashboard/hotel-finance/documents/${docRow._id}`,
    }));
  }

  if (!global) {
    const scan = await scanFinancialConsistency({ domain: DOMAIN, establishmentId: hotelMatch.establishmentId });
    scan.issues.forEach((scanIssue) => alerts.push({
      code: scanIssue.code, severity: scanIssue.severity === 'critical' ? 'critical' : 'warning',
      title: 'Anomalie de réconciliation', message: scanIssue.code,
      entityType: scanIssue.entityType, entityId: scanIssue.entityId, hotelId: filters.hotelId, reservationId: null, documentId: scanIssue.entityType === 'FinancialDocument' ? scanIssue.entityId : null,
      createdAt: new Date(scan.scannedAt), actionLink: null,
    }));
  }

  const overrides = await FinancialLedgerEntry.find({ eventType: HOTEL_CHECKOUT_FINANCIAL_OVERRIDE_EVENT.eventType, ...(global ? {} : { establishmentId: hotelMatch.establishmentId }), occurredAt: period })
    .select('entityId establishmentId occurredAt newState metadata').sort({ occurredAt: -1 }).limit(200).lean();
  overrides.forEach((overrideRow) => alerts.push({
    code: 'FINANCIAL_DASHBOARD_CHECKOUT_OVERRIDE', severity: 'info',
    title: 'Dérogation administrative au check-out', message: 'Check-out autorisé malgré un solde ou une anomalie financière.',
    entityType: 'HotelReservation', entityId: overrideRow.entityId, hotelId: overrideRow.establishmentId, reservationId: overrideRow.entityId, documentId: overrideRow.newState?.financialDocumentId || null,
    createdAt: overrideRow.occurredAt, actionLink: null,
  }));

  alerts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || new Date(b.createdAt) - new Date(a.createdAt) || String(a.entityId).localeCompare(String(b.entityId)));

  const total = alerts.length;
  const start = (filters.page - 1) * filters.limit;
  const pageItems = alerts.slice(start, start + filters.limit);
  return { alerts: pageItems, pagination: { page: filters.page, limit: filters.limit, total } };
}

module.exports = {
  DELIVERY_STATUSES, AGING_BUCKETS, TIMEZONE,
  validateDashboardFilters,
  getHotelFinancialDashboardSummary,
  getHotelFinancialDashboardTrends,
  getHotelFinancialDashboardBreakdown,
  getHotelFinancialDashboardAging,
  getHotelFinancialDashboardAlerts,
};
