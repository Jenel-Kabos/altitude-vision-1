import { isActiveAttachmentContent, getActiveAttachmentKind } from '../utils/attachmentSecurity';

// HOTFIX-INBOX-SECURITY-2 — FINAL CERTIFICATION
// Caractérise la classification fail-closed sur les cas adversariaux du
// mandat de certification (§8-9/§26-29) : MIME spoofing dans les deux sens,
// casing, paramètres MIME, double extension, fichier sans extension, MIME
// seul, et nom de fichier avec suffixe query/fragment — un vecteur
// d'évasion réel découvert pendant cette certification (un expéditeur
// contrôle librement le nom de fichier déclaré dans l'en-tête MIME).
describe('attachmentSecurity — classification fail-closed', () => {
  test.each([
    ['evil.html', 'application/octet-stream', true, 'html'],
    ['evil.txt', 'text/html', true, 'html'],
    ['evil.svg', 'image/png', true, 'svg'],
    ['evil.png', 'image/svg+xml', true, 'svg'],
    ['EVIL.HTML', 'application/octet-stream', true, 'html'],
    ['evil.SVG', 'application/octet-stream', true, 'svg'],
    ['evil.html', 'TEXT/HTML', true, 'html'],
    ['evil.html', 'text/html; charset=utf-8', true, 'html'],
    ['invoice.pdf.html', 'application/octet-stream', true, 'html'],
    ['photo.jpg.svg', 'application/octet-stream', true, 'svg'],
    ['evil.svgz', 'application/octet-stream', true, 'svg'],
    ['evil.bin', 'image/svg+xml', true, 'svg'],
    ['photo.jpg', 'image/jpeg', false, undefined],
    ['doc.pdf', 'application/pdf', false, undefined],
    ['noext', 'application/octet-stream', false, undefined],
    // Vecteur d'évasion découvert en certification : un expéditeur contrôle
    // librement le nom de fichier déclaré — un suffixe query/fragment ne
    // doit jamais neutraliser la détection d'extension active.
    ['evil.html?x=1', 'application/octet-stream', true, 'html'],
    ['evil.svg#frag', 'application/octet-stream', true, 'svg'],
    ['evil.html#x?y=1', 'application/octet-stream', true, 'html'],
  ])('filename=%s mimetype=%s -> active=%s kind=%s', (filename, mimetype, expectedActive, expectedKind) => {
    expect(isActiveAttachmentContent({ filename, mimetype })).toBe(expectedActive);
    if (expectedActive) {
      expect(getActiveAttachmentKind({ filename, mimetype })).toBe(expectedKind);
    }
  });

  test('MIME seul, sans filename (pièce jointe sans nom) reste classé actif si le MIME est actif', () => {
    expect(isActiveAttachmentContent({ mimetype: 'image/svg+xml' })).toBe(true);
    expect(getActiveAttachmentKind({ mimetype: 'image/svg+xml' })).toBe('svg');
  });
});
