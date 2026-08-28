INBOX-2 : CERTIFIÉ VERT

## 0. Revalidation (mandat "INBOX-2 — PROFESSIONAL INBOX UX / VISUAL VALIDATION")

Un second mandat a redemandé cet audit avec une liste de documents et de questions légèrement différente. Conformément à la règle finale de ce second mandat ("NE PAS RECONSTRUIRE UNE INBOX QUI EST DÉJÀ PROFESSIONNELLE"), ce travail n'a **pas été refait** : le HEAD git était inchangé (`a04055f...`), tous les fichiers du premier passage (`SafeHtmlEmailViewer.jsx`, `AttachmentStrip.jsx`, `attachmentPresentation.js`, harnais Playwright) étaient encore présents. Cette section revalide l'état existant avec des preuves fraîches (nouveau build, nouvelle exécution des tests et de la validation Chromium) plutôt que de le reconstruire.

**Preuves fraîches produites dans cette passe** : `npm run build:next` réexécuté, `attachment-preview-browser.spec.js` (SECURITY-2, Chromium réel) 5/5 ✅, `inbox-visual.spec.js` (Chromium réel) 6/6 ✅ avec captures réinspectées (dark mode toujours lisible), 65/65 tests jsdom ciblés ✅, suite client complète 741/745 ✅ (4 échecs préexistants confirmés pour la **6ᵉ fois consécutive**), lint 0 erreur, `architecture:check` PASS, `git diff --check` propre. Aucune régression détectée depuis le premier passage.

### Réponses aux 30 questions de ce second mandat

1. **Qu'est-ce qui existait déjà ?** Nav rail, liste dense, panneau de lecture, drawer contact, états loading/empty/error, responsive mobile mono-écran, accessibilité de base, sécurité HTML/attachments (SECURITY-2) — voir `INBOX2_AUDIT.md`.
2. **Qu'est-ce qui manquait réellement ?** Seulement deux écarts prouvés par capture d'écran : (a) corps HTML illisible en mode sombre, (b) icône de pièce jointe non différenciée par type.
3. **Inbox déjà professionnalisée avant ce sprint ?** Oui, très largement (sprints `INBOX-PRO-1`/`INBOX-PRO-2`).
4. **`SafeHtmlEmailViewer` intact ?** Oui — seul son CSS interne (`BASE_STYLE`) a reçu un bloc `@media (prefers-color-scheme: dark)` ; sanitize/sandbox non touchés.
5. **DOMPurify intact ?** Oui, strictement inchangé, prouvé par 12/12 tests + 5/5 Chromium.
6. **iframe sandbox intacte ?** Oui — `allow-popups allow-popups-to-escape-sandbox`, sans `allow-scripts`/`allow-same-origin`, inchangé.
7. **Dark mode HTML lisible avant ?** Non — confirmé illisible par capture d'écran réelle avant correctif.
8. **Bug observé ?** Oui, texte du corps d'email quasi invisible en mode sombre (texte sombre codé en dur sur fond auto-assombri par le navigateur).
9. **Correction apportée ?** Fond et texte explicites en mode sombre dans le CSS interne de l'iframe, valeurs alignées sur les tokens `--db-*` du dashboard.
10. **Desktop clair validé ?** Oui, capture Chromium réelle.
11. **Desktop sombre ?** Oui, capture Chromium réelle, avant/après.
12. **Mobile clair ?** Oui, capture Chromium réelle (dossiers, liste, détail).
13. **Mobile sombre ?** Oui, capture Chromium réelle (dossiers).
14. **Pièces jointes mieux différenciées ?** Oui — icône par catégorie (PDF, Office Word/Sheet/Slide, archive, audio, vidéo, texte, image).
15. **Classification sécurité inchangée ?** Oui — `attachmentSecurity.js` non modifié, `attachmentPresentation.js` est un fichier strictement distinct.
16. **HTML/SVG actifs toujours isolés ?** Oui, prouvé par 9/9 (`AttachmentStripSecurity.test.jsx`) + 5/5 Chromium (SECURITY-2).
17. **`ConversationRow` accessible ?** Oui — vrai `<button>`, `aria-current`, `focus-visible`, déjà correct, non modifié.
18. **Loading/empty/error corrects ?** Oui, déjà corrects, non modifiés, revérifiés.
19. **Drawer contact intact ?** Oui, non modifié (mandat §14 : préserver si présent).
20. **Tests sécurité navigateur verts ?** Oui — 5/5 (`attachment-preview-browser.spec.js`), rejoués dans cette passe.
21. **Suite client ?** 741/745, 4 échecs préexistants confirmés sans rapport.
22. **Build ?** Vert (réexécuté dans cette passe).
23. **Lint ?** 0 nouvelle erreur.
24. **Backend modifié ?** Non.
25. **Mobile modifié ?** Non.
26. **Règle métier modifiée ?** Non.
27. **Commit ?** Non.
28. **Push ?** Non.
29. **Deploy ?** Non.
30. **Verdict final ?** **CERTIFIÉ VERT** — confirmé, revalidé avec preuves fraîches, aucune régression, aucune reconstruction effectuée.

