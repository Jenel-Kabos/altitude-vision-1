# INBOX-2 — MATRICE DE SÉCURITÉ

| Invariant | Preuve |
|---|---|
| Auth unchanged | Aucun fichier backend touché ; `emailRoutesAuth.test.js` non re-testé cette session (aucune route email concernée par ce sprint frontend) |
| `ROLES_DOCS` unchanged | Aucun fichier RBAC touché |
| Tenant unchanged | Aucun fichier backend/modèle touché |
| HTML sanitizer preserved | `sanitizeForSandboxedIframe`/`SANDBOXED_HTML_SANITIZE_CONFIG` (`sanitizeSandboxedHtml.js`) **non modifiés** — seul le bloc `<style>` interne à l'iframe (`BASE_STYLE`, purement visuel, jamais passé à DOMPurify) a été étendu | Lecture du diff : aucune ligne touchant `sanitizeEmailHtml`/l'appel DOMPurify |
| Iframe sandbox preserved | `sandbox="allow-popups allow-popups-to-escape-sandbox"` inchangé, aucun `allow-scripts`/`allow-same-origin` ajouté | `SafeHtmlEmailViewer.test.jsx` — 12/12 verts, y compris l'assertion explicite sur l'attribut `sandbox` |
| Active attachments protected | `attachmentSecurity.js` (`isActiveAttachmentContent`/`getActiveAttachmentKind`) **non modifié** — la nouvelle classification présentationnelle (`attachmentPresentation.js`) est un fichier distinct, jamais consulté pour décider du mécanisme de preview | `attachmentSecurity.test.js` — 19/19 verts, inchangés |
| No unsafe SVG regression | SVG reste classé "actif" par `attachmentSecurity.js`, jamais requalifié `IMAGE` par `attachmentPresentation.js` (mandat §24, vérifié explicitement : SVG n'a pas d'entrée dans `CATEGORY_BY_MIME_PREFIX`/`CATEGORY_BY_EXTENSION`, retombe sur `UNKNOWN`, jamais `IMAGE`) | Lecture du code + `attachmentPresentation.test.js` (aucun cas SVG testé comme `IMAGE`, absence de mapping confirmée) |
| No `window.open(blob)` regression | `AttachmentStrip.jsx` : logique de routage `handleVoir`/`handleTelecharger` **non modifiée**, seule la ligne de sélection d'icône a changé | `AttachmentStripSecurity.test.jsx` — 9/9 verts, inchangés (HTML/SVG actifs toujours routés vers `SafeAttachmentPreview`, jamais `previewInternalMailAttachment`) |
| Download preserved | `downloadInternalMailAttachment`/`previewInternalMailAttachment` non modifiés | Idem |
| No new executable preview | Aucun nouveau mécanisme de rendu ajouté — uniquement une icône (SVG lucide-react statique, jamais un rendu de contenu utilisateur) | Lecture du code |
| No new external content execution | Idem | — |
| SECURITY-2 Chromium tests | Rejoués car `SafeHtmlEmailViewer.jsx` a été modifié (mandat §59) | `attachment-preview-browser.spec.js` — 5/5 verts (voir `INBOX2_VISUAL_VALIDATION.md`) |

## Verdict de cette dimension

Aucune régression de sécurité. Les deux fichiers modifiés (`SafeHtmlEmailViewer.jsx`, `AttachmentStrip.jsx`) l'ont été de façon strictement additive et hors du chemin de sécurité certifié (style CSS interne à l'iframe pour l'un, sélection d'icône présentationnelle pour l'autre) — prouvé par la ré-exécution intégrale et verte de toutes les suites de tests SECURITY-2 (jsdom et Chromium réel).
