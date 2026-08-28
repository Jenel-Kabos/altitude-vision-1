# INBOX-2 — MATRICE DE TESTS (mandat §16/§17/§18)

## Tests rejoués (revalidation, aucune modification de code dans cette passe)

| Suite | Rôle | Résultat |
|---|---|---|
| `SafeHtmlEmailViewer.test.jsx` | Sanitization DOMPurify, sandbox, fallback texte | 12/12 ✅ |
| `AttachmentStripSecurity.test.jsx` | Routage sécurité HTML/SVG actifs vs types sûrs | 9/9 ✅ |
| `attachmentSecurity.test.js` | Classification sécurité fail-closed (extension/MIME) | 19/19 ✅ |
| `attachmentPresentation.test.js` | Classification présentationnelle (icône), distincte de la sécurité | 14/14 ✅ |
| `InternalMessagingPageUX.test.jsx` | Conteneur, sélection, états, responsive mobile | 13/13 ✅ |
| `attachment-preview-browser.spec.js` (Chromium réel, SECURITY-2) | Script hostile bloqué, localStorage parent inaccessible, `window.top` non navigable, popup bloquée, sandbox intact | 5/5 ✅ |
| `inbox-visual.spec.js` (Chromium réel, INBOX-2) | Validation visuelle desktop/mobile, clair/sombre, composant de production réel + CSS de production réel | 6/6 ✅ |

**Total tests ciblés pertinents : 78/78 verts**, aucun nouveau test requis dans cette passe (aucune correction de code apportée — revalidation pure de l'état déjà certifié précédemment).

## Suite client complète

| Métrique | Résultat |
|---|---|
| Fichiers de test | 101 passés / 2 échoués (103 total) |
| Tests | 741 passés / 4 échoués (745 total) |
| Échecs | `ManageHotelsPage.test.jsx` (1), `ManageAccommodationsPage.test.jsx` (3) — **préexistants, sans rapport avec l'Inbox, confirmés pour la 6ᵉ fois consécutive à travers six sprints indépendants de cette session** (aucun fichier de ces pages n'a jamais été touché) |

## Gates complémentaires

| Gate | Résultat |
|---|---|
| `npm run lint` (fichiers Inbox concernés) | 0 erreur, 0 warning |
| `npm run build:next` | Réussi (nouveau build effectué dans cette passe pour revalider le CSS compilé) |
| `npm run architecture:check` | PASS, 0 nouvelle violation (backend non modifié) |
| `git diff --check` | Propre |

## Backend

Non modifié — aucun test backend requis pour ce sprint (frontend only, mandat §22).
