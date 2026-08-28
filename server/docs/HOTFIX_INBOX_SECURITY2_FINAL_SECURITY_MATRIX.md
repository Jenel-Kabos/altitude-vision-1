# HOTFIX-INBOX-SECURITY-2 — MATRICE DE SÉCURITÉ FINALE

| Dimension | Preuve | Verdict |
|---|---|---|
| XSS (script/handler dans HTML attachment) | Chromium réel (test 1) + jsdom (`AttachmentStripSecurity.test.jsx`) | ✅ Fermé |
| XSS (script/onload dans SVG attachment) | Chromium réel (test 2) + jsdom | ✅ Fermé |
| Exécution same-origin via Blob URL | Chromium réel (tests 4-5) — reproduction historique confirmée, correctif confirmé sûr | ✅ Fermé |
| Vol de session via `localStorage` | Chromium réel (test 1) — valeur factice inchangée | ✅ Fermé |
| Accès au DOM parent (`parent.document`/`top.document`) | Chromium réel (tests 1-3) — bloqué par sandbox sans `allow-same-origin` | ✅ Fermé |
| Navigation `window.top` | Chromium réel (test 3, contrôle négatif sandbox seul) | ✅ Fermé |
| Popup incontrôlée | Chromium réel (test 3) | ✅ Fermé |
| MIME spoofing (les deux sens) | `attachmentSecurity.test.js` (19 tests) | ✅ Fermé, fail-closed |
| Extension spoofing / double extension / casing | Idem | ✅ Fermé, fail-closed |
| Évasion par suffixe query/fragment sur le nom de fichier | **Découvert et fermé pendant cette certification** — micro-correction caractérisée (rouge → vert) | ✅ Fermé |
| Téléchargement (types actifs) | Chromium réel (test 5) — `<a download>`, aucune exécution | ✅ Sûr |
| Téléchargement/preview (types non actifs) | `AttachmentStripSecurity.test.jsx` (`imageAttachment`, `pdfAttachment`) | ✅ Régression : aucune |
| Régression image/PDF/texte/office/inconnu | `_FILE_MATRIX.md` | ✅ Aucune régression |
| Authentification SECURITY-1 (14 routes `emailRoutes.js`) | `emailRoutesAuth.test.js` rejoué, 15/15 verts | ✅ Préservée |
| `ROLES_DOCS`/RBAC | Aucun fichier RBAC/auth touché par SECURITY-2 ni par cette certification | ✅ Inchangé |
| Tenant / Ownership | Non applicable à `InternalMail` (rappel, non modifié) | ✅ Inchangé |
| Backend / IMAP / SMTP | Aucun fichier backend touché (certification frontend uniquement) | ✅ Inchangé |
| Mobile | `altimmo-app/` non touché | ✅ Inchangé |
| Règle métier | Aucune ajoutée/modifiée | ✅ Inchangé |
| Suite client complète | 721/725 verts — 4 échecs préexistants confirmés sans rapport (`ManageHotelsPage.test.jsx`, `ManageAccommodationsPage.test.jsx`, même signature que la certification précédente) | ✅ Aucune régression imputable |
| Lint | 0 nouvelle erreur (fichiers touchés cette session) | ✅ Vert |
| Build production | `npm run build:next` réussi | ✅ Vert |
| `git diff --check` | Propre sur tous les fichiers de cette certification | ✅ Vert |

## Risque résiduel connu, hors périmètre (rappel)

- `conversationService.js::openConversationAttachment` (chat, système distinct) — voir `_BYPASS_AUDIT.md`, recommandation de hotfix dédié.
- Ressources externes (tracking, `<img>` distantes) dans le corps HTML de l'email et dans un SVG sanitizé — non aggravé, non traité, déjà documenté par `INBOX-1`.
