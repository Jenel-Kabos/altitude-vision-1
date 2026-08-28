# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Rapport final

## 1. Résumé

`messageController.js::getMessages` (`GET /api/messages/:conversationId`) n'applique **aucune** vérification de participant, de staff-authority ou d'ownership — uniquement une vérification de tenant, optionnelle et sans effet pour les rôles non-staff. Reproduit en conditions réelles (test temporaire, supprimé) : un Client sans aucun lien lit intégralement une conversation privée d'autrui (contenu + identités), et déclenche un effet de bord (`isRead` basculé) ; un staff du bon tenant, non-participant, lit de même une conversation privée d'un collègue, dépassant même l'autorité "boîte partagée" déjà établie ailleurs dans le code. Confirmé comme un endpoint activement utilisé en production par l'application mobile (`ChatScreen.jsx`). **Verdict : A — FIX REQUIRED.** Aucun correctif appliqué, conformément au mandat.

## 2. Réponses aux 84 questions du mandat

1. **HEAD ?** `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé).
2. **Branche ?** `main`.
3. **Worktree initial ?** Non propre, 590 lignes, cumul de sprints antérieurs — inchangé au-delà des 12 documents créés.
4. **Route exacte ?** `messageController.getMessages`.
5. **URL finale ?** `GET /api/messages/:conversationId`.
6. **Method ?** GET.
7. **Mounted ?** Oui, LIVE — `server.js:547` → `routes/messageRoutes.js:51`.
8. **Auth middleware ?** `protect` (router-level).
9. **Tenant middleware ?** `requireTenantScopeForStaffOrPlatformOperator` (ajoutée par HF-FINAL-01) + `assertResourceTenantOrUnattributed` dans le contrôleur (uniquement si `req.platformTenant` résolu).
10. **RBAC middleware ?** Aucun.
11. **Controller exact ?** `controllers/messageController.js::getMessages`, lignes 280-362.
12. **Service exact ?** Aucun — requête Mongo directe dans le contrôleur.
13. **Query exacte ?** `Conversation.findById(conversationId)` puis `Message.find({conversation, ...})` puis `Message.updateMany({conversation, sender:{$ne:me}, isRead:false}, {isRead:true, readAt:now})`.
14. **Conversation chargée avant messages ?** Oui, à l'étape 2 (voir `_ENDPOINT_FLOW.md`).
15. **Participant check ?** **Aucun.**
16. **Staff check ?** **Aucun.**
17. **Tenant check ?** Oui, mais uniquement si `req.platformTenant` résolu (jamais pour Client/Proprietaire), et vérifie uniquement la correspondance tenant, jamais l'appartenance à la conversation.
18. **Ownership check ?** **Aucun.**
19. **Client peut appeler ?** Oui, et obtient une lecture complète même sans lien — **reproduit**.
20. **Proprietaire ?** Oui, même chemin de code exact que Client — déduit, non re-testé séparément (comportement identique confirmé par lecture).
21. **Staff ?** Oui, et obtient une lecture complète même sans être participant d'une conversation privée d'un collègue — **reproduit**.
22. **Admin ?** Même chemin que "Staff" (rôle inclus dans `ALL_STAFF`) — non re-testé séparément, comportement identique par construction du code.
23. **PO global ?** Oui, déduit du même chemin de code (aucune vérification participant), non re-testé explicitement ce sprint — `NON CONFIRMÉ` par reproduction directe, mais cohérent avec le reste de l'analyse.
24. **PO scoped ?** Idem, `NON CONFIRMÉ` par reproduction directe pour ce cas précis, déduit du code.
25. **Same-tenant non-participant Client peut lire ?** Oui — reproduit.
26. **Same-tenant non-participant Proprietaire ?** Déduit (même chemin), non re-testé séparément.
27. **Same-tenant non-participant staff ?** Oui — reproduit.
28. **Cross-tenant Client ?** Non pertinent — Client n'a jamais de tenant, la notion de "cross-tenant" ne s'applique pas à ce rôle sur cet endpoint (déjà établi par HF-FINAL-01/POST-E2E-1).
29. **Cross-tenant staff ?** Bloqué (403) — déjà fermé par HF-FINAL-01, non affecté, non régressé.
30. **HF-FINAL-01 protège quoi ici ?** Uniquement la résolution du tenant (ambigu/absent → 403 pour staff/PO). Ne protège pas la dimension participant.
31. **Multi no header = 403 ?** Oui, confirmé inchangé (test HF-FINAL-01 toujours vert).
32. **Header A/B ?** Comportement HF-FINAL-01 inchangé, non re-testé dans ce sprint (hors périmètre, déjà certifié).
33. **Invalid header ?** Idem, déjà certifié par HF-FINAL-01, non re-testé ici.
34. **ConversationId seul suffit-il ?** **Oui, entièrement confirmé** — voir `_PARTICIPANT_MATRIX.md`.
35. **ObjectId arbitrary exploitable ?** Oui — aucune barrière au-delà du format (regex 24 hex).
36. **Rouge runtime reproduit ?** Oui, 2 scénarios (Client non-participant, staff non-participant).
37. **Quel acteur ?** Client (rôle le moins privilégié) et Staff (Collaborateur, même tenant, non-participant).
38. **HTTP ?** 200 dans les deux cas.
39. **Messages retournés ?** Oui, contenu complet + sender/receiver peuplés (nom, email, `isActive`).
40. **Attachments metadata ?** Exposés si présents (type, nom, taille, URLs preview/download) — le contenu binaire réel reste protégé séparément par `downloadAttachment` (vérifié correct, non affecté).
41. **PII exposée ?** Oui — nom et email de l'expéditeur et du destinataire, tous deux étrangers à l'appelant dans les scénarios reproduits.
42. **Root cause ?** Absence totale de vérification `participants.includes`/staff-scopée dans `getMessages`, contrairement à toutes ses fonctions sœurs du même domaine.
43. **Participant authority manquante ?** Oui, confirmé.
44. **Staff authority déjà implicite ?** Non pour ce cas précis — le contrat déjà établi (`getStaffInbox`) limite l'autorité staff à la boîte partagée, jamais aux conversations privées d'un collègue ; `getMessages` dépasse ce contrat par absence de contrôle, pas par une politique métier documentée.
45. **Contrat métier trouvé où ?** `assertConversationAccess` (`conversationController.js`), `downloadAttachment` (`messageController.js`), `getStaffInbox`/`getConversations`/`getMyInbox` — toutes appliquent une vérification participant/staff, prouvant le contrat attendu par symétrie.
46. **Tests existants ?** Aucun pour `getMessages` — voir `_TEST_COVERAGE.md`.
47. **Gaps de tests ?** Total — jamais aucun test dédié à cette fonction dans l'historique du projet.
48. **Side effect read ?** Oui — `Message.updateMany` mute `isRead`/`readAt`.
49. **unread modifié ?** Oui, via le même `updateMany` (le compteur non-lu global dépend de `isRead`).
50. **lastRead modifié ?** Le champ `readAt` est mis à jour ; pas de champ `lastRead` distinct sur ce modèle.
51. **HZ-08 impliqué ?** Non — aucune conversation `unresolved`/legacy engagée dans la reproduction.
52. **errorMiddleware impliqué ?** Non — le chemin vulnérable réussit (200), pas d'erreur à sérialiser.
53. **Exploitability ?** `CONFIRMED_RUNTIME`.
54. **Severity ?** `P0`.
55. **FIX REQUIRED ?** **Oui.**
56. **Expected behavior ?** Non — aucune preuve de contrat justifiant cet accès, au contraire (contredit par symétrie avec le reste du domaine).
57. **Already protected ?** Non.
58. **Reclassify ?** Non applicable — le verdict FIX REQUIRED est direct.
59. **Hotfix futur nécessaire ?** Oui.
60. **Nom exact ?** `HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1`.
61. **Invariant du futur hotfix ?** `getMessages` doit exiger `participants.includes(req.user.id)` OU (`ALL_STAFF.includes(req.user.role)` ET tenant correspondant ET, idéalement, restriction à `isStaffInbox` ou aux conversations dont le staff est réellement participant, pour rester cohérent avec `getStaffInbox`) — invariant à affiner lors du hotfix, pas décidé ici (mandat §47 : "définir seulement invariant/surface/guard probable, ne pas implémenter").
62. **Frontend devra changer ?** Non anticipé — le contrat HTTP (200/403/404, payload) resterait inchangé pour tout appelant légitime.
63. **Mobile devra changer ?** Non anticipé, pour la même raison — `ChatScreen.jsx` n'appelle cet endpoint que pour des conversations auxquelles l'utilisateur a déjà accès via sa propre liste.
64. **Schema devra changer ?** Non.
65. **Migration ?** Non.
66. **HF-FINAL-01 tests résultat ?** 24/24 PASS, inchangé.
67. **Messaging tests résultat ?** 5 suites / 54 tests — PASS, inchangé.
68. **Checker ?** Rejoué, identique.
69. **Architecture ?** PASS, identique (472 fichiers, 1531 edges, 0 cycle, 0 unresolved, 0 nouvelle violation).
70. **diff-check ?** Identique — 4 avertissements CRLF pré-existants, aucun nouveau.
71. **Test temporaire supprimé ?** Oui, confirmé par `git status`.
72. **Code production modifié ?** **NON.**
73. **Tests métier persistants modifiés ?** **NON.**
74. **Frontend modifié ?** **NON.**
75. **Mobile modifié ?** **NON.**
76. **Schema modifié ?** **NON.**
77. **Production utilisée ?** **NON** — reproduction sur `MongoMemoryReplSet` éphémère uniquement.
78. **Commit ?** **NON.**
79. **Push ?** **NON.**
80. **Deploy ?** **NON.**
81. **Assessment complet ?** Oui, sur le périmètre exact du mandat (`getMessages`). `sendMessage` (voisin) noté `NON CONFIRMÉ` au même niveau de détail, hors périmètre exact.
82. **Closure re-audit peut-il démarrer immédiatement ?** **Non.**
83. **Ou hotfix Messaging requis avant ?** **Oui.**
84. **Verdict final ?** Voir §3.

## 3. Verdict

**A. AUDIT CERTIFIÉ — FIX REQUIRED.**

## 4. Fichiers créés

`server/docs/MESSAGING_MESSAGE_READ_AUTHORITY_ASSESSMENT1_ETAT_INITIAL.md`, `_ENDPOINT_FLOW.md`, `_AUTHORITY_MODEL.md`, `_ROLE_MATRIX.md`, `_PARTICIPANT_MATRIX.md`, `_REPRODUCTION.md`, `_ROOT_CAUSE.md`, `_EXPLOITABILITY.md`, `_TEST_COVERAGE.md`, `_DECISION.md`, `_GATE_MATRIX.md`, `_REPORT.md` (ce fichier) — les 12 documents requis. Un test temporaire (`__tests__/_tmp_messageReadAuthority.mongo.integration.test.js`) a été créé, exécuté, puis **supprimé** avant la fin, conformément au mandat.

**Aucun code de production modifié. Aucune mutation de production. Aucun commit, push ou déploiement.**

## 5. STOP

Conformément au mandat, cet assessment s'arrête ici. `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` n'est **pas** lancé. Prochaine étape recommandée : `HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1`.