## 1. Résumé (premier passage, détails complets ci-dessous)

L'audit préalable a révélé que l'Inbox `InternalMail` avait déjà été substantiellement professionnalisée par deux sprints antérieurs (`INBOX-PRO-1`, `INBOX-PRO-2`) et qu'un système de tokens dark mode systémique existait déjà (`HOTFIX-DASHBOARD-DARK-MODE-UI-1`). Conformément à la philosophie du mandat ("améliorer l'existant avant d'ajouter"), ce sprint s'est concentré sur une validation empirique réelle (captures d'écran Chromium, composant de production réel) plutôt qu'une reconstruction. Cette validation a révélé et corrigé un vrai défaut : le corps HTML de l'email devenait illisible en mode sombre (isolation iframe empêchant les tokens du dashboard de l'atteindre). Un second raffinement présentationnel a été ajouté : une classification par catégorie de fichier pour l'icône des pièces jointes, strictement distincte de la classification sécurité certifiée (SECURITY-2, non modifiée). Aucune reconstruction, aucune nouvelle règle métier, aucun bouton fictif.

## 2. Réponses aux 88 questions du mandat (§80)

1. **Quel composant porte l'Inbox actuelle ?** `client/lib/pages/dashboard/InternalMessagingPage.jsx`.
2. **Quels sous-composants ?** `InboxNavRail`, `MobileFolderList` (inline), `InboxToolbar`, `ConversationRow`, `ConversationViewer` (inline), `SafeHtmlEmailViewer`, `AttachmentStrip`, `SafeAttachmentPreview`, `ContactDrawer`, `ComposeModal` (inline), `ListSkeleton`/`IconButton` (inline) — voir `INBOX2_COMPONENT_INVENTORY.md`.
3. **Quels endpoints ?** `/internal-mails/*` (inchangés, voir `INBOX1_ENDPOINT_MATRIX.md`/`HOTFIX_INBOX_SECURITY1_*`).
4. **Quel modèle ?** `InternalMail` (inchangé).
5. **L'architecture existante a-t-elle été conservée ?** Oui, intégralement.
6. **Nouveau système email créé ?** Non.
7. **Nouveau modèle Mongo ?** Non.
8. **IMAP modifié ?** Non.
9. **SMTP modifié ?** Non.
10. **RBAC modifié ?** Non.
11. **Tenant modifié ?** Non.
12. **Quels problèmes UX existaient ?** Un seul confirmé par preuve : illisibilité du corps HTML en mode sombre. Un raffinement mineur identifié : icône de pièce jointe non différenciée par type.
13. **Lesquels ont été corrigés ?** Les deux ci-dessus.
14. **Liste emails améliorée ?** Non modifiée — déjà professionnelle (audit confirmé, `INBOX2_UX_AUDIT.md`).
15. **Selected state ?** Inchangé, déjà correct.
16. **Unread state ?** Inchangé, déjà correct.
17. **Header message ?** Inchangé, déjà correct.
18. **Metadata ?** Inchangé, déjà correct.
19. **Body HTML ?** **Corrigé** — dark mode interne à l'iframe.
20. **Body plain text ?** Inchangé — déjà couvert par la compatibilité dark mode du dashboard (classes `text-gray-700` du DOM parent).
21. **Attachments ?** **Amélioré** — icône par catégorie, comportement de sécurité/preview/download inchangé.
22. **Loading ?** Inchangé, déjà correct.
23. **Empty ?** Inchangé, déjà correct.
24. **Error ?** Inchangé, déjà correct.
25. **Pagination ?** Non applicable — aucune pagination backend exposée pour ce dossier, rien simulé.
26. **Search ?** Inchangé, déjà correct.
27. **Responsive desktop ?** Vérifié par capture d'écran réelle (1440×900), conforme.
28. **Tablet ?** Non capturé séparément cette session — architecture responsive inchangée, déjà testée par `INBOX_PRO2_RESPONSIVE_MATRIX.md`.
29. **Mobile ?** Vérifié par capture d'écran réelle (390×844), conforme, y compris navigation mono-écran.
30. **Dark mode ?** Vérifié par capture d'écran réelle — shell déjà correct, corps HTML corrigé.
31. **Keyboard ?** Vérifié — `ConversationRow` est un `<button>` natif, Tab/Enter/Space fonctionnent nativement, inchangé.
32. **Focus ?** Vérifié — `focus-visible:ring` déjà présent partout, inchangé.
33. **Contrast ?** Vérifié par capture d'écran, corrigé pour le corps HTML sombre.
34. **HTML reste-t-il DOMPurify ?** Oui, strictement inchangé.
35. **iframe sandbox ?** Oui, strictement inchangé (`allow-popups allow-popups-to-escape-sandbox`).
36. **allow-scripts absent ?** Oui, confirmé par test (`SafeHtmlEmailViewer.test.jsx`).
37. **allow-same-origin absent ?** Oui, confirmé.
38. **SVG toujours protégé ?** Oui — jamais requalifié `IMAGE` par la nouvelle classification présentationnelle, vérifié explicitement.
39. **window.open(blob) actif réintroduit ?** Non.
40. **HTML preview sécurisé ?** Oui, inchangé.
41. **CSS exécuté ?** Non.
42. **JS exécuté ?** Non.
43. **Image preview ?** Inchangée.
44. **PDF ?** Inchangé, icône dédiée ajoutée (présentationnel uniquement).
45. **TXT ?** Inchangé.
46. **CSV ?** Inchangé, icône tableur ajoutée (présentationnel).
47. **JSON ?** Inchangé.
48. **DOCX ?** Inchangé (aucun viewer Office ajouté).
49. **XLSX ?** Inchangé, icône tableur ajoutée (présentationnel).
50. **PPTX ?** Inchangé, icône dédiée ajoutée (présentationnel).
51. **ZIP ?** Inchangé (download uniquement), icône archive ajoutée (présentationnel).
52. **Audio ?** Inchangé, icône dédiée ajoutée (présentationnel), aucun lecteur ajouté.
53. **Video ?** Inchangé, icône dédiée ajoutée (présentationnel), aucun lecteur ajouté.
54. **Unknown fallback ?** Inchangé — nom, taille, téléchargement, jamais d'écran cassé.
55. **CID supporté ?** Non — confirmé toujours absent (`zohoImapService.js` non touché, non audité à nouveau en détail, `INBOX1` fait déjà foi).
56. **Si non, documenté pour suite ?** Oui, candidat `INBOX-3` (non démarré).
57. **Nouveau package ajouté ?** Non.
58. **Était-il nécessaire ?** Non applicable.
59. **Object URLs nettoyées ?** Oui, inchangé (vérifié, aucune nouvelle création de Blob URL par ce sprint).
60. **Gros fichiers gérés prudemment ?** Inchangé — aucun préchargement automatique, comportement déjà existant.
61. **Tests caractérisation ?** Oui — captures d'écran avant/après pour le défaut dark mode.
62. **Tests composants ?** Oui — `attachmentPresentation.test.js` (14 tests, nouveau).
63. **SECURITY-2 rejoué ?** Oui — `SafeHtmlEmailViewer.test.jsx` (12/12), `AttachmentStripSecurity.test.jsx` (9/9), `attachmentSecurity.test.js` (19/19).
64. **Chromium SECURITY-2 rejoué si nécessaire ?** Oui, requis car `SafeHtmlEmailViewer.jsx` modifié — 5/5 verts.
65. **SECURITY-1 ?** Non re-testé — aucune route email touchée par ce sprint (frontend uniquement).
66. **Client complet ?** Oui — 735/739 verts.
67. **Backend si modifié ?** Non modifié — aucun test backend requis.
68. **architecture:check ?** PASS, 0 nouvelle violation (exécuté en gate de non-régression globale, mandat §73).
69. **lint ?** 0 nouvelle erreur.
70. **build ?** `npm run build:next` réussi.
71. **git diff --check ?** Propre.
72. **screenshots desktop light ?** Oui — `desktop-light.png`.
73. **desktop dark ?** Oui — `desktop-dark.png` (avant/après correctif).
74. **mobile light ?** Oui — `mobile-light-folders.png`, `mobile-light-list.png`, `mobile-light-detail.png`.
75. **mobile dark ?** Oui — `mobile-dark-folders.png`.
76. **validation visuelle réelle ?** Oui — Chromium réel, composant de production réel, CSS de production réel, captures inspectées directement.
77. **règle métier ajoutée ?** Non.
78. **règle métier supprimée ?** Non.
79. **frontend modifié ?** Oui — 2 fichiers de production (`SafeHtmlEmailViewer.jsx`, `AttachmentStrip.jsx`), 1 fichier utilitaire créé (`attachmentPresentation.js`).
80. **backend modifié ?** Non.
81. **mobile modifié ?** Non.
82. **production modifiée ?** Non.
83. **commit ?** Non.
84. **push ?** Non.
85. **deploy ?** Non.
86. **Dette restante ?** (a) Le mode sombre EXPLICITE (`.dark`, indépendant de l'OS) n'est pas détectable depuis l'iframe — limite documentée, pas une régression. (b) Résolutions desktop intermédiaires/tablette non capturées séparément cette session. (c) `CID`/inline images toujours absent (candidat `INBOX-3`). (d) Aucun audit WCAG automatisé exécuté (aucun outil disponible sans nouvelle dépendance).
87. **Prochaines améliorations recommandées ?** `INBOX-3` (CID/inline images), `INBOX-4` (Document & Code Preview — Office/CSV/code, si un besoin business concret émerge), `INBOX-5` (Advanced Mail Productivity). Non démarrés, à la discrétion de l'utilisateur, la numérotation finale dépendra de ses priorités réelles (mandat §83).
88. **Verdict ?** Voir §4.

## 3. Fichiers créés/modifiés

**Frontend (2 fichiers de production modifiés, 1 créé)** :
- `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` — ajout d'un bloc `@media (prefers-color-scheme: dark)` dans `BASE_STYLE` (fond/texte/liens explicites), sandbox/DOMPurify intacts.
- `client/lib/components/messaging/AttachmentStrip.jsx` — icône sélectionnée via `getAttachmentCategory` (nouveau), routage sécurité inchangé.
- `client/lib/utils/attachmentPresentation.js` (créé) — classification présentationnelle, distincte de `attachmentSecurity.js`.

**Tests (2 fichiers créés)** :
- `client/lib/__tests__/attachmentPresentation.test.js` — 14 tests.
- `client/e2e/inbox2/` — harnais de validation visuelle réelle (`mountInbox.entry.jsx`, `fixtures.js`, `playwright.inbox2.config.js`, `inbox-visual.spec.js`), jamais chargé par l'application réelle.

**Documentation (10 fichiers créés dans `server/docs/`)** :
`INBOX2_ETAT_INITIAL.md`, `_COMPONENT_INVENTORY.md`, `_UX_AUDIT.md`, `_ATTACHMENT_MATRIX.md`, `_RESPONSIVE_MATRIX.md`, `_ACCESSIBILITY_MATRIX.md`, `_SECURITY_MATRIX.md`, `_BEHAVIOR_CONTRACT.md`, `_VISUAL_VALIDATION.md`, `_REPORT.md` (ce fichier).

## 4. Verdict

**INBOX-2 : CERTIFIÉ VERT.**

Tous les critères du mandat §81 sont remplis : architecture `InternalMail` conservée, aucune nouvelle règle métier, aucune fonctionnalité fictive, Inbox déjà visuellement professionnalisée par les sprints antérieurs et vérifiée par preuve, liste et lecture déjà claires, pièces jointes améliorées (icônes) sans toucher à la sécurité, fallback fichiers inconnus préservé, responsive réel vérifié par capture d'écran, dark mode cohérent (défaut trouvé et corrigé avec preuve avant/après), accessibilité déjà correcte et vérifiée, HTML/SVG sécurisés inchangés (SECURITY-2 rejoué et vert, y compris en Chromium réel), aucune exécution CSS/JS arbitraire, auth email intacte (non touchée), aucune régression fonctionnelle (735/739, 4 échecs préexistants revalidés sur ce HEAD et confirmés sans rapport pour la 3ᵉ fois consécutive à travers trois sprints indépendants), lint 0 erreur, build vert, `git diff --check` vert, **validation visuelle réelle effectuée** (Chromium, composant de production réel, CSS de production réel).

## 5. STOP

Conformément au mandat, ce sprint s'arrête ici. `INBOX-3`/`INBOX-4`/`INBOX-5` restent des candidats indicatifs, **non démarrés**.

**En attente de validation de l'utilisateur avant tout commit.**
