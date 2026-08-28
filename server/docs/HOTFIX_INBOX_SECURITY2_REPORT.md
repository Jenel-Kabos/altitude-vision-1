# HOTFIX-INBOX-SECURITY-2 — RAPPORT FINAL

## 1. Résumé

Les pièces jointes `InternalMail` de type HTML/SVG (actif) contournaient `SafeHtmlEmailViewer`/DOMPurify : les boutons "Voir" et "Télécharger" appelaient tous deux `previewInternalMailAttachment` (`window.open` sur un `Blob` brut). Une URL `blob:` **hérite de l'origine du créateur** (pas une origine opaque) — un `.html`/`.svg` hostile joint à un email (y compris externe, via IMAP) pouvait donc exécuter du JavaScript avec les pleins droits same-origin du dashboard, y compris lecture du JWT en `localStorage`. Correctif : classification fail-closed (extension OU MIME) ; les types actifs sont désormais sanitizés (DOMPurify, réutilisant la config déjà certifiée de `SafeHtmlEmailViewer`) puis rendus dans une iframe sandboxée isolée (`SafeAttachmentPreview`) pour "Voir", et forcés en sauvegarde réelle via `<a download>` pour "Télécharger". Tous les autres types (image, PDF, etc.) sont strictement inchangés.

## 2. Réponses aux 77 questions du mandat (§60)

