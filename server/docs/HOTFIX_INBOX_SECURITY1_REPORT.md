# HOTFIX-INBOX-SECURITY-1 — RAPPORT FINAL

## 1. Résumé

`server/routes/emailRoutes.js` (14 routes, modèle `Email` — comptes email d'entreprise / config notifications) ne portait **aucune authentification ni autorisation**, confirmant intégralement le finding P0 de l'audit `INBOX-1`. Correctif appliqué : ajout de `router.use(auth.protect, auth.restrictTo(...ROLES_DOCS))` en tête du fichier — 3 lignes ajoutées, aucune ligne de logique métier modifiée. Politique dérivée d'une preuve existante (gate du menu frontend `AdminDashboard.jsx:165`, `roles: ROLES_DOCS`), pas inventée.

## 2. Réponses aux points de certification du mandat

**Revalidation du finding avant correctif**
1. Le finding INBOX-1 a-t-il été revalidé directement (pas recopié) ? **Oui** — relecture complète de `emailRoutes.js`, `emailController.js`, `server.js` (mount + absence de middleware global).
2. Combien de routes contient `emailRoutes.js` ? **14.**
3. Combien avaient un middleware d'authentification avant correctif ? **0.**
4. Existe-t-il une protection globale (`app.use(protect)`) dans `server.js` ? **Non** — chaque routeur applique la sienne, pattern confirmé sur l'ensemble du projet, pas une anomalie propre à ce fichier.
5. `emailController.js` référence-t-il `req.user` quelque part ? **Non, dans aucun des 14 handlers.**

**Chaîne d'appel et périmètre**
6. Qui appelle ces routes ? **Un seul consommateur** : `client/lib/services/emailService.js` → `ManageEmailsPage.jsx` (`/dashboard/emails`).
7. Existe-t-il un appelant cron/service interne/webhook/mobile ? **Non** — recherche exhaustive (`grep -rn "/emails\b"`) ne retourne que le fichier lui-même et sa documentation.
8. Le frontend envoie-t-il déjà un token sur ces appels ? **Oui** — l'instance axios attache déjà `Authorization: Bearer` automatiquement (comportement standard du projet), le token était simplement ignoré côté serveur.
9. Ajouter `protect` peut-il casser un système interne non-HTTP ? **Non**, par construction (aucun appelant non-HTTP identifié).

**Distinction modèles**
10. `Email` et `CompanyEmail` sont-ils le même modèle ? **Non** — deux modèles Mongoose distincts et non liés. `CompanyEmail`/`companyEmailRoutes.js` a déjà `protect`+`restrictTo`, n'a aucun consommateur frontend identifié, n'a pas été modifié.
11. `Email` et `InternalMail` sont-ils liés ? **Non** — `InternalMail` est la boîte de réception réelle alimentée par IMAP, hors périmètre de ce hotfix, non modifiée.

**Sévérité — ne pas exagérer**
12. `/send` envoie-t-il réellement un email au moment de l'audit ? **Non** — `sendEmailViaZoho` dans `emailController.js` est un stub qui incrémente un compteur, sans appel réseau Zoho réel (à distinguer de `server/services/emailService.js::sendEmailViaZoho`, la vraie fonction d'envoi, utilisée ailleurs et non affectée par ce hotfix).
13. `/sync-zoho` synchronise-t-il réellement avec Zoho ? **Non**, stub également.
14. Le risque réel avant correctif était-il « envoi d'email arbitraire par un anonyme » ? **Non** — le risque réel prouvé était **CRUD anonyme sur la configuration des comptes email d'entreprise** (lecture/création/modification/suppression), pas l'envoi de mail.

**Politique choisie**
15. La politique `ROLES_DOCS` a-t-elle été inventée ? **Non** — dérivée de la preuve existante `AdminDashboard.jsx:165` (`roles: ROLES_DOCS`), qui gate déjà le menu menant à ces routes.
16. Une politique différenciée lecture/écriture (à la `companyEmailRoutes.js`) a-t-elle été appliquée ? **Non** — aucune preuve n'exigeait cette distinction pour le modèle `Email` ; l'appliquer sans preuve aurait été une invention de règle métier, explicitement interdite par le mandat.
17. `router.use(protect)` a-t-il été utilisé ? **Oui, avec `restrictTo(...ROLES_DOCS)` immédiatement après, en une seule ligne combinée.**
18. Toutes les 14 routes reçoivent-elles la même politique ? **Oui** — classification uniforme B (STAFF PRIVATE), aucune distinction prouvée entre routes.

**Preuve avant/après (caractérisation)**
19. Un test a-t-il prouvé la vulnérabilité AVANT le correctif ? **Oui** — `emailRoutesAuth.test.js` exécuté sur le code non corrigé : 11/15 échecs (requêtes anonymes/rôles hors politique atteignant réellement le modèle).
20. Une nouvelle capability a-t-elle été créée ? **Non.**
21. Un nouveau rôle a-t-il été créé ? **Non** — `ROLES_DOCS` est une constante déjà existante (RBAC-5).
22. Le tenant scoping a-t-il été modifié ? **Non applicable** — `Email` n'a pas de champ tenant, ni avant ni après.
23. L'ownership a-t-il été modifié ? **Non applicable** — `Email` est une configuration globale, pas de notion de propriétaire par document.
24. `PlatformOperator` a-t-il été touché ? **Non** — aucune référence dans le fichier.
25. Le contrat HTTP authentifié (`ROLES_DOCS`) a-t-il changé ? **Non** — prouvé identique par les tests (`.each` sur `Admin`/`Secretaire`/`Collaborateur` : mêmes codes 200/201, mêmes appels au modèle).
26. IMAP a-t-il été modifié ? **Non** — `zohoImapService.js` non touché ; le cron ne passe jamais par `emailRoutes.js`.
27. SMTP réel a-t-il été modifié ? **Non** — `server/services/emailService.js` non touché.

