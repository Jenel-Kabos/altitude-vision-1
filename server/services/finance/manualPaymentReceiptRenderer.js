const PDFDocument = require('pdfkit');
const { stableJson, sha256 } = require('./hotelInvoicePdfRenderer');
const clean = (value) => [...String(value || '')].map((character) => { const code = character.charCodeAt(0); return code < 32 || code === 127 ? ' ' : character; }).join('').replace(/\s+/g, ' ').trim();
const money = (value, currency) => `${Number(value).toLocaleString('fr-FR')} ${currency}`;
function renderReceiptPdf(snapshot) {
  return new Promise((resolve, reject) => {
    const chunks = []; const date = new Date(snapshot.generatedAt);
    const pdf = new PDFDocument({ size: 'A4', margin: 42, compress: false, info: { Title: `Reçu ${snapshot.receiptNumber}`, Creator: 'hotel-payment-receipt-v1', CreationDate: date, ModDate: date } });
    pdf.on('data', (chunk) => chunks.push(chunk)); pdf.on('error', reject); pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.fontSize(20).fillColor('#17375e').text('REÇU DE PAIEMENT');
    pdf.fontSize(14).fillColor('#111').text(clean(snapshot.receiptNumber), { align: 'right' });
    pdf.moveDown().fontSize(10).text(`Paiement : ${clean(snapshot.paymentReference)}`);
    pdf.text(`Date : ${date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`);
    pdf.text(`Méthode : ${clean(snapshot.method)}`);
    pdf.moveDown().fontSize(18).text(`Montant reçu : ${money(snapshot.amountMinor, snapshot.currency)}`);
    pdf.moveDown().fontSize(11).fillColor('#17375e').text('Affectations');
    snapshot.allocations.forEach((a) => pdf.fontSize(9).fillColor('#333').text(`${clean(a.documentNumber || a.financialDocument)} : ${money(a.amountMinor, snapshot.currency)}`));
    pdf.moveDown(2).fontSize(8).fillColor('#777').text('Reçu de paiement distinct de la facture • Document immuable', { align: 'center' });
    pdf.end();
  });
}
module.exports = { renderReceiptPdf, stableJson, sha256, safeFilename: (number) => `recu-${clean(number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf` };
