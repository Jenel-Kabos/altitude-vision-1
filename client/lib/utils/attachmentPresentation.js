// INBOX-2 — classification PRÉSENTATIONNELLE des pièces jointes (quelle
// icône afficher), distincte de la classification SÉCURITÉ certifiée
// (`attachmentSecurity.js`, HOTFIX-INBOX-SECURITY-2). Ne jamais utiliser ce
// module pour décider si un contenu doit être sanitizé/sandboxé — voir
// `isActiveAttachmentContent`/`getActiveAttachmentKind` pour cela.
//
// Catégories choisies pour simplifier réellement l'icône affichée
// (mandat §21) : IMAGE, PDF, OFFICE_WORD, OFFICE_SHEET, OFFICE_SLIDE,
// ARCHIVE, AUDIO, VIDEO, TEXT, UNKNOWN. Aucune de ces catégories n'affecte
// le comportement de preview/téléchargement, uniquement l'icône.

const CATEGORY_BY_EXTENSION = {
  pdf: 'PDF',
  doc: 'OFFICE_WORD', docx: 'OFFICE_WORD',
  xls: 'OFFICE_SHEET', xlsx: 'OFFICE_SHEET', csv: 'OFFICE_SHEET',
  ppt: 'OFFICE_SLIDE', pptx: 'OFFICE_SLIDE',
  zip: 'ARCHIVE', rar: 'ARCHIVE', '7z': 'ARCHIVE',
  mp3: 'AUDIO', wav: 'AUDIO', aac: 'AUDIO', m4a: 'AUDIO', ogg: 'AUDIO',
  mp4: 'VIDEO', mov: 'VIDEO', avi: 'VIDEO', webm: 'VIDEO', mkv: 'VIDEO',
  txt: 'TEXT', md: 'TEXT', json: 'TEXT', xml: 'TEXT', log: 'TEXT',
};

const CATEGORY_BY_MIME_PREFIX = [
  [/^image\//, 'IMAGE'],
  [/^audio\//, 'AUDIO'],
  [/^video\//, 'VIDEO'],
  [/^application\/pdf$/, 'PDF'],
  [/^application\/zip$|compressed|x-7z|x-rar/, 'ARCHIVE'],
  [/wordprocessingml|msword/, 'OFFICE_WORD'],
  [/spreadsheetml|ms-excel|^text\/csv$/, 'OFFICE_SHEET'],
  [/presentationml|ms-powerpoint/, 'OFFICE_SLIDE'],
  [/^text\//, 'TEXT'],
];

export function getAttachmentCategory({ filename, mimetype } = {}) {
  const mime = (mimetype || '').toLowerCase();
  const match = CATEGORY_BY_MIME_PREFIX.find(([pattern]) => pattern.test(mime));
  if (match) return match[1];

  const ext = (filename || '').toLowerCase().split('.').pop();
  return CATEGORY_BY_EXTENSION[ext] || 'UNKNOWN';
}
