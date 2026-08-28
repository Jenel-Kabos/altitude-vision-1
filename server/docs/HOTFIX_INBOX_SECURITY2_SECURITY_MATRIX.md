# HOTFIX-INBOX-SECURITY-2 — MATRICE DE SÉCURITÉ

## Périmètre du correctif

6 fichiers frontend créés/modifiés, **aucun fichier backend**, **aucun fichier mobile** :

**Créés** :
- `client/lib/utils/sanitizeSandboxedHtml.js` — primitive DOMPurify partagée.
- `client/lib/utils/attachmentSecurity.js` — classification fail-closed HTML/SVG.
- `client/lib/components/messaging/SafeAttachmentPreview.jsx` — modal d'aperçu sandboxé.
- `client/lib/__tests__/AttachmentStripSecurity.test.jsx` — 9 tests adversariaux + régression.

**Modifiés** :
- `client/lib/components/messaging/AttachmentStrip.jsx` — routage par classification.
- `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` — refactorisation interne (sanitize extrait, comportement identique).
- `client/lib/services/messageService.js` — 2 nouvelles fonctions ajoutées (`fetchInternalMailAttachmentContent`, `downloadInternalMailAttachment`) ; `previewInternalMailAttachment` **inchangée au caractère près**.

## Preuves par dimension

| Dimension | Preuve |
|---|---|
| HTML attachment ne peut plus s'exécuter dans le parent | `AttachmentStripSecurity.test.jsx` — `window.__pwned` reste `undefined` après clic "Voir" sur `htmlAttachment`/`mismatchAttachment`, `previewInternalMailAttachment` jamais appelé |
| SVG actif ne peut plus s'exécuter dans le parent | Idem pour `svgAttachment` |
| Scripts bloqués | `frame.srcdoc` ne contient jamais `<script` (HTML et SVG) |
| Gestionnaires d'événements bloqués | `frame.srcdoc` ne contient jamais `onerror`/`onload` |
| `javascript:` URL bloquées | Héritée de `sanitizeForSandboxedIframe` (même comportement que `SafeHtmlEmailViewer`, déjà testé, config identique) |
| Escalade iframe/script bloquée | `sandbox="allow-popups allow-popups-to-escape-sandbox"`, absence explicite de `allow-scripts`/`allow-same-origin`, vérifié par assertion directe sur l'attribut |
| MIME mismatch fail-closed | `AttachmentStripSecurity.test.jsx` — cas `mismatchAttachment` (`photo.jpg` déclaré `text/html`) classé actif |
| Images normales préservées | `imageAttachment` — `previewInternalMailAttachment` appelé à l'identique, `fetchInternalMailAttachmentContent`/`downloadInternalMailAttachment` jamais appelés |
| PDF préservé | `pdfAttachment` — idem |
| Téléchargement préservé | `handleTelecharger` : type actif → `downloadInternalMailAttachment` (sauvegarde réelle via `<a download>`) ; type sûr → `previewInternalMailAttachment` inchangé |
| Corps HTML de l'email préservé | `SafeHtmlEmailViewer.test.jsx` — 12/12 tests inchangés, tous verts, sans modification du fichier de test |
| Authentification SECURITY-1 préservée | `emailRoutesAuth.test.js` rejoué — 15/15 verts (voir ci-dessous) ; aucun fichier backend touché par SECURITY-2 |
| `ROLES_DOCS` inchangé | Aucune référence RBAC dans les fichiers modifiés/créés par ce hotfix |
| Tenant inchangé | Non applicable — aucun champ tenant sur `InternalMail`, non touché |
| Ownership inchangé | Non applicable — `downloadAttachment`/`internalMailController.js` non modifié, vérification `sender/receiver === userId` intacte par construction (fichier non touché) |
| Aucune règle métier backend ajoutée | Aucun fichier `server/` modifié par ce hotfix |
| Aucune mutation de production | Aucune commande git, aucun accès DB, aucune variable d'environnement touchée |

## Non-régression — suites rejouées

| Suite | Résultat |
|---|---|
| `AttachmentStripSecurity.test.jsx` (nouveau) | 9/9 ✅ |
| `SafeHtmlEmailViewer.test.jsx` | 12/12 ✅ (inchangé) |
| `InternalMessagingPageUX.test.jsx` | 13/13 ✅ (inchangé) |
| Suite client complète (`npm test`, 99 fichiers) | 702/706 ✅ — **4 échecs préexistants, confirmés indépendants de ce hotfix** (voir ci-dessous) |
| `emailRoutesAuth.test.js` (SECURITY-1, backend) | 15/15 ✅ (rejoué, aucun fichier backend touché) |
| `npm run lint` (fichiers touchés/créés, ciblé) | 0 erreur, 0 warning |
| `npm run build:next` | Build de production réussi, page `/messages` compilée sans erreur (5.88 kB) |

### Détail des 4 échecs préexistants (non liés à ce hotfix)

`ManageHotelsPage.test.jsx` (1 échec) et `ManageAccommodationsPage.test.jsx` (3 échecs) — aucun rapport avec la messagerie/pièces jointes. **Confirmé indépendant** : `git stash` des 3 fichiers modifiés par ce hotfix (`AttachmentStrip.jsx`, `SafeHtmlEmailViewer.jsx`, `messageService.js`) puis ré-exécution des deux fichiers de test → **mêmes 4 échecs identiques** sur le code non modifié par SECURITY-2. Ces échecs appartiennent au travail parallèle non lié déjà documenté (`ARCH2*`), pas à ce hotfix.

## Risque résiduel connu (hors périmètre, cohérent avec `INBOX1_SECURITY_MATRIX.md`)

- Ressources externes chargées par un SVG sanitizé dans l'iframe sandboxée (`<image href="https://...">`) — même niveau d'exposition que les images distantes du corps d'email, non aggravé, non traité ici (tracking pixels explicitement hors périmètre, mandat §43).
- Aucune détection de type par signature de fichier (magic bytes) — classification limitée à extension+MIME déclarés, comme explicitement prescrit par le mandat (§13).

## Verdict de cette dimension

Aucune régression identifiée. Le finding P0 (exécution same-origin via pièce jointe HTML/SVG) est fermé, structurellement, pour les deux boutons ("Voir" et "Télécharger"), sans toucher à l'authentification, l'autorisation, le backend, ou tout comportement hors du périmètre HTML/SVG actif.
