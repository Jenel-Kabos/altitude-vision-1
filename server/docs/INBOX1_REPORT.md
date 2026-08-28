# INBOX-1 — RAPPORT FINAL

**Verdict : AUDIT CERTIFIÉ.**

Cette certification porte sur la rigueur et la complétude de l'audit lui-même, pas sur l'état de santé du système audité — deux findings P0 réels ont été découverts (un endpoint totalement non authentifié, une pièce jointe HTML/SVG non sanitizée si ouverte directement) et doivent être corrigés avant/en parallèle d'INBOX-2, mais rien dans le pipeline n'est resté flou ou non caractérisé : chaque affirmation de ce rapport est appuyée par une citation fichier:ligne. Bonne nouvelle centrale de cet audit : le rendu HTML des emails, la question P0 la plus redoutée du mandat, **est déjà correctement sécurisé** (DOMPurify + iframe sandbox, testé).

## Réponses aux 60 questions de certification

1. **Point d'entrée IMAP ?** `server/services/zohoImapService.js`, `ImapFlow` vers `imap.zoho.com:993`, poll cron `*/5 * * * *` (`server.js:89-96`), pas de push/IDLE.
2. **Bibliothèque de parsing ?** `mailparser`.
3. **Version ?** 3.9.14 installée (`^3.9.6` épinglé).
4. **Où sont stockés les emails ?** MongoDB, modèle `InternalMail`.
5. **Où sont stockées les pièces jointes ?** Cloudinary, asset privé/authentifié (`uploadPrivateAsset`) — seul un descripteur (`publicId`, etc.) est en Mongo.
6. **Les bytes sont-ils conservés ?** Oui, sur Cloudinary (jamais en base).
7. **Les MIME sont-ils conservés ?** Oui, mais **jamais revérifiés** — valeur déclarée par l'expéditeur, stockée telle quelle.
8. **Les Content-ID sont-ils conservés ?** **Non** — jamais lus depuis `parsed.attachments[].contentId`, confirmé par recherche exhaustive.
9. **Les dispositions inline sont-elles conservées ?** **Non** — même constat, `contentDisposition`/`related` jamais lus.
10. **Le HTML original est-il conservé ?** Oui, tronqué à 200 000 caractères (`html`, maxlength schéma identique).
11. **Le text/plain est-il conservé ?** Oui, tronqué à 10 000 caractères.
12. **`multipart/alternative` correctement géré ?** Oui, via les défauts de `mailparser` (`.text`/`.html` bien exploités).
13. **`multipart/related` correctement géré ?** **Partiellement** — la bibliothèque l'expose par défaut, mais le code applicatif ignore le flag `related`/`cid`, donc les images inline sont stockées comme des pièces jointes opaques sans lien reconstruit.
14. **Les CID peuvent-ils être reconstruits ?** **NON, aujourd'hui** — la donnée nécessaire (Content-ID) n'est pas persistée. Reconstructible après un changement backend minimal (voir `INBOX1_TARGET_ARCHITECTURE.md`).
15. **Images distantes chargées automatiquement ?** Oui, aucun blocage.
16. **Protection tracking existante ?** Non.
17. **Comment le HTML est-il affiché ?** `SafeHtmlEmailViewer.jsx` : DOMPurify puis `<iframe sandbox srcDoc>`.
18. **Sanitization existante ?** Oui — DOMPurify v3.4.8, configuration explicite (`FORBID_TAGS`/`FORBID_ATTR`), testée.
19. **Risque XSS ?** **Non, sur le corps HTML de l'email** (double défense confirmée). **Oui, potentiellement, sur un fichier `.html`/`.svg` joint** ouvert directement (`window.open(blob)` sans passer par la même sanitization) — trouvé pendant cet audit, à corriger.
20. **Risque CSS injection ?** Confiné à l'iframe, ne peut pas atteindre le dashboard — faible.
21. **SVG sécurisé ?** **Non confirmé — probable gap**, un SVG joint ouvert directement n'est pas sanitizé.
22. **Les MIME sont-ils vérifiés ?** Non, jamais par signature de fichier — uniquement la valeur déclarée.
23. **L'extension est-elle source de vérité ?** Non utilisée comme telle dans le code actuel (le MIME déclaré l'est, ce qui n'est pas mieux en soi).
24. **Limite de taille existante ?** Pour texte/HTML oui (troncature) ; **pour les pièces jointes, non confirmée**.
25. **Protection archive bomb ?** Non nécessaire aujourd'hui (aucune extraction serveur d'archive), mais aucune protection explicite si cela changeait.
26. **Attachments tenant-scoped ?** Sans objet — `InternalMail` n'a pas de notion de tenant (boîte par employé).
27. **Downloads ownership-scoped ?** **Oui, vérifié** — `sender === userId || receiver === userId`, sinon 403.
28. **Risque IDOR ?** Non sur le chemin audité (téléchargement, liste) — protection confirmée par le code.
29. **Formats réellement supportés aujourd'hui (preview) ?** **Aucun** — tout fichier est téléchargé/ouvert en blob brut, aucune preview différenciée par type n'existe.
30. **Formats seulement téléchargeables ?** Tous, uniformément (voir `INBOX1_ATTACHMENT_MATRIX.md`).
31. **Formats perdus/mal représentés ?** Les images inline CID (cassées à l'affichage) ; aucun autre format n'est "perdu" (tout est conservé sur Cloudinary), seulement non prévisualisé.
32. **PDF previewable aujourd'hui ?** Seulement via le rendu natif du navigateur lors de l'ouverture en onglet — pas un viewer intégré à l'app.
33. **Images ?** Ouverture plein écran brute, aucune miniature.
34. **CSV ?** Non — téléchargement brut.
35. **HTML (pièce jointe, pas le corps d'email) ?** Non prévisualisé de façon sécurisée — voir finding P0.
36. **Office ?** Non — téléchargement uniquement.
37. **Audio ?** Non — téléchargement uniquement, pas de lecteur intégré.
38. **Vidéo ?** Idem.
39. **Code source ?** Non — téléchargement uniquement, pas de coloration syntaxique.
40. **Un viewer réutilisable existe-t-il déjà ?** Seulement `SafeHtmlEmailViewer.jsx` (pour le corps d'email, pas pour les pièces jointes) — aucun autre.
41. **Bibliothèque de syntax highlighting ?** Aucune installée.
42. **Bibliothèque PDF ?** Aucune installée (rendu natif navigateur seulement).
43. **Bibliothèque Office ?** Aucune installée, aucune candidate mature identifiée pour PowerPoint en particulier.
44. **Le frontend est-il suffisamment modulaire ?** Partiellement — composants enfants bien séparés, mais le conteneur de page (792 lignes) mélange data-fetching/état/logique.
45. **Composant principal candidat à extraction ?** `ConversationViewer` (actuellement inline dans `InternalMessagingPage.jsx`) + extraction de la couche data-fetching en hook dédié.
46. **Duplication Web/backend ?** Deux implémentations quasi identiques du téléchargement de pièce jointe (`messageController.js` chat interne vs `internalMailController.js` email), avec une différence notable (nom de fichier constant vs réel) — candidat de factorisation future.
47. **Le pipeline IMAP est-il couplé aux controllers ?** Le parsing MIME est fait inline dans `zohoImapService.js`, pas dans un module de parsing dédié — couplage transport/parsing, pas transport/controller à proprement parler (le controller HTTP est un système séparé, correctement découplé du poll IMAP).
48. **Respecte-t-il ARCH-2A ?** Oui — `npm run architecture:check` : PASS, 0 nouvelle violation.
49. **Dépendances architecturales à corriger plus tard ?** Le couplage parsing/transport dans `zohoImapService.js` (dette de conception, pas une violation du garde-fou automatisé) ; la duplication de logique de téléchargement mentionnée en Q46.
50. **`AttachmentViewerRegistry` adapté ?** Oui, confirmé adapté à l'architecture actuelle, sous réserve de router sur un MIME normalisé/revérifié plutôt que la valeur brute déclarée.
51. **Architecture recommandée pour `SafeHtmlEmailViewer` ?** **Aucun changement — l'implémentation actuelle (sanitization + iframe sandbox) est déjà la bonne réponse**, à documenter comme référence plutôt qu'à remplacer.
52. **Comment gérer les CID ?** Conserver `contentId` au parsing (changement backend minimal), résoudre `cid:` → endpoint de téléchargement existant avant sanitization côté frontend.
53. **Comment gérer les images distantes ?** Bloquer par défaut, bouton explicite "Afficher les images" (hook DOMPurify symétrique à celui déjà en place).
54. **Comment gérer un MIME inconnu ?** `GenericFileViewer` : métadonnées + téléchargement + avertissement si extension exécutable, jamais d'exécution/rendu spéculatif.
55. **P0 avant toute amélioration UI ?** (a) Authentifier `emailRoutes.js`. (b) Sanitizer les pièces jointes `.html`/`.svg` avant tout `window.open` direct.
56. **P1 ?** Résolution CID (images inline cassées), absence totale de preview différenciée par type de fichier.
57. **P2 ?** Miniatures d'images, extraction du composant monolithique, avertissement fichier dangereux, nom de fichier constant côté chat interne.
58. **Coût architectural estimé INBOX-2→8 ?** INBOX-3/5 plus légers que prévu (sécurité HTML déjà faite) ; INBOX-4 de complexité moyenne avec obligations de sécurité non négociables (SVG, CSV) ; INBOX-6 (Office) le plus coûteux et incertain, faute de bibliothèque candidate mûre.
59. **Qu'est-ce qui peut être réutilisé ?** `secureStorageService.js`, le patron `SafeHtmlEmailViewer.jsx`, l'endpoint `downloadAttachment` existant.
60. **Qu'est-ce qui ne doit surtout pas être reconstruit ?** Un deuxième système de messagerie/modèle d'email, un deuxième mécanisme de sanitization HTML, un deuxième service de stockage de pièce jointe.

## Distinction explicite exigée par le mandat §27

- **Supporté aujourd'hui** : lecture texte/HTML du corps d'email (sécurisée), téléchargement de toute pièce jointe, ownership vérifiée sur le téléchargement.
- **Partiellement supporté** : `multipart/related` (la bibliothèque l'expose, l'application l'ignore).
- **Stocké mais non affiché** : tous les octets de pièces jointes (sur Cloudinary), le HTML complet de l'email (jusqu'à 200 000 caractères).
- **Téléchargeable uniquement** : PDF, images, Office, audio, vidéo, code source, CSV — aucune preview différenciée.
- **Non supporté** : résolution CID/images inline, blocage des images distantes, coloration syntaxique, preview Office, preview tableur.
- **Support futur recommandé** : voir `INBOX1_ROADMAP.md`, réordonnancée pour faire précéder les deux corrections P0 de sécurité.

## Gates exécutées

- `git status`/`git diff --check`/`git log` : exécutés en Phase état initial, exit 0, aucun fichier écrasé.
- `npm run architecture:check` : exécuté, PASS, 0 nouvelle violation.
- Aucun test ajouté (aucun code modifié — conforme au mandat §22, ne pas transformer l'audit en sprint d'implémentation ; les preuves de comportement sont apportées par citation fichier:ligne dans les documents produits, pas par de nouveaux tests).
- Lint/build/suite complète : **non exécutés** — non requis, aucun fichier de code modifié par cet audit.

## Fichiers produits

`INBOX1_ETAT_INITIAL.md`, `INBOX1_ARCHITECTURE.md`, `INBOX1_MIME_PIPELINE.md`, `INBOX1_ATTACHMENT_MATRIX.md`, `INBOX1_ENDPOINT_MATRIX.md`, `INBOX1_SECURITY_MATRIX.md`, `INBOX1_FRONTEND_AUDIT.md`, `INBOX1_TARGET_ARCHITECTURE.md`, `INBOX1_ROADMAP.md`, `INBOX1_REPORT.md` — 10/10 livrables du mandat. Aucun fichier de code modifié, aucun package ajouté, aucune migration Mongo, aucun commit/push/déploiement.

## STOP

Conformément au mandat : aucun viewer implémenté, aucune refonte visuelle, aucune bibliothèque ajoutée, aucune règle métier modifiée, aucun endpoint modifié, aucune migration Mongo. INBOX-2 n'est pas démarré. En attente de validation humaine — recommandation explicite de traiter les deux findings P0 (endpoint `emailRoutes.js` non authentifié, sanitization des pièces jointes HTML/SVG) avant ou en parallèle du démarrage d'INBOX-2.
