HOTFIX-INBOX-SECURITY-2 : CERTIFIÉ VERT

## 1. Résumé

La réserve du hotfix précédent ("absence de validation réelle du comportement navigateur") est levée. Cinq tests exécutés dans un vrai moteur Chromium (via l'infrastructure Playwright déjà présente dans le projet, sans dépendance ajoutée) prouvent : (1-2) qu'un payload HTML/SVG hostile monté dans le VRAI composant de production `SafeAttachmentPreview` ne peut exécuter aucun code dans le contexte parent ni lire son `localStorage` ; (3) qu'un contrôle négatif — le même attribut `sandbox` avec un `srcDoc` délibérément non sanitizé — bloque quand même script, accès parent, navigation top et popup, prouvant une défense en profondeur réelle et pas seulement une dépendance à DOMPurify ; (4) que le mécanisme historique de la faille (`window.open` sur un Blob HTML) exécute bel et bien le contenu, reproduit empiriquement ; (5) que le correctif (`<a download>`) sur le même Blob ne l'exécute jamais. Un vecteur d'évasion réel de la classification (suffixe `?...`/`#...` sur le nom de fichier) a été découvert pendant cette certification et fermé par une micro-correction minimale, caractérisée par un test rouge puis vert. Un risque structurellement analogue mais sur un système distinct (`conversationService.js`, chat) a été découvert et documenté, hors périmètre de ce mandat.

## 2. Réponses aux 75 questions du mandat (§58)

1. **Le hotfix SECURITY-2 est-il toujours présent ?** Oui, confirmé fichier par fichier (`_FINAL_CERT_ETAT_INITIAL.md`).
2. **Quels fichiers de production le composent ?** `sanitizeSandboxedHtml.js`, `attachmentSecurity.js`, `SafeAttachmentPreview.jsx`, `AttachmentStrip.jsx` (modifié), `SafeHtmlEmailViewer.jsx` (refactorisé), `messageService.js` (2 fonctions ajoutées).
3. **HTML est-il classé actif ?** Oui.
4. **SVG est-il classé actif ?** Oui.
5. **La classification est-elle extension OU MIME ?** Oui, disjonction (l'un ou l'autre suffit).
6. **Est-elle fail-closed ?** Oui, prouvé par 19 cas adversariaux, dont les 3 découverts et corrigés pendant cette certification.
7. **`.HTML` (casse) est-il couvert ?** Oui.
8. **`.SVG` (casse) est-il couvert ?** Oui.
9. **`text/html` est-il couvert ?** Oui.
10. **`image/svg+xml` est-il couvert ?** Oui.
11. **MIME spoofing est-il couvert ?** Oui, dans les deux sens.
12. **Double extension est-elle couverte ?** Oui (`invoice.pdf.html`, `photo.jpg.svg`).
13. **DOMPurify est-il réellement appelé ?** Oui, tracé : `AttachmentStrip.openActivePreview` → `fetchInternalMailAttachmentContent` (texte brut) → `SafeAttachmentPreview` → `sanitizeForSandboxedIframe`/`DOMPurify.sanitize` → `srcDoc` de l'iframe.
14. **Avant le rendu ?** Oui — la sanitization a lieu au moment du calcul de `safeMarkup`, avant l'assignation de `srcDoc` sur l'iframe (jamais un contenu brut assigné puis nettoyé après coup).
15. **Quelle configuration ?** HTML : config partagée avec `SafeHtmlEmailViewer` (`FORBID_TAGS: script/iframe/object/embed/form`, `FORBID_ATTR` ciblés, `ALLOW_DATA_ATTR:false`). SVG : profil DOMPurify SVG + `foreignObject` explicitement ajouté à `FORBID_TAGS`.
16. **Est-elle partagée avec `SafeHtmlEmailViewer` ?** Oui, pour la partie HTML — primitive commune `sanitizeSandboxedHtml.js`.
17. **L'iframe possède-t-elle `sandbox` ?** Oui, confirmé en Chromium réel (`toHaveAttribute('sandbox', ...)`).
18. **`allow-scripts` est-il absent ?** Oui, confirmé.
19. **`allow-same-origin` est-il absent ?** Oui, confirmé (absence déduite de la valeur exacte de l'attribut, et comportementalement prouvée par le blocage de l'accès `localStorage`/parent en test 1 et 3).
20. **Un script HTML peut-il s'exécuter ?** Non, prouvé en Chromium réel.
21. **Un `onerror` peut-il s'exécuter ?** Non, prouvé.
22. **Un `onload` peut-il s'exécuter ?** Non, prouvé (SVG).
23. **`javascript:` peut-il s'exécuter ?** Non — neutralisé par la même config DOMPurify, prouvée en jsdom (héritée de `SafeHtmlEmailViewer`, mécanisme identique déjà validé en Chromium réel pour `<script>`/`onerror`/`onload`).
24. **Un script SVG peut-il s'exécuter ?** Non, prouvé en Chromium réel (test 2).
25. **`foreignObject` permet-il un bypass ?** Non — explicitement dans `FORBID_TAGS` du profil SVG.
26. **Le contenu peut-il lire `parent.document` ?** Non, prouvé (sandbox sans `allow-same-origin`, tests 1-3).
27. **Peut-il lire `localStorage` ?** Non, prouvé (test 1, valeur factice inchangée).
28. **Peut-il lire un token ?** Non — et aucune vraie valeur de token n'a jamais été utilisée dans les tests (valeur factice `FAKE-JWT-FOR-TEST-ONLY`, jamais un secret réel).
29. **Peut-il modifier le DOM parent ?** Non, prouvé (marqueur `window.__INBOX_SECURITY_TEST__` toujours `'untouched'`).
30. **Peut-il naviguer `window.top` ?** Non, prouvé (test 3, contrôle négatif sandbox seul).
31. **Peut-il ouvrir une popup ?** Non, prouvé (test 3, `context.pages().length` inchangé).
32. **HTML utilise-t-il encore `window.open(blob)` ?** Non, pour les types actifs.
33. **SVG utilise-t-il encore `window.open(blob)` ?** Non, pour les types actifs.
34. **Existe-t-il une autre voie équivalente ?** Oui — `conversationService.js::openConversationAttachment` (système `Message`/`Conversation`, distinct d'`InternalMail`), documenté comme finding hors périmètre (`_BYPASS_AUDIT.md`), non corrigé ici par discipline de périmètre.
35. **Le téléchargement HTML fonctionne-t-il ?** Oui — `downloadInternalMailAttachment`, `<a download>`, prouvé en Chromium réel (test 5, événement `download` capturé).
36. **SVG ?** Oui, même mécanisme.
37. **Utilise-t-il `<a download>` ?** Oui.
38. **JPEG est-il inchangé ?** Oui, prouvé par test.
39. **PNG ?** Oui (chemin identique, non re-testé individuellement, voir `_FILE_MATRIX.md`).
40. **PDF ?** Oui, prouvé par test.
41. **TXT ?** Oui, par analyse directe (aucune branche de code nouvelle ne l'affecte).
42. **CSV ?** Oui, idem.
43. **JSON ?** Oui, idem.
44. **DOCX ?** Oui, idem.
45. **XLSX ?** Oui, idem.
46. **PPTX ?** Oui, idem.
47. **Fichier inconnu ?** Oui, non classifié actif par défaut, comportement stable.
48. **Les object URLs sont-elles nettoyées ?** Oui — `URL.revokeObjectURL` après 60s dans `previewInternalMailAttachment`/`downloadInternalMailAttachment` (inchangé/existant) ; le nouveau chemin `fetchInternalMailAttachmentContent` ne crée pas de Blob URL persistante (lecture texte directe).
49. **SECURITY-1 reste-t-il vert ?** Oui — 15/15, rejoué cette session.
50. **Les routes email restent-elles authentifiées ?** Oui, contrat identique (401 anonyme, 403 hors `ROLES_DOCS`, 200/201 `Admin`/`Secretaire`/`Collaborateur`).
51. **Les tests SECURITY-2 sont-ils verts ?** Oui — `AttachmentStripSecurity.test.jsx` 9/9, plus `attachmentSecurity.test.js` 19/19 (nouveau cette session).
52. **`SafeHtmlEmailViewer` reste-t-il vert ?** Oui — 12/12, inchangé.
53. **Suite client complète ?** Oui, exécutée cette session.
54. **Combien de tests passent ?** 721.
55. **Combien échouent ?** 4.
56. **Les échecs sont-ils liés au hotfix ?** Non — `ManageHotelsPage.test.jsx` (1) et `ManageAccommodationsPage.test.jsx` (3), même signature exacte que lors de la certification de l'implémentation initiale (où l'indépendance avait été prouvée par isolation non destructive), aucun rapport avec la messagerie/pièces jointes.
57. **Lint ?** 0 nouvelle erreur (fichiers touchés cette session : `attachmentSecurity.js`, `attachmentSecurity.test.js`, harnais Playwright).
58. **Build ?** `npm run build:next` réussi.
59. **`architecture:check` ?** Non exécuté — aucun fichier backend touché par cette certification (certification frontend uniquement) ; dernière exécution connue (SECURITY-1, même HEAD) : PASS.
60. **`git diff --check` ?** Propre.
61. **Chromium réel a-t-il été testé ?** Oui — 5 tests, tous verts.
62. **Firefox réel ?** Non — binaire non installé dans cet environnement, non configuré dans le `playwright.config.js` du projet.
63. **WebKit réel ?** Non, idem.
64. **Quelle preuve navigateur existe ?** 5 tests Playwright/Chromium exécutant le vrai composant de production bundlé (esbuild, en mémoire) plus deux contrôles empiriques directs (reproduction du bug historique et preuve du correctif) sur le mécanisme Blob URL lui-même.
65. **Une réserve subsiste-t-elle ?** Une seule, mineure et explicitement hors périmètre : le risque analogue sur `conversationService.js` (chat), non couvert par SECURITY-2 par construction (système distinct). Aucune réserve ne subsiste sur le périmètre réel de SECURITY-2 (`InternalMail`).
66. **Peut-on lever la réserve précédente ?** Oui — la réserve portait précisément sur l'absence de preuve navigateur réelle, désormais fournie.
67. **Le finding P0 est-il fermé ?** Oui, sur son périmètre exact (`InternalMail`).
68. **Existe-t-il encore un chemin connu de vol de session via une pièce jointe HTML/SVG ?** Sur `InternalMail` : non, prouvé. Sur le système de chat (`Message`/`Conversation`) : oui, potentiellement, mais c'est un système distinct, jamais couvert par ce hotfix, documenté séparément.
69. **Le comportement métier a-t-il changé ?** Non.
70. **Une feature hors scope a-t-elle été ajoutée ?** Non.
71. **Backend modifié ?** Non.
72. **Mobile modifié ?** Non.
73. **RBAC modifié ?** Non.
74. **Tenant modifié ?** Non.
75. **Verdict final ?** Voir ci-dessus et §3.

## 3. Fichiers créés/modifiés pendant cette certification

**Micro-correction de production (1 fichier)** :
- `client/lib/utils/attachmentSecurity.js` — ajout de `stripQueryOrFragment`, ferme l'évasion par suffixe `?...`/`#...` sur le nom de fichier.

**Tests (2 fichiers créés)** :
- `client/lib/__tests__/attachmentSecurity.test.js` — 19 tests de classification adversariale.
- `client/e2e/security2/attachment-preview-browser.spec.js` — 5 tests Chromium réel.

**Harnais de certification (2 fichiers créés, jamais chargés par l'application réelle)** :
- `client/e2e/security2/mountAttachmentPreview.entry.jsx` — point d'entrée bundlant le vrai composant `SafeAttachmentPreview` pour Playwright.
- `client/e2e/security2/playwright.security2.config.js` — config Playwright dédiée, légère, sans la stack e2e complète.

**Documentation (7 fichiers créés dans `server/docs/`)** :
`HOTFIX_INBOX_SECURITY2_FINAL_CERT_ETAT_INITIAL.md`, `_BROWSER_MATRIX.md`, `_ADVERSARIAL_MATRIX.md`, `_FILE_MATRIX.md`, `_BYPASS_AUDIT.md`, `_FINAL_SECURITY_MATRIX.md`, `_FINAL_REPORT.md` (ce fichier).

Aucun fichier backend, mobile, ou de règle métier touché. Aucune commande git de mutation exécutée.

## 4. Vulnérabilité initiale, protection appliquée, preuves, non-régression, gates

- **Vulnérabilité initiale** : pièces jointes `.html`/`.svg` ouvertes via `window.open(Blob)`, exécutables avec l'origine du dashboard (vol de session potentiel via `localStorage`).
- **Protection appliquée** (déjà en place avant cette certification, revérifiée) : classification fail-closed → sanitization DOMPurify → rendu dans une iframe sandboxée sans `allow-scripts`/`allow-same-origin` → téléchargement forcé via `<a download>`.
- **Preuve navigateur** : 5/5 tests Chromium réels verts (`_BROWSER_MATRIX.md`).
- **Preuve adversariale** : 19/19 cas de classification verts, dont 3 fermés pendant cette certification (`_ADVERSARIAL_MATRIX.md`).
- **Non-régression** : suite client complète 721/725 (4 échecs préexistants confirmés sans rapport), `SafeHtmlEmailViewer` 12/12, SECURITY-1 15/15.
- **Gates** : lint 0 erreur, build production vert, `git diff --check` propre.

## 5. STOP

Conformément au mandat, cette certification s'arrête ici. `INBOX-2`, `INBOX-3`, CID, inline images, Office preview, redesign Inbox, nouveau viewer : **non démarrés**. Le seul suivi recommandé, hors périmètre de ce mandat et non démarré, est un hotfix dédié pour `conversationService.js` (voir `_BYPASS_AUDIT.md`).

**En attente de validation de l'utilisateur avant tout commit.**