1. **Où se trouve le preview attachment actuel ?** `client/lib/components/messaging/AttachmentStrip.jsx`, via `client/lib/services/messageService.js:117-122` (`previewInternalMailAttachment`).
2. **Utilise-t-il `window.open` ?** Oui (avant correctif, pour tous les types ; après correctif, uniquement pour les types sûrs, inchangé).
3. **Utilise-t-il `Blob` ?** Oui — `responseType: 'blob'` puis `URL.createObjectURL`.
4. **Utilise-t-il `createObjectURL` ?** Oui, dans `previewInternalMailAttachment` (inchangé) et dans les deux nouvelles fonctions `fetchInternalMailAttachmentContent`/`downloadInternalMailAttachment`.
5. **Quels types passent par cette chaîne ?** Avant correctif : tous, sans distinction. Après correctif : tous les types sûrs (image, PDF, texte, office, archive...) via la chaîne inchangée ; les types actifs (HTML/SVG) via la nouvelle chaîne sanitizée/sandboxée.
6. **HTML pouvait-il atteindre cette chaîne ?** Oui, confirmé — aucune branche de code ne l'en empêchait avant correctif.
7. **SVG pouvait-il atteindre cette chaîne ?** Oui, idem.
8. **Le finding INBOX-1 est-il confirmé ?** Oui, revalidé directement sur le HEAD actuel (voir `HOTFIX_INBOX_SECURITY2_ETAT_INITIAL.md`).
9. **Quel est le risque réel ?** Exécution de JavaScript arbitraire avec l'origine du dashboard (vol de JWT via `localStorage`), pas seulement un "vecteur de phishing" comme formulé prudemment par `INBOX1_ATTACHMENT_MATRIX.md` — révisé à la hausse sur preuve du comportement des URL `blob:`.
10. **`SafeHtmlEmailViewer` utilise-t-il DOMPurify ?** Oui, confirmé, inchangé.
11. **Quelle configuration ?** `ADD_TAGS:['style']`, `FORCE_BODY:true`, `FORBID_TAGS:['script','iframe','object','embed','form']`, `FORBID_ATTR:['onerror','onclick','onload','onmouseover','formaction']`, `ALLOW_DATA_ATTR:false` — désormais extraite dans `sanitizeSandboxedHtml.js`, réutilisée telle quelle.
12. **Utilise-t-il iframe ?** Oui.
13. **Quelle sandbox exacte ?** `sandbox="allow-popups allow-popups-to-escape-sandbox"`.
14. **`allow-scripts` est-il absent ?** Oui, absent (email et pièces jointes).
15. **`allow-same-origin` est-il absent ?** Oui, absent (email et pièces jointes).
16. **Le viewer existant est-il réutilisable ?** Partiellement — son cœur (sanitize + sandbox) oui, mais il est couplé à des comportements spécifiques au corps d'email (mesure de hauteur auto, fallback texte) non pertinents pour un modal de pièce jointe.
17. **A-t-il été réutilisé ?** Oui, sa logique de sanitization (config + hook de liens) a été extraite et réutilisée à l'identique.
18. **Sinon, pourquoi ?** (Le composant entier n'a pas été réutilisé tel quel — voir Q19-20.)
19. **Une primitive commune a-t-elle été extraite ?** Oui — `client/lib/utils/sanitizeSandboxedHtml.js` (`sanitizeForSandboxedIframe`).
20. **Pourquoi ?** Pour éviter de dupliquer la configuration DOMPurify entre `SafeHtmlEmailViewer` et le nouveau `SafeAttachmentPreview` (mandat §16), sans forcer la réutilisation du composant entier qui mélange logique email-spécifique et sanitization (mandat §16 met en garde contre ce couplage).
21. **Comment HTML est-il previewé après fix ?** Sanitizé (DOMPurify) puis injecté en `srcDoc` dans une iframe sandboxée isolée (`SafeAttachmentPreview`).
22. **Comment SVG est-il previewé après fix ?** Sanitizé avec le profil DOMPurify SVG (`foreignObject` explicitement retiré en plus) puis même iframe sandboxée.
23. **Comment JPEG/PNG sont-ils previewés ?** Inchangé — `previewInternalMailAttachment` (raw blob + `window.open`).
24. **PDF a-t-il changé ?** Non, confirmé par test (`pdfAttachment`).
25. **Download a-t-il changé ?** Pour les types sûrs, non (même fonction, mêmes endpoints). Pour les types actifs, oui — `<a download>` forcé au lieu de `window.open` (nécessaire : `window.open` sur un Blob HTML/SVG l'exécute, ne le télécharge pas).
26. **MIME est-il pris en compte ?** Oui — `attachmentSecurity.js` vérifie `mimetype`.
27. **Extension est-elle prise en compte ?** Oui — vérifiée en parallèle du MIME.
28. **Que se passe-t-il si MIME/extension divergent ?** Classé actif si l'un OU l'autre signale HTML/SVG (fail-closed), prouvé par test (`mismatchAttachment`).
29. **Unknown MIME ?** Non classé actif par défaut (mandat §35) — comportement inchangé (chaîne sûre existante).
30. **SVG est-il encore traité comme image passive ?** Non — traité comme contenu actif, sanitizé avant tout rendu.
31. **Un raw HTML Blob est-il encore ouvert ?** Non, pour les types classés actifs. Oui, pour les types sûrs (inchangé, sans risque nouveau).
32. **Des `window.open` restent-ils ?** Oui, un seul, inchangé (`previewInternalMailAttachment`, réservé aux types sûrs).
33. **Lesquels et pourquoi ?** Celui de `previewInternalMailAttachment` — préservé car aucune preuve de risque sur les types sûrs (image, PDF, etc.), modification aurait dépassé le périmètre du mandat.
34. **`window.opener` est-il maîtrisé ?** Oui, `noopener,noreferrer` déjà présent, inchangé.
35. **Blob URLs sont-elles révoquées ?** Oui — `URL.revokeObjectURL` après 60s dans les trois fonctions (`previewInternalMailAttachment` inchangée, `fetchInternalMailAttachmentContent` ne crée pas de Blob URL persistante, `downloadInternalMailAttachment` révoque après 60s).
36. **`data:` URLs sont-elles utilisées ?** Non, recherchées, aucune trouvée dans les fichiers touchés.
37. **`X-Content-Type-Options` est-il présent ?** Oui, déjà présent sur `downloadAttachment` (`internalMailController.js:687`), backend non modifié par ce hotfix.
38. **Backend modifié ?** Non.
39. **Pourquoi ?** La faille était entièrement fermable côté frontend (le backend fournissait déjà les métadonnées nécessaires — `mimetype`, `filename` — à la classification), conformément au mandat §44 ("éviter toute modification backend si la faille peut être correctement fermée au niveau du viewer frontend").
40. **`protect` modifié ?** Non.
41. **`ROLES_DOCS` modifié ?** Non.
42. **RBAC modifié ?** Non.
43. **Tenant modifié ?** Non (non applicable, `InternalMail` n'a pas de champ tenant).
44. **Ownership modifié ?** Non.
45. **IMAP modifié ?** Non.
46. **SMTP modifié ?** Non.
47. **CID implémenté ?** Non.
48. **Tracking protection implémentée ?** Non.
49. **Tests adversariaux ?** Oui — `AttachmentStripSecurity.test.jsx`, 9 tests.
50. **HTML hostile testé ?** Oui (`<script>`, `onerror`).
51. **SVG hostile testé ?** Oui (`<script>` imbriqué, `onload`).
52. **MIME mismatch testé ?** Oui (`mismatchAttachment`).
53. **Image normale testée ?** Oui (`imageAttachment`, comportement historique prouvé inchangé).
54. **PDF testé ?** Oui (`pdfAttachment`, comportement historique prouvé inchangé).
55. **Download testé ?** Oui — type actif → `downloadInternalMailAttachment` ; type sûr → `previewInternalMailAttachment` inchangé.
56. **`SafeHtmlEmailViewer` testé ?** Oui — 12/12 tests existants rejoués sans modification, tous verts (non-régression de la refactorisation).
57. **SECURITY-1 rejoué ?** Oui — `emailRoutesAuth.test.js`, 15/15 verts.
58. **Client ciblé ?** Oui — `AttachmentStripSecurity.test.jsx` + `SafeHtmlEmailViewer.test.jsx` + `InternalMessagingPageUX.test.jsx`, tous verts.
59. **Client complet ?** Oui — 702/706 tests verts, 4 échecs préexistants confirmés indépendants (voir Q75).
60. **Backend ciblé ?** Oui — `emailRoutesAuth.test.js` (seule suite pertinente, aucun autre fichier backend touché).
61. **Backend complet ?** Non exécuté dans ce tour — justifié : aucun fichier backend modifié par ce hotfix (le backend complet a déjà été validé intégralement lors de SECURITY-1 sur le même HEAD, 135 suites/1528 tests verts).
62. **Architecture check ?** Non applicable à ce hotfix (aucun fichier backend touché) — dernière exécution connue (SECURITY-1, même HEAD) : PASS.
63. **Cycles ?** 0 (dernière exécution connue, backend inchangé depuis).
64. **New violations ?** 0 (idem).
65. **Stale ?** 0 (idem — baseline non affectée, aucun fichier backend modifié).
66. **Lint ?** 0 erreur, 0 warning sur les fichiers créés/modifiés (vérifié cette session, `npx eslint` ciblé).
67. **Build ?** `npm run build:next` réussi, page `/messages` compilée sans erreur.
68. **`git diff --check` ?** Propre pour les fichiers de ce hotfix (aucun warning CRLF, fichiers nouveaux/LF natif).
69. **Validation navigateur réelle ?** **NON CONFIRMÉ** — aucun navigateur réel disponible dans cet environnement ; la preuve repose sur les tests jsdom (assertions structurelles sur `srcdoc`/`sandbox`, exécution de payloads adversariaux non malveillants vérifiée par l'absence de `window.__pwned`) et sur la relecture directe du code de rendu. Le mécanisme (iframe sandbox sans `allow-scripts`) est identique à celui de `SafeHtmlEmailViewer`, déjà en production. Voir verdict.
70. **Mobile modifié ?** Non, `altimmo-app/` non touché.
71. **Production modifiée ?** Non.
72. **Commit ?** Non — instruction permanente de l'utilisateur.
73. **Push ?** Non.
74. **Deploy ?** Non.
75. **Autres vulnérabilités découvertes ?** Une nuance découverte en cours d'audit (pas une vulnérabilité nouvelle et distincte, mais une aggravation de sévérité du finding déjà identifié) : le bouton "Télécharger" sur un type actif n'effectuait, avant ce hotfix, pas un vrai téléchargement — il exécutait le contenu au lieu de le sauvegarder (`window.open` sur un Blob HTML/SVG le rend, ne le sauvegarde pas). Documenté et corrigé dans le même geste que "Voir" (même cause racine, même fichier, mandat §64 : traité ici car directement lié, pas un chantier de sécurité distinct). 4 échecs de tests préexistants et sans rapport (`ManageHotelsPage.test.jsx`, `ManageAccommodationsPage.test.jsx`) confirmés indépendants par `git stash` + ré-exécution sur baseline.
76. **Laissées hors scope ?** Oui — tracking pixels/ressources distantes (email et SVG), CID, viewers Office/CSV/code, redesign de la boîte de réception, détection par signature de fichier — toutes déjà documentées comme hors périmètre par le mandat, non traitées ici.
77. **Verdict ?** Voir §4.

## 3. Fichiers créés/modifiés

**Frontend (7 fichiers, aucun backend, aucun mobile)** :
- `client/lib/utils/sanitizeSandboxedHtml.js` (créé)
- `client/lib/utils/attachmentSecurity.js` (créé)
- `client/lib/components/messaging/SafeAttachmentPreview.jsx` (créé)
- `client/lib/components/messaging/AttachmentStrip.jsx` (modifié)
- `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` (modifié — refactorisation interne, comportement identique)
- `client/lib/services/messageService.js` (modifié — 2 fonctions ajoutées, aucune existante changée)
- `client/lib/__tests__/AttachmentStripSecurity.test.jsx` (créé, 9 tests)

**Documentation (6 fichiers dans `server/docs/`)** :
`HOTFIX_INBOX_SECURITY2_ETAT_INITIAL.md`, `_PREVIEW_MATRIX.md`, `_THREAT_MODEL.md`, `_BEHAVIOR_CONTRACT.md`, `_SECURITY_MATRIX.md`, `_REPORT.md` (ce fichier).

## 4. Verdict

**GO SOUS RÉSERVES.**

Tous les critères de `§61 CRITÈRES CERTIFIÉ VERT` sont remplis **sauf un** : la validation par navigateur réel (mandat §56/§69) n'a pas pu être effectuée, cet environnement ne disposant d'aucun navigateur interactif. La preuve de sécurité repose sur :
- l'analyse directe et documentée du mécanisme (identique à `SafeHtmlEmailViewer`, déjà en production, déjà certifié) ;
- des tests jsdom qui vérifient structurellement l'attribut `sandbox`, l'absence de `<script>`/gestionnaires d'événements dans le `srcDoc` final, et l'absence d'exécution effective d'un payload adversarial non malveillant (`window.__pwned` reste `undefined`) ;
- la non-régression complète des suites existantes (`SafeHtmlEmailViewer`, `InternalMessagingPageUX`, suite client complète, `emailRoutesAuth`).

Tous les autres critères sont satisfaits : finding revalidé et sa sévérité correctement réévaluée à la hausse sur preuve technique, inventaire complet des chaînes de preview, HTML et SVG sécurisés, aucun contenu actif non fiable exécuté dans le DOM parent (prouvé), MIME mismatch fail-closed, `SafeHtmlEmailViewer` resté sain (refactorisation à comportement strictement identique, 12/12 tests inchangés), images/PDF/téléchargement préservés, authentification SECURITY-1 préservée, `ROLES_DOCS`/tenant/ownership inchangés, aucune règle métier ni capability ajoutée, aucune refonte de boîte de réception, tests adversariaux et ciblés verts, aucune nouvelle régression sur la suite complète (4 échecs préexistants confirmés indépendants), build vert, lint 0 erreur, `git diff --check` vert.

**Recommandation** : avant mise en production, effectuer une vérification manuelle dans un navigateur réel (Chrome/Firefox) avec un email de test contenant une pièce jointe `.html` et `.svg` portant un payload inoffensif (`<script>document.title='test'</script>`), en confirmant que le titre de l'onglet parent ne change jamais et qu'aucune requête réseau vers un domaine externe n'est déclenchée depuis le contexte de l'iframe.

## 5. STOP

Conformément au mandat, ce hotfix s'arrête ici. `INBOX-2` (Professional Inbox UX), `INBOX-3` (Attachment Viewer Registry), `INBOX-4` (Standard File Viewers), `INBOX-5` (CID/inline images/remote content protection) restent des pistes candidates, **non démarrées**, à la discrétion de l'utilisateur.

**En attente de validation de l'utilisateur — et en particulier d'une vérification navigateur réelle si l'environnement le permet — avant tout commit.**
