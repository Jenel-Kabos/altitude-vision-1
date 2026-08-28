// __tests__/messageAttachmentMimeFilter.test.js
// HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — caractérise directement le
// comportement RÉEL du multer `upload` (server/config/cloudinary.js) monté
// par messageRoutes.js (`uploadAttachments = upload.array('attachments', 5)`,
// seul point de création d'un attachment Message/Conversation).
//
// Ce test prouve que le fileFilter existant (non modifié par ce hotfix,
// non lié à SECURITY-2) rejette déjà, avant tout stockage, les MIME actifs
// (text/html, application/xhtml+xml, image/svg+xml) — la classe de finding
// découverte pendant HOTFIX-INBOX-SECURITY-2 pour InternalMail ne peut donc
// pas se reproduire par ce chemin d'upload, à la différence d'InternalMail
// (ingestion IMAP, aucun filtre de MIME possible sur un expéditeur externe).
//
// AUCUN mock de Message/Conversation/Socket.IO — on teste directement le
// vrai objet `upload` importé de la config réelle, monté sur une app
// Express jetable, sans passer par sendMessage (business logic non
// pertinente pour cette caractérisation).

const express = require('express');
const request = require('supertest');
const { upload } = require('../config/cloudinary');

const buildTestApp = () => {
  const app = express();
  app.post('/upload-test', upload.array('attachments', 5), (req, res) => {
    res.status(200).json({ files: (req.files || []).map((f) => f.mimetype) });
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(400).json({ message: err.message });
  });
  return app;
};

describe('messageRoutes upload fileFilter — MIME actifs (HTML/SVG) rejetés avant tout stockage', () => {
  const app = buildTestApp();

  test.each([
    ['text/html', 'evil.html'],
    ['application/xhtml+xml', 'evil.xhtml'],
    ['image/svg+xml', 'evil.svg'],
  ])('un fichier déclaré %s est rejeté (400), jamais transmis au contrôleur', async (mimetype, filename) => {
    const res = await request(app)
      .post('/upload-test')
      .attach('attachments', Buffer.from('<script>alert(1)</script>'), { filename, contentType: mimetype });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Format non supporté/);
  });

  test.each([
    ['image/png', 'photo.png'],
    ['image/jpeg', 'photo.jpg'],
    ['image/webp', 'photo.webp'],
    ['application/pdf', 'doc.pdf'],
    ['video/mp4', 'clip.mp4'],
    ['audio/mpeg', 'note.mp3'],
  ])('un fichier légitime déclaré %s est accepté (non-régression)', async (mimetype, filename) => {
    const res = await request(app)
      .post('/upload-test')
      .attach('attachments', Buffer.from('contenu binaire factice'), { filename, contentType: mimetype });
    expect(res.statusCode).toBe(200);
    expect(res.body.files).toEqual([mimetype]);
  });

  test('un fichier renommé en .png mais déclaré image/png passe le filtre (mimetype déclaré, jamais le contenu réel) — documenté, pas un bypass HTML', async () => {
    // Preuve du raisonnement de _THREAT_MODEL.md : le fileFilter ne vérifie
    // jamais les octets réels, seulement le Content-Type déclaré par le
    // client. Ici, le contenu est du HTML mais le mimetype déclaré est
    // "image/png" (allowlisté) → accepté. Ce n'est PAS un bypass d'exécution
    // : le Content-Type SERVI en aval (downloadAttachment) sera celui
    // stocké ("image/png"), donc un navigateur ouvrant ce Blob tentera de le
    // rendre comme une image (échec silencieux), jamais comme un document
    // HTML exécutable — voir _THREAT_MODEL.md pour l'analyse complète.
    const res = await request(app)
      .post('/upload-test')
      .attach('attachments', Buffer.from('<script>alert(1)</script>'), { filename: 'evil-renamed.png', contentType: 'image/png' });
    expect(res.statusCode).toBe(200);
    expect(res.body.files).toEqual(['image/png']);
  });
});
