HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — FINDING RECLASSIFIED / NO FIX REQUIRED

## 1. Résumé

Le finding suspecté pendant la certification de `HOTFIX-INBOX-SECURITY-2` — un mécanisme de preview/téléchargement structurellement analogue à celui qui était vulnérable dans `InternalMail` — a été revalidé en profondeur sur le système `Conversation`/`Message`. **La vulnérabilité ne se reproduit pas** : le seul point de création vivant d'un attachment (`POST /api/messages`) est protégé par un `fileFilter` multer préexistant (`server/config/cloudinary.js`, non lié à SECURITY-2, non créé pour ce mandat) qui rejette structurellement toute déclaration `text/html`/`application/xhtml+xml`/`image/svg+xml` avant tout stockage. Le mécanisme d'exécution (Blob servi avec un `Content-Type` actif, ouvert via `window.open`/ancre) ne peut donc jamais s'amorcer pour un attachment créé aujourd'hui. **Aucun code de production n'a été modifié.** Un test de caractérisation backend (10 cas) verrouille ce comportement contre une régression future silencieuse. Un risque résiduel étroit et non confirmé (attachments historiques `url`-based) est documenté séparément.

## 2. Réponses aux 78 questions du mandat (§60)

1. **Le finding est-il confirmé ?** Non — reclassifié après audit direct.
2. **Où est `conversationService.js` ?** `client/lib/services/conversationService.js`.
3. **Quel rôle joue-t-il ?** Fonctions API pour le système de chat `Message`/`Conversation` (envoi, listing, `openConversationAttachment` pour preview/download).
4. **Quelle chaîne d'attachment existe ?** Upload (`multer`/Cloudinary) → `Message.attachments[].asset` → `messageSerializer.js` → `previewEndpoint`/`downloadEndpoint` → `openConversationAttachment` (Blob + ancre).
5. **Quel stockage ?** Cloudinary, asset privé (`uploadPrivateAsset`/`secureStorageService.js`), identique au mécanisme `InternalMail`.
6. **Quel modèle ?** `Message` (`server/models/Message.js`), champ `attachments[]`.
7. **Quel serializer ?** `server/services/messageSerializer.js::serializeMessage` (REST) ; le `toJSON` natif de `Message.js` pour la sérialisation implicite Socket.IO (payload différent, sans MIME — voir `_FLOW.md`).
8. **Quel endpoint ?** `POST /api/messages` (création), `GET /api/messages/:messageId/attachments/:attachmentId[?download=1]` (preview/download).
9. **Quel composant frontend ?** `renderAttachment()` inline dans `MessagesPage.jsx`/`StaffInboxPage.jsx` (pas de composant partagé de type `AttachmentStrip`).
10. **Quel preview mechanism ?** `openConversationAttachment` — Blob + ancre (`target="_blank"` ou `download`).
11. **`window.open` utilisé ?** Non directement — une ancre `<a>` cliquée programmatiquement, fonctionnellement équivalente.
12. **Blob utilisé ?** Oui.
13. **`createObjectURL` utilisé ?** Oui.
14. **HTML peut-il atteindre ce flux ?** Non — rejeté par `fileFilter` avant tout stockage.
15. **SVG ?** Non, idem.
16. **MIME actif (stocké) ?** Non — structurellement impossible via ce chemin.
17. **Quel niveau de sévérité ?** P2, résiduel et non confirmé (attachments legacy uniquement).
18. **Peut-on exécuter JS ?** Non, prouvé par analyse et par test du fileFilter.
19. **Peut-on lire `localStorage` ?** Non applicable — aucun contexte d'exécution actif jamais atteint.
20. **`parent DOM` ?** Non applicable, idem.
21. **`top navigation` ?** Non applicable, idem.
22. **`popup` ?** Non applicable, idem.
23. **Quel test reproduit le problème ?** Aucun — le problème n'est pas reproductible ; `messageAttachmentMimeFilter.test.js` prouve au contraire la protection existante.
24. **Était-il rouge avant fix ?** Non applicable — aucune correction n'a été nécessaire, il n'y a pas eu de cycle rouge→vert sur du code de production.
25. **Quel correctif ?** Aucun sur le code de production. Un test de caractérisation a été ajouté (`messageAttachmentMimeFilter.test.js`).
26. **Primitive SECURITY-2 réutilisée ?** Non — non nécessaire, aucune classification frontend n'a dû être ajoutée.
27. **Classification SECURITY-2 réutilisée ?** Non, même raison.
28. **Si non, pourquoi ?** Parce que la barrière de sécurité pertinente pour ce système n'est pas une classification frontend (extension/MIME du contenu affiché) mais un filtre backend à l'upload, déjà existant et suffisant — ajouter la classification frontend de SECURITY-2 aurait été une duplication de politique sans nécessité prouvée (mandat §19/§20).
29. **Duplication créée ?** Non.
30. **HTML traité comment après ?** Rejeté à l'upload, jamais stocké, jamais prévisualisé — comportement inchangé (déjà ainsi avant ce mandat).
31. **SVG ?** Idem.
32. **Download ?** Inchangé.
33. **JPEG/PNG inchangés ?** Oui, prouvé par test.
34. **PDF ?** Oui, inchangé.
35. **Office (DOCX/XLSX/PPTX) ?** Non applicable — ces MIME ne sont pas dans l'allowlist de ce système (contrairement à InternalMail) ; comportement de rejet inchangé, non testé individuellement (hors allowlist par construction, mandat §23 ne demande que la préservation de l'existant).
36. **Unknown ?** Rejeté par le fileFilter (allowlist stricte, tout le reste est refusé) — comportement préexistant, non modifié.
37. **MIME spoofing couvert ?** Oui, analysé (`_THREAT_MODEL.md`) — accepté par le filtre si le MIME menti est dans l'allowlist, mais sans impact d'exécution.
38. **Double extension ?** Non pertinent pour ce système — la barrière n'est pas basée sur l'extension du nom de fichier.
39. **Query suffix ?** Non pertinent, même raison.
40. **Fragment suffix ?** Non pertinent, même raison.
41. **Casing ?** Non pertinent — le fileFilter compare le MIME déclaré à une liste exacte (les navigateurs déclarent les MIME en minuscules par convention ; non testé explicitement car non pertinent au modèle de menace ici, la barrière n'étant pas une regex d'extension).
42. **DOMPurify utilisé ?** Non — non nécessaire, aucun contenu actif n'atteint jamais un rendu.
43. **`iframe sandbox` ?** Non utilisé dans ce système — non nécessaire, même raison.
44. **`allow-scripts` absent ?** Non applicable (pas d'iframe dans ce mécanisme).
45. **`allow-same-origin` absent ?** Non applicable.
46. **Browser réel testé ?** Non — non nécessaire, aucune correction frontend n'a été apportée (mandat §45 : Chromium réel obligatoire seulement "si le finding est confirmé et frontend corrigé").
47. **Chromium ?** Non exécuté pour ce mandat spécifiquement — voir `_BROWSER_MATRIX.md` pour la justification et le renvoi aux preuves Chromium déjà produites par SECURITY-2 sur le même mécanisme générique (Blob/`window.open`).
48. **`localStorage` factice inaccessible ?** Non applicable — aucun test navigateur nécessaire ici.
49. **Parent inaccessible ?** Non applicable.
50. **Top navigation bloquée ?** Non applicable.
51. **Popup bloquée ?** Non applicable.
52. **Message contract inchangé ?** Oui — `ARCH2C2_MESSAGE_CONTRACT.md` intact, aucun fichier concerné modifié, 30/30 tests verts.
53. **Socket.IO inchangé ?** Oui, aucun fichier touché.
54. **Unread inchangé ?** Oui.
55. **Tenant inchangé ?** Oui.
56. **Ownership inchangé ?** Oui.
57. **IAM inchangé ?** Oui.
58. **Backend modifié ?** Non (hors ajout d'un fichier de test, zéro fichier de production).
59. **Frontend modifié ?** Non.
60. **Mobile modifié ?** Non.
61. **Tests ciblés ?** Oui — `messageAttachmentMimeFilter.test.js` (10/10), `conversationRoutes.test.js`/`conversationStaffInboxTenant.test.js`/`messageSerializer.test.js` (30/30) rejoués.
62. **ARCH-2C2 rejoué ?** Oui, via les 3 suites ci-dessus, toutes vertes, aucun fichier concerné par ARCH-2C2 modifié.
63. **Client complet ?** Non exécuté — non requis, aucun fichier frontend modifié (mandat §49).
64. **Backend complet si pertinent ?** Oui, exécuté par prudence malgré l'absence de modification de production : 1555/1556 verts (1 échec `hotelOperationsRoutes.test.js`, flake réseau confirmé sans rapport par ré-exécution isolée, 35/35).
65. **Mongo si pertinent ?** Non exécuté — non requis, aucun modèle/schéma modifié (mandat §51 : obligatoire seulement si Message/Conversation backend modifié, ce qui n'est pas le cas).
66. **`InternalMail` non-régression ?** Confirmée par re-exécution de `emailRoutesAuth.test.js` (15/15) — aucun fichier partagé avec SECURITY-1/2 n'a été touché.
67. **`architecture:check` ?** PASS, 0 nouvelle violation.
68. **Lint ?** 0 nouvelle erreur.
69. **Build ?** Non requis — aucun fichier frontend modifié.
70. **`git diff --check` ?** Propre.
71. **Règle métier ajoutée ?** Non.
72. **Production modifiée ?** Non.
73. **Commit ?** Non.
74. **Push ?** Non.
75. **Deploy ?** Non.
76. **Autre vulnérabilité découverte ?** Non — au contraire, une protection préexistante et efficace a été identifiée et documentée (le `fileFilter` de `config/cloudinary.js`), qui n'était pas explicitement reliée à ce modèle de menace avant cet audit.
77. **Hors scope respecté ?** Oui — aucune modification de Message/Conversation/tenant/ownership/RBAC/Socket.IO/unread/CRM ; aucun nouveau viewer ; `InternalMail`/SECURITY-1/SECURITY-2 non touchés ; mobile non touché.
78. **Verdict final ?** Voir §3.

## 3. Fichiers créés (aucune modification de production)

- `server/__tests__/messageAttachmentMimeFilter.test.js` — 10 tests de caractérisation du `fileFilter` existant.
- 8 documents dans `server/docs/` : `HOTFIX_CONVERSATION_ACTIVE_ATTACHMENT1_ETAT_INITIAL.md`, `_FLOW.md`, `_PREVIEW_MATRIX.md`, `_THREAT_MODEL.md`, `_BEHAVIOR_CONTRACT.md`, `_SECURITY_MATRIX.md`, `_BROWSER_MATRIX.md`, `_REPORT.md` (ce fichier).

## 4. Verdict

**HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 : FINDING RECLASSIFIED / NO FIX REQUIRED.**

Le mécanisme de preview/téléchargement de `Conversation`/`Message`, bien que structurellement similaire en apparence à celui d'`InternalMail` (Blob + ouverture directe, aucune classification MIME/extension côté frontend), n'est **pas exploitable** pour le vecteur étudié (exécution de HTML/SVG actif), grâce à une barrière backend indépendante et préexistante (`fileFilter` multer) qui empêche structurellement le stockage de tout MIME actif. Cette conclusion est étayée par un test direct et reproductible (10/10 verts), pas par une supposition. Conformément au mandat §62, aucune modification de code de production n'a été effectuée — seul un test de non-régression verrouillant cette protection a été ajouté.

Un risque résiduel P2, non confirmé et hors du chemin de création vivant (attachments historiques `url`-based), est documenté avec une recommandation d'audit de données hors périmètre de ce mandat.

## 5. STOP

Conformément au mandat, ce travail s'arrête ici. Aucune suite automatique n'est engagée. Les deux systèmes (`InternalMail`, `Conversation`/`Message`) restent des domaines fonctionnels distincts, chacun avec sa propre analyse de risque documentée.

**En attente de validation de l'utilisateur avant tout commit.**
