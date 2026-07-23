const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { fail } = require('./financialError');

const TEMPLATE_VERSION = 'hotel-invoice-v1';
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const stableJson = (value) => JSON.stringify(canonicalize(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stripControls = (value) => [...String(value || '')].map((character) => { const code = character.charCodeAt(0); return code < 32 || code === 127 ? ' ' : character; }).join('');
const clean = (value) => stripControls(value).replace(/\s+/g, ' ').trim();
const formatDate = (value) => value ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';
const formatMoney = (value) => `${Number(value || 0).toLocaleString('fr-FR')} XAF`;
const safeFilename = (number) => `facture-${clean(number).replace(/[^a-zA-Z0-9_-]+/g, '-') || 'hotel'}.pdf`;

function buildOfficialSnapshot(document, lines) {
  if (!document || document.domain !== 'hotel' || document.status !== 'issued') fail('FINANCIAL_DOCUMENT_NOT_ISSUED', 'Une facture hôtelière émise est requise.', 409);
  if (document.currency !== 'XAF') fail('FINANCIAL_CURRENCY_UNSUPPORTED', 'Le PDF hôtelier officiel est limité au XAF.', 409);
  if (document.metadata?.linesFinalized !== true || !document.documentNumber || !document.issueDate) fail('FINANCIAL_PDF_GENERATION_FAILED', 'Le snapshot officiel est incomplet.', 409);
  if (!Array.isArray(lines) || !lines.length) fail('FINANCIAL_PDF_GENERATION_FAILED', 'Les lignes officielles sont absentes.', 409);
  const ordered = [...lines].sort((a, b) => Number(a.lineNumber) - Number(b.lineNumber)).map((line) => ({
    lineNumber: Number(line.lineNumber), description: clean(line.description), quantity: Number(line.quantity),
    unitAmountMinor: Number(line.unitAmountMinor), subtotalMinor: Number(line.subtotalMinor),
    discountAmountMinor: Number(line.discountAmountMinor || 0), taxAmountMinor: Number(line.taxAmountMinor || 0),
    feesAmountMinor: Number(line.feesAmountMinor || 0), totalMinor: Number(line.totalMinor),
  }));
  const sum = (key) => ordered.reduce((total, line) => total + line[key], 0);
  const expected = { subtotalMinor: sum('subtotalMinor'), discountTotalMinor: sum('discountAmountMinor'), taxTotalMinor: sum('taxAmountMinor'), feesTotalMinor: sum('feesAmountMinor'), totalMinor: sum('totalMinor') };
  if (Object.entries(expected).some(([key, value]) => !Number.isSafeInteger(value) || Number(document[key]) !== value)) fail('FINANCIAL_PDF_GENERATION_FAILED', 'Les totaux officiels sont incohérents.', 409);
  return canonicalize({
    templateVersion: TEMPLATE_VERSION, documentId: String(document._id), documentType: document.documentType,
    documentNumber: clean(document.documentNumber), issueDate: new Date(document.issueDate).toISOString(), currency: 'XAF',
    reservationId: String(document.subjectId), reservationReference: clean(document.metadata?.reservationReference),
    origin: clean(document.metadata?.source || 'hotel_reservation'), servicePeriodStart: document.servicePeriodStart ? new Date(document.servicePeriodStart).toISOString() : null,
    servicePeriodEnd: document.servicePeriodEnd ? new Date(document.servicePeriodEnd).toISOString() : null,
    customer: canonicalize(document.customer?.toObject?.() || document.customer || {}), seller: canonicalize(document.seller?.toObject?.() || document.seller || {}),
    lines: ordered, totals: expected,
  });
}

function renderOfficialInvoicePdf(snapshot) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const fixedDate = new Date(snapshot.issueDate);
    const pdf = new PDFDocument({ size: 'A4', margin: 42, compress: false, info: { Title: `Facture ${snapshot.documentNumber}`, Author: snapshot.seller.name || 'Altitude Vision', Creator: TEMPLATE_VERSION, Producer: TEMPLATE_VERSION, CreationDate: fixedDate, ModDate: fixedDate } });
    pdf.on('data', (chunk) => chunks.push(chunk)); pdf.on('error', reject); pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.fontSize(20).fillColor('#17375e').text(clean(snapshot.seller.name || 'Hôtel'));
    pdf.fontSize(9).fillColor('#333').text([snapshot.seller.legalInformation, snapshot.seller.address, snapshot.seller.phone, snapshot.seller.email, snapshot.seller.taxIdentifier].filter(Boolean).map(clean).join(' • '));
    pdf.moveDown().fontSize(18).fillColor('#111').text(`FACTURE ${snapshot.documentNumber}`, { align: 'right' });
    pdf.fontSize(10).text(`Émise le ${formatDate(snapshot.issueDate)} • Devise XAF`, { align: 'right' });
    pdf.moveDown().fontSize(11).fillColor('#17375e').text('Client facturé');
    pdf.fontSize(9).fillColor('#333').text([snapshot.customer.name, snapshot.customer.email, snapshot.customer.phone, snapshot.customer.address].filter(Boolean).map(clean).join('\n'));
    pdf.moveDown().text(`Réservation : ${snapshot.reservationReference || snapshot.reservationId}`);
    pdf.text(`Séjour : ${formatDate(snapshot.servicePeriodStart)} au ${formatDate(snapshot.servicePeriodEnd)}`);
    pdf.moveDown().fontSize(10).fillColor('#17375e').text('DÉTAIL', { underline: true });
    snapshot.lines.forEach((line) => {
      pdf.moveDown(0.5).fillColor('#111').fontSize(9).text(`${line.lineNumber}. ${clean(line.description)}`);
      pdf.fillColor('#555').text(`${line.quantity} × ${formatMoney(line.unitAmountMinor)}  | Sous-total ${formatMoney(line.subtotalMinor)} | Taxe ${formatMoney(line.taxAmountMinor)} | Frais ${formatMoney(line.feesAmountMinor)} | Remise ${formatMoney(line.discountAmountMinor)} | Total ${formatMoney(line.totalMinor)}`);
    });
    pdf.moveDown().fillColor('#111').fontSize(10);
    [['Sous-total', 'subtotalMinor'], ['Taxes', 'taxTotalMinor'], ['Frais', 'feesTotalMinor'], ['Remises', 'discountTotalMinor'], ['TOTAL', 'totalMinor']].forEach(([label, key]) => pdf.text(`${label} : ${formatMoney(snapshot.totals[key])}`, { align: 'right' }));
    pdf.moveDown(2).fontSize(8).fillColor('#777').text(`Document officiel immuable • Modèle ${TEMPLATE_VERSION}`, { align: 'center' });
    pdf.end();
  });
}

module.exports = { TEMPLATE_VERSION, buildOfficialSnapshot, renderOfficialInvoicePdf, stableJson, sha256, safeFilename };
