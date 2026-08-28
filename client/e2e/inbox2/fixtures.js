// INBOX-2 — fixtures de test visuel uniquement, jamais chargées par
// l'application réelle. Représentatives des formes réelles retournées par
// messageSerializer.js / InternalMail.toJSON (voir INBOX1_ATTACHMENT_MATRIX.md,
// HOTFIX_INBOX_SECURITY2_*): previewEndpoint/downloadEndpoint/canPreview,
// mimetype/filename réels, tailles réalistes — rien d'inventé au-delà du
// contrat déjà documenté.
const realisticParagraphs = (count) => Array.from({ length: count }, (_, index) => (
  `<p><strong>Point ${index + 1}.</strong> Le suivi du dossier est confirmé avec les informations utiles pour le destinataire.</p>`
)).join('');

export const HEIGHT_FIXTURE_MESSAGES = [
  {
    _id: 'height-short',
    subject: 'IH3 — email court',
    content: 'Fixture de hauteur courte.',
    html: realisticParagraphs(5),
    isRead: true,
    isStarred: false,
    sender: { name: 'Fixture Layout', email: 'fixture@example.test' },
    receiver: { name: 'Moi' },
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    attachments: [],
  },
  {
    _id: 'height-medium',
    subject: 'IH3 — email moyen',
    content: 'Fixture de hauteur moyenne.',
    html: realisticParagraphs(14),
    isRead: true,
    isStarred: false,
    sender: { name: 'Fixture Layout', email: 'fixture@example.test' },
    receiver: { name: 'Moi' },
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    attachments: [],
  },
  {
    _id: 'height-long',
    subject: 'IH3 — email long',
    content: 'Fixture de hauteur longue.',
    html: realisticParagraphs(34),
    isRead: true,
    isStarred: false,
    sender: { name: 'Fixture Layout', email: 'fixture@example.test' },
    receiver: { name: 'Moi' },
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    attachments: [],
  },
];

export const FIXTURE_MESSAGES = [
  {
    _id: 'm1',
    subject: 'Facture Bacongo — juillet 2026',
    content: 'Bonjour, veuillez trouver ci-joint la facture du mois de juillet ainsi que le récapitulatif des paiements. Merci de nous confirmer réception.',
    html: '<p>Bonjour,</p><p>Veuillez trouver ci-joint la <strong>facture</strong> du mois de juillet ainsi que le récapitulatif des paiements.</p><table><tr><td>Loyer</td><td>250 000 FCFA</td></tr><tr><td>Charges</td><td>15 000 FCFA</td></tr></table><p>Merci de nous confirmer réception.</p>',
    isRead: false,
    isStarred: true,
    priority: 'Haute',
    sender: { name: 'Client Externe', email: 'client@example.test' },
    receiver: { name: 'Moi' },
    createdAt: new Date().toISOString(),
    attachments: [
      { filename: 'facture-juillet.pdf', mimetype: 'application/pdf', size: 245000, canPreview: true, previewEndpoint: '/api/internal-mails/m1/attachments/0', downloadEndpoint: '/api/internal-mails/m1/attachments/0?download=1' },
      { filename: 'logo-agence.png', mimetype: 'image/png', size: 18200, canPreview: true, previewEndpoint: '/api/internal-mails/m1/attachments/1', downloadEndpoint: '/api/internal-mails/m1/attachments/1?download=1' },
      { filename: 'releve.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 52000, canPreview: true, previewEndpoint: '/api/internal-mails/m1/attachments/2', downloadEndpoint: '/api/internal-mails/m1/attachments/2?download=1' },
    ],
  },
  {
    _id: 'm2',
    subject: 'Compte-rendu de la réunion hebdomadaire',
    content: 'Voici le compte-rendu de la réunion. Pas de pièce jointe cette fois.',
    isRead: true,
    isStarred: false,
    sender: { name: 'Collègue Interne', email: 'collegue@altitudevision.agency' },
    receiver: { name: 'Moi' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    attachments: [],
  },
  {
    _id: 'm3',
    subject: 'Contrat de bail signé',
    content: 'Le contrat signé est en pièce jointe (archive).',
    isRead: true,
    isStarred: false,
    sender: { name: 'Propriétaire', email: 'proprio@example.test' },
    receiver: { name: 'Moi' },
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    attachments: [
      { filename: 'contrat-signe.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 88000, canPreview: true, previewEndpoint: '/api/internal-mails/m3/attachments/0', downloadEndpoint: '/api/internal-mails/m3/attachments/0?download=1' },
      { filename: 'annexes.zip', mimetype: 'application/zip', size: 1450000, canPreview: true, previewEndpoint: '/api/internal-mails/m3/attachments/1', downloadEndpoint: '/api/internal-mails/m3/attachments/1?download=1' },
    ],
  },
];
