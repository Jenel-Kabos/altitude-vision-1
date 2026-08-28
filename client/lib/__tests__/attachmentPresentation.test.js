import { getAttachmentCategory } from '../utils/attachmentPresentation';

// INBOX-2 — classification présentationnelle (icône), distincte de la
// classification sécurité certifiée (attachmentSecurity.js, non modifiée
// ni référencée ici). Ne décide jamais du mécanisme de preview/sanitization.
describe('attachmentPresentation — classification par catégorie (icône uniquement)', () => {
  test.each([
    ['photo.jpg', 'image/jpeg', 'IMAGE'],
    ['photo.png', 'image/png', 'IMAGE'],
    ['doc.pdf', 'application/pdf', 'PDF'],
    ['contrat.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'OFFICE_WORD'],
    ['releve.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'OFFICE_SHEET'],
    ['releve.csv', 'text/csv', 'OFFICE_SHEET'],
    ['deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'OFFICE_SLIDE'],
    ['archive.zip', 'application/zip', 'ARCHIVE'],
    ['note.mp3', 'audio/mpeg', 'AUDIO'],
    ['clip.mp4', 'video/mp4', 'VIDEO'],
    ['notes.txt', 'text/plain', 'TEXT'],
    ['data.bin', 'application/octet-stream', 'UNKNOWN'],
    // Extension seule (MIME absent/générique) : repli sur l'extension
    ['rapport.pdf', undefined, 'PDF'],
    ['tableau.xlsx', undefined, 'OFFICE_SHEET'],
  ])('filename=%s mimetype=%s -> %s', (filename, mimetype, expected) => {
    expect(getAttachmentCategory({ filename, mimetype })).toBe(expected);
  });
});
