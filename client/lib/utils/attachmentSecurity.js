// HOTFIX-INBOX-SECURITY-2 — classification minimale et fail-closed des
// pièces jointes dont un rendu direct (Blob brut + window.open) exécuterait
// du contenu actif contrôlé par l'expéditeur dans le contexte d'origine du
// dashboard. Une URL blob: hérite de l'origine de la page qui l'a créée
// (ce n'est PAS une origine opaque) — voir
// server/docs/HOTFIX_INBOX_SECURITY2_THREAT_MODEL.md.
//
// Ne se fie ni à la seule extension ni au seul Content-Type déclaré par
// l'expéditeur : si l'un OU l'autre signale un type actif, la pièce jointe
// est classée active (fail-closed en cas de divergence extension/MIME —
// mandat §34).

const ACTIVE_MIME_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);
const ACTIVE_EXTENSION_PATTERN = /\.(html?|svgz?)$/i;
const SVG_MIME = 'image/svg+xml';
const SVG_EXTENSION_PATTERN = /\.svgz?$/i;

const normalizedMime = (mimetype) => (mimetype || '').toLowerCase().split(';')[0].trim();

// HOTFIX-INBOX-SECURITY-2 — FINAL CERTIFICATION : le nom de fichier est
// déclaré librement par l'expéditeur (en-tête MIME), jamais une URL — un
// suffixe `?...`/`#...` ne doit jamais neutraliser la détection
// d'extension (évasion découverte en certification, ex. `evil.html?x=1`).
const stripQueryOrFragment = (filename) => (filename || '').replace(/[?#].*$/, '');

export function isActiveAttachmentContent({ filename, mimetype } = {}) {
  if (ACTIVE_MIME_TYPES.has(normalizedMime(mimetype))) return true;
  return ACTIVE_EXTENSION_PATTERN.test(stripQueryOrFragment(filename));
}

export function getActiveAttachmentKind({ filename, mimetype } = {}) {
  if (normalizedMime(mimetype) === SVG_MIME || SVG_EXTENSION_PATTERN.test(stripQueryOrFragment(filename))) {
    return 'svg';
  }
  return 'html';
}
