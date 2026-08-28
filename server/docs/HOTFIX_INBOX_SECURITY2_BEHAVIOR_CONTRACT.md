# HOTFIX-INBOX-SECURITY-2 — CONTRAT COMPORTEMENTAL

Preuve produite par `client/lib/__tests__/AttachmentStripSecurity.test.jsx` (9 tests, tous verts) + non-régression `SafeHtmlEmailViewer.test.jsx` (12 tests inchangés, tous verts) + `InternalMessagingPageUX.test.jsx` (13 tests inchangés, tous verts).

| Type de fichier | Before | After | Différence de sécurité | UX préservée |
|---|---|---|---|---|
| HTML (`.html`/`.htm` ou MIME `text/html`) | "Voir"/"Télécharger" → `previewInternalMailAttachment` → `window.open(blob)` → **exécution directe, même origine que le dashboard** | "Voir" → contenu sanitizé (DOMPurify) rendu dans une iframe sandboxée isolée (`SafeAttachmentPreview`, sandbox sans `allow-scripts`/`allow-same-origin`) ; "Télécharger" → `<a download>` forcé, jamais de rendu | **Exécution same-origin fermée** — script/handlers/iframe/form/`javascript:` neutralisés, prouvé par test (`window.__pwned` reste `undefined`) | Oui — la pièce jointe reste consultable (aperçu visuel du contenu sanitizé) et téléchargeable ; message clair en cas d'échec de récupération |
| SVG (`.svg`/`.svgz` ou MIME `image/svg+xml`) | Idem HTML — `window.open(blob)` sans passage par DOMPurify | Sanitizé (profil DOMPurify SVG, `script`/`foreignObject`/gestionnaires retirés) et rendu dans la même iframe sandboxée isolée ; téléchargement forcé | **Exécution same-origin fermée**, prouvé par test | Oui — même contrat que HTML |
| Extension/MIME divergents (ex. `photo.jpg` déclaré `text/html`) | `window.open(blob)`, suit le MIME réel stocké | Classé actif par la classification fail-closed (extension OU MIME) → même traitement que HTML | **Fermé** (aucune fenêtre où un fichier réellement actif serait traité comme une image sûre) | Oui |
| Image classique (JPEG/PNG/GIF/WebP) | `previewInternalMailAttachment` (raw blob + `window.open`) | **Strictement inchangé** — même fonction, mêmes endpoints, prouvé par test (`imageAttachment`) | Aucun changement (déjà faible risque, confirmé `INBOX1_ATTACHMENT_MATRIX.md`) | Oui, 100% identique |
| PDF | `previewInternalMailAttachment` | **Strictement inchangé**, prouvé par test (`pdfAttachment`) | Aucun changement | Oui, 100% identique |
| Autres types (txt/csv/json/xml/css/js/office/archives) | `previewInternalMailAttachment` | **Inchangé** — non classés actifs (aucune preuve qu'ils soient rendus comme HTML par le mécanisme actuel) | Aucun changement | Oui, 100% identique |
| Corps HTML de l'email (`SafeHtmlEmailViewer`) | DOMPurify + iframe sandbox | **Strictement inchangé** — refactorisation interne uniquement (sanitize extrait vers `sanitizeSandboxedHtml.js`, même config, même sortie), 12/12 tests existants toujours verts sans modification | Aucun changement de comportement observable | Oui, 100% identique |

## Nouveaux éléments UX minimaux (mandat §37/§38)

- Message "Chargement de l'aperçu sécurisé…" pendant la récupération du contenu actif.
- Message "Aperçu indisponible pour ce fichier. Vous pouvez le télécharger." en cas d'échec réseau — jamais de crash, le bouton téléchargement reste proposé.
- Modal accessible : `role="dialog"` + `aria-modal`, `aria-label` explicite, focus posé sur le bouton de fermeture à l'ouverture, fermeture au clavier (Échap), bouton fermer et bouton télécharger toujours présents et libellés (`aria-label`).

## Ce qui n'a pas changé (rappel)

Aucune règle métier, aucun rôle, aucune capability, aucun scoping tenant/ownership, aucune route backend, aucun endpoint, `InternalMail`/IMAP/SMTP non touchés, `ROLES_DOCS`/`protect` (SECURITY-1) non touchés — voir `HOTFIX_INBOX_SECURITY2_SECURITY_MATRIX.md`.
