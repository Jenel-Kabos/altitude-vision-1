# INBOX-2 — CONTRAT COMPORTEMENTAL

## Changement 1 — `SafeHtmlEmailViewer.jsx` : dark mode interne à l'iframe

| | Before | After |
|---|---|---|
| Mode clair | Texte `#1f2937` sur fond `#ffffff` (implicite avant, désormais explicite) | Identique, `#ffffff` désormais explicite (aucun changement visuel) |
| Mode sombre (`prefers-color-scheme: dark`) | Texte `#1f2937` (sombre) sur fond auto-assombri par Chromium (comportement UA implicite, non maîtrisé) — **quasiment illisible**, confirmé par capture d'écran | Texte `#f1f5f9` sur fond `#111827` (explicite) — lisible, cohérent avec les tokens `--db-text`/`--db-surface-solid` du reste du dashboard |
| Liens | `#2563eb` (identique aux deux modes avant) | `#2563eb` en clair, `#60a5fa` en sombre (meilleur contraste sur fond sombre) |
| Sandbox/DOMPurify | `allow-popups allow-popups-to-escape-sandbox`, sans `allow-scripts`/`allow-same-origin` | **Strictement inchangé** |
| Limite connue | Le mode sombre EXPLICITE (`.dark` sur `dashboard-shell`, indépendant de l'OS) ne peut pas être détecté depuis l'intérieur de l'iframe (isolation cross-document délibérée, non contournée) — seul `prefers-color-scheme` (préférence OS) est couvert | Documenté, non résolu dans ce sprint (résoudrait nécessiterait de faire calculer par React le thème effectif et de l'injecter dans le `srcDoc` à chaque rendu — changement plus large, hors périmètre "amélioration minimale" de ce tour) |

## Changement 2 — `AttachmentStrip.jsx` : icône par catégorie

| | Before | After |
|---|---|---|
| Image (`image/*`) | `ImageIcon` | `ImageIcon` (inchangé) |
| Tout le reste | `FileText` (une seule icône générique) | Icône dédiée par catégorie (PDF, Office Word/Sheet/Slide, archive, audio, vidéo, texte) — `FileText` reste le repli pour HTML/SVG/JSON/inconnu |
| Logique de sécurité (`isActiveAttachmentContent`/`getActiveAttachmentKind`) | Inchangée | **Strictement inchangée** — aucun appel supprimé/modifié, `attachmentPresentation.js` est consulté uniquement pour choisir l'icône, jamais pour le routage preview/download |
| Comportement Voir/Télécharger | Inchangé | **Strictement inchangé** — aucune ligne de `handleVoir`/`handleTelecharger` modifiée |

## Non-régression prouvée

- `SafeHtmlEmailViewer.test.jsx` : 12/12 verts (comportement clair, script/handlers/liens/table/style — tous identiques).
- `AttachmentStripSecurity.test.jsx` : 9/9 verts (routage sécurité inchangé pour HTML/SVG/mismatch/image/PDF).
- `attachmentSecurity.test.js` : 19/19 verts (classification sécurité inchangée).
- `attachmentPresentation.test.js` (nouveau) : 14/14 verts.
- `InternalMessagingPageUX.test.jsx` : 13/13 verts (aucune régression de la page conteneur).
- SECURITY-2 Chromium (`attachment-preview-browser.spec.js`) : 5/5 verts.