**Après correctif**
28. Les requêtes anonymes sont-elles bloquées ? **Oui, 401, prouvé par test.**
29. Les tokens invalides sont-ils bloqués ? **Oui, 401, prouvé par test.**
30. Les rôles hors `ROLES_DOCS` authentifiés sont-ils bloqués ? **Oui, 403, prouvé par test.**
31. Les mutations anonymes sont-elles bloquées avant d'atteindre le modèle Mongoose ? **Oui** — chaque test de mutation vérifie explicitement `expect(Email.xxx).not.toHaveBeenCalled()`.
32. Le comportement pour `ROLES_DOCS` authentifié est-il inchangé ? **Oui, prouvé identique par test** (mêmes statuts, mêmes appels modèle).
33. Une nouvelle route a-t-elle été exposée ou retirée ? **Non** — diff limité à l'ajout de middleware.
34. Une variable de production a-t-elle été modifiée ? **Non.**
35. Un accès à la base de production a-t-il eu lieu ? **Non** — tests exécutés avec modèles mockés (`jest.mock('../models/Email')`), aucune connexion DB réelle.

**Gates**
36. `npm run test:unit` passe-t-il en intégralité ? **Oui** — 135 suites, 1528 tests, tous verts (incluant les 15 nouveaux).
37. `npm run architecture:check` est-il vert ? **Oui** — 0 nouvelle violation, 0 cycle, 466 fichiers/1519 arêtes analysés.
38. `npm run lint` (serveur) est-il vert ? **Oui** — 0 erreur, 108 warnings (baseline pré-existante, non liée à ce hotfix).
39. `git diff --check` est-il propre ? **Oui**, à l'exception d'un warning bénin de conversion CRLF→LF sur `emailRoutes.js` (pas une erreur de conflit ni de contenu, exit code 0).

**Git**
40. Un commit a-t-il été effectué ? **Non — instruction permanente de l'utilisateur : ne jamais commit/push, l'utilisateur commite lui-même.**
41. Un push a-t-il été effectué ? **Non.**
42. Une opération git destructive a-t-elle été effectuée ? **Non.**

**Documentation**
43. `ETAT_INITIAL.md` produit ? **Oui.**
44. `ENDPOINT_MATRIX.md` produit ? **Oui.**
45. `AUTH_CONTRACT.md` produit ? **Oui.**
46. `BEHAVIOR_MATRIX.md` produit ? **Oui.**
47. `SECURITY_MATRIX.md` produit ? **Oui.**
48. `REPORT.md` (ce document) produit ? **Oui.**

**Périmètre respecté**
49. Le hotfix a-t-il touché autre chose que `emailRoutes.js` (hors tests/docs) ? **Non** — seul fichier de production modifié.
50. Le risque `.html`/`.svg` (attachment preview) identifié par INBOX-1 a-t-il été traité ici ? **Non, hors périmètre par mandat explicite** — reste candidat pour `HOTFIX-INBOX-SECURITY-2`, non démarré.

## 3. Fichiers modifiés/créés

**Production (1 fichier)** :
- `server/routes/emailRoutes.js` — ajout de 3 lignes (2 imports, 1 `router.use`).

**Tests (1 fichier créé)** :
- `server/__tests__/emailRoutesAuth.test.js` — 15 tests, caractérisation + preuve du correctif.

**Documentation (6 fichiers créés dans `server/docs/`)** :
- `HOTFIX_INBOX_SECURITY1_ETAT_INITIAL.md`
- `HOTFIX_INBOX_SECURITY1_ENDPOINT_MATRIX.md`
- `HOTFIX_INBOX_SECURITY1_AUTH_CONTRACT.md`
- `HOTFIX_INBOX_SECURITY1_BEHAVIOR_MATRIX.md`
- `HOTFIX_INBOX_SECURITY1_SECURITY_MATRIX.md`
- `HOTFIX_INBOX_SECURITY1_REPORT.md` (ce fichier)

Aucun autre fichier touché. Le travail parallèle non lié (`ARCH2A/2B/2C1/2C2`, `HOTFIX-DASHBOARD-DARK-MODE-UI-1`) reste intact et non modifié — confirmé par `git status` avant et après ce hotfix (mêmes fichiers non liés en état modifié/untracked, HEAD inchangé à `a04055f62952c782b92aeef2f100824a17a5f645`).

## 4. Verdict

**CERTIFIÉ VERT.**

Tous les critères de certification du mandat sont remplis : finding revalidé directement, chaîne d'appel auditée, 14 routes inventoriées et classées, appelant unique identifié, absence d'authentification prouvée par test avant correctif, correction minimale appliquée (3 lignes, aucune logique métier touchée), accès anonyme et mutations anonymes bloqués et prouvés, comportement authentifié `ROLES_DOCS` prouvé strictement inchangé, autorisation/tenant/ownership/PlatformOperator/IMAP/SMTP non affectés (par preuve ou par non-applicabilité documentée), aucune nouvelle règle métier ni capability inventée, `architecture:check` vert, suite de tests complète verte, lint sans erreur, `git diff --check` propre, aucune opération git effectuée.

## 5. STOP

Conformément au mandat, ce hotfix s'arrête ici. **`HOTFIX-INBOX-SECURITY-2`** (isolation de la prévisualisation directe des pièces jointes `.html`/`.svg`, identifiée par `INBOX-1` et reconfirmée en risque résiduel dans `HOTFIX_INBOX_SECURITY1_SECURITY_MATRIX.md`) est une piste candidate mais **n'est pas démarrée** et ne le sera pas sans instruction explicite.

**En attente de validation de l'utilisateur avant tout commit.**
