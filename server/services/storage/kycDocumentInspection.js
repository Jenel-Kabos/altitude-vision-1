// F-U1.J — Inspection structurelle des justificatifs KYC (sans dépendance).
//
// Complète la vérification de signature binaire. Refuse :
//   - les fichiers sans marqueur de fin conforme ou avec des octets après la
//     fin logique (fichiers polyglottes : image/PDF suivis d'une archive,
//     d'un script…) ;
//   - les images aux dimensions excessives (bombes de décompression) ;
//   - les PDF chiffrés ou contenant des éléments actifs (JavaScript, actions
//     automatiques, lancement, fichiers incorporés, formulaires XFA, médias).
//
// LIMITES ASSUMÉES : ce n'est pas un antivirus ni une neutralisation de
// contenu (CDR) — des objets PDF compressés peuvent masquer des marqueurs.
// Le stockage réel exige en plus un analyseur déclaré (voir
// kycDocumentScanner) ; à défaut, il reste fermé.

const MAX_IMAGE_PIXELS = 40 * 1000 * 1000;
const MAX_IMAGE_SIDE = 12000;
const PDF_ACTIVE_MARKERS = ['/JavaScript', '/JS', '/OpenAction', '/AA', '/Launch', '/EmbeddedFile', '/EmbeddedFiles', '/RichMedia', '/XFA', '/SubmitForm', '/ImportData', '/GoToR', '/GoToE'];
const PDF_TRAILER_WINDOW = 1024;

const inspectionError = (code, message) => Object.assign(new Error(message), { name: 'FinancialError', code, statusCode: 415 });

function assertDimensions(width, height) {
  if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
    throw inspectionError('KYC_DOCUMENT_DIMENSIONS_INVALID', 'Dimensions d’image invalides ou excessives.');
  }
}

function inspectPng(buffer) {
  // IHDR : premier chunk, largeur/hauteur sur 4 octets big-endian.
  if (buffer.length < 33 || buffer.subarray(12, 16).toString('latin1') !== 'IHDR') throw inspectionError('KYC_DOCUMENT_MALFORMED', 'PNG malformé.');
  assertDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
  // Parcours des chunks jusqu'à IEND, qui doit terminer exactement le fichier.
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    const next = offset + 12 + length;
    if (next > buffer.length) throw inspectionError('KYC_DOCUMENT_MALFORMED', 'PNG tronqué.');
    if (type === 'IEND') {
      if (next !== buffer.length) throw inspectionError('KYC_DOCUMENT_TRAILING_DATA', 'Données inattendues après la fin de l’image.');
      return;
    }
    offset = next;
  }
  throw inspectionError('KYC_DOCUMENT_MALFORMED', 'PNG sans marqueur de fin.');
}

function inspectJpeg(buffer) {
  let offset = 2; let dimensionsSeen = false;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) throw inspectionError('KYC_DOCUMENT_MALFORMED', 'JPEG malformé.');
    const marker = buffer[offset + 1];
    if (marker === 0xd9) break;
    if (marker === 0xda) {
      // Données d'image : la fin logique est le dernier EOI.
      const eoi = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
      if (eoi < offset) throw inspectionError('KYC_DOCUMENT_MALFORMED', 'JPEG sans marqueur de fin.');
      if (eoi + 2 !== buffer.length) throw inspectionError('KYC_DOCUMENT_TRAILING_DATA', 'Données inattendues après la fin de l’image.');
      if (!dimensionsSeen) throw inspectionError('KYC_DOCUMENT_MALFORMED', 'JPEG sans dimensions.');
      return;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) throw inspectionError('KYC_DOCUMENT_MALFORMED', 'JPEG tronqué.');
    // Marqueurs SOF (hors DHT/JPG/DAC) : hauteur puis largeur.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      assertDimensions(buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5));
      dimensionsSeen = true;
    }
    offset += 2 + length;
  }
  throw inspectionError('KYC_DOCUMENT_MALFORMED', 'JPEG sans données d’image.');
}

function inspectPdf(buffer) {
  const text = buffer.toString('latin1');
  const tail = text.slice(-PDF_TRAILER_WINDOW);
  const eof = tail.lastIndexOf('%%EOF');
  if (eof < 0 || tail.slice(eof + 5).trim().length > 0) throw inspectionError('KYC_DOCUMENT_TRAILING_DATA', 'PDF sans fin conforme ou suivi de données inattendues.');
  if (/\/Encrypt\b/.test(text)) throw inspectionError('KYC_DOCUMENT_ACTIVE_CONTENT', 'PDF chiffré non accepté.');
  const found = PDF_ACTIVE_MARKERS.find((marker) => new RegExp(`${marker.replace('/', '\\/')}(?![A-Za-z])`).test(text));
  if (found) throw inspectionError('KYC_DOCUMENT_ACTIVE_CONTENT', 'PDF contenant des éléments actifs non accepté.');
}

function inspectKycDocument(buffer, mimeType) {
  if (mimeType === 'image/png') return inspectPng(buffer);
  if (mimeType === 'image/jpeg') return inspectJpeg(buffer);
  if (mimeType === 'application/pdf') return inspectPdf(buffer);
  throw inspectionError('KYC_DOCUMENT_CONTENT_INVALID', 'Format non accepté.');
}

module.exports = { inspectKycDocument, MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE, PDF_ACTIVE_MARKERS };
