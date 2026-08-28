# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Rapport final

## 1. Résumé

HF-FINAL-01 (P0, cross-tenant Messaging pour staff à contexte tenant ambigu) est **fermé**. Cause racine : `conversationController.js`/`messageController.js` traitaient l'absence de tenant résolu comme « rien à vérifier » plutôt que « refuser ». Correctif : réutilisation de la frontière canonique déjà existante et déjà prouvée sûre (`requireTenantScopeForStaffOrPlatformOperator`, celle qui protège déjà `/count/unread`) sur les 7 endpoints démontrés vulnérables — **aucune ligne de contrôleur/service modifiée**, uniquement du câblage de routeur (2 fichiers : `conversationRoutes.js`, `messageRoutes.js`). Reproduction rouge (12/24 tests échoués) archivée puis fermée (24/24 verts). Zéro changement RBAC, zéro changement de règle métier, zéro changement serializer/Socket.IO, zéro régression sur HZ-01→HZ-07 (137/137) ni sur le backend complet (1579/1579).

## 2. Réponses aux 108 questions du mandat

1. **HEAD ?** `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé, aucun commit).
2. **Branche ?** `main`.
3. **Worktree initial ?** Non propre, 562 lignes, cumul de sprints antérieurs non commités — inchangé par ce hotfix au-delà des fichiers listés en §102.
4. **HF-FINAL-01 exact ?** Accès cross-tenant en lecture/suppression/écriture sur la messagerie staff partagée pour un staff à contexte tenant ambigu (multi-tenant sans en-tête, ou sans aucune adhésion), démontré runtime lors de `TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1`.
5. **Routes exactes ?** `GET/DELETE/PATCH /api/conversations/:conversationId*`, `GET /api/conversations/staff-inbox`, `POST /api/messages`, `GET /api/messages/:conversationId` — voir `_ENDPOINT_MATRIX.md`.
6. **Combien LIVE ?** 16 endpoints inventoriés dans `conversationRoutes.js`+`messageRoutes.js`, tous LIVE (aucune route morte dans ce domaine).
7. **Staff inbox route ?** `GET /api/conversations/staff-inbox` → `getStaffInbox`.
8. **Detail route ?** `GET /api/conversations/:conversationId` → `getConversationById`.
9. **Delete route ?** `DELETE /api/conversations/:conversationId` → `deleteConversation`.
10. **Send route ?** `POST /api/messages` → `sendMessage` (chemin `conversationId`).
11. **Unread route ?** `GET /api/conversations/count/unread` → `getUnreadCount` (déjà sûre, référence canonique).
12. **RBAC actuel ?** Inchangé — voir `_RBAC_MATRIX.md`.
13. **Quels rôles staff ?** Tout rôle de `ALL_STAFF` (Admin + sous-rôles collaborateurs).
14. **Admin concerné ?** Oui, comme tout rôle staff — même règle, aucune exception.
15. **PO concerné ?** Oui — PlatformOperator suit désormais le même contrat que le staff sur ce domaine (jamais de mode plateforme natif pour Messaging, cohérent avec `/count/unread`).
16. **Client concerné ?** Non affecté — le garde ajouté est un no-op total pour ce rôle (`requireWhen` renvoie `false`).
17. **Proprietaire concerné ?** Idem Client.
18. **Source du tenant ?** `req.platformTenant`, résolu par `resolveEffectiveTenantContext`/`resolveAndAttachTenantScope` (`services/platformTenant/tenantContextService.js`).
19. **Header exact ?** `X-Platform-Tenant-Id` (ou `X-Tenant-Id`, alias reconnu par `requestedTenant()`).
20. **Resolver exact ?** `resolveEffectiveTenantContext(userId, requestedTenantId)`, appelé via `resolveAndAttachTenantScope` dans `middleware/tenantContext.js`.
21. **Single-tenant auto-resolution ?** Oui, préservée — `tenants.length === 1` → `source:'single_membership'`, résolu automatiquement, comportement historique inchangé.
22. **Multi-tenant sans header ?** `tenants.length > 1` sans `requestedTenantId` → `resolveEffectiveTenantContext` retourne `null` (ambiguïté), comportement de conception préexistant et inchangé — c'est la garde routeur qui a changé, pas ce resolver.
23. **Avant fix, tenant undefined ?** Confirmé — `activeTenantId(req)` était `undefined`, `req.platformTenant` était `null`.
24. **Controller skip check confirmé ?** Oui, confirmé par lecture directe du code AVANT modification (voir `_ROOT_CAUSE.md`) et par la reproduction rouge.
25. **Pourquoi unread fail-close ?** Parce que `requireTenantScopeForStaffOrPlatformOperator` était déjà appliquée à cette route précise, contrairement aux autres.
26. **Quelle différence de code ?** L'absence de ce même middleware au niveau routeur sur les 7 autres endpoints — aucune différence dans la logique de resolution du tenant elle-même.
27. **Rouge list reproduit ?** Oui — `GET /staff-inbox` renvoyait 200 avec les deux tenants mélangés.
28. **HTTP ?** 200 avant fix, 403 après (voir `_RED_REPRODUCTION.md` pour les valeurs exactes).
29. **Rouge detail reproduit ?** Oui — `GET /:conversationId` (B) renvoyait 200 avec le contenu complet de B.
30. **Rouge delete reproduit ?** Oui — `DELETE /:conversationId` (B) renvoyait 200, suppression réelle confirmée en DB.
31. **Conversation supprimée ?** Oui, confirmé (`Conversation.findById` → `null` après l'appel, avant fix).
32. **Rouge send reproduit ?** Oui — `POST /api/messages` (conversationId=B) renvoyait 201, message réellement créé.
33. **Message créé cross-tenant ?** Oui, confirmé (`Message.countDocuments` incrémenté, `lastMessage` de B écrasé, avant fix).
34. **Notifications ?** Non testées explicitement en isolation (le message étant refusé après fix, `notify`/`notifyStaff` ne sont jamais invoqués — code inatteignable, voir `_SIDE_EFFECT_MATRIX.md`).
35. **Socket ?** Idem — `getIO().emit(...)` jamais atteint pour une tentative refusée, ni avant ni après le fix pour le cas heureux/refusé respectivement.
36. **Test rouge archivé ?** Oui — `_RED_REPRODUCTION.md`, avec les nombres exacts (12/24 échoués avant, 24/24 après).
37. **Root cause exacte ?** `if (activeTenantId(req)) {...}` / `if (req.platformTenant) {...}` traités comme un skip plutôt qu'un refus, dans `assertConversationAccess`, `tenantConversationFilter`, `keepAttributedConversations`, `sendMessage` — voir `_ROOT_CAUSE.md`.
38. **Primitive canonique réutilisable ?** Oui — `requireTenantScopeForStaffOrPlatformOperator` (`middleware/tenantContext.js`), déjà utilisée par `/count/unread`.
39. **Correction minimale ?** Oui — uniquement du câblage de routeur (Option C du mandat §30 : réutilisation du guard de `/count/unread`), aucune ligne de contrôleur/service modifiée.
40. **Nombre fichiers production modifiés ?** 2 (`routes/conversationRoutes.js`, `routes/messageRoutes.js`).
41. **Middleware ajouté ?** Non — middleware **existant** réutilisé (`requireTenantScopeForStaffOrPlatformOperator`), pas de nouveau middleware créé.
42. **Controller modifié ?** **Non.**
43. **Service modifié ?** **Non.**
44. **Query modifiée ?** **Non** — aucune requête Mongo n'a été changée ; les requêtes vulnérables ne sont simplement plus jamais exécutées pour un contexte ambigu (bloquées avant, au niveau routeur).
45. **Staff multi no header après fix ?** 403 sur toutes les surfaces corrigées.
46. **403 ?** Oui, confirmé par les 24 tests.
47. **Header A ?** `GET /staff-inbox` avec `X-Platform-Tenant-Id`=A → 200, conversation A uniquement.
48. **A only ?** Oui, confirmé (`ids === [convA._id]`).
49. **Header B ?** Symétrique, confirmé.
50. **B only ?** Oui, confirmé.
51. **Invalid header ?** Tenant sans adhésion → 403, confirmé (test "en-tête invalide").
52. **Fail-closed ?** Oui.
53. **Staff A detail B ?** Refusé — **500** (pas 403/404, voir §54 pour l'explication), zéro fuite de données.
54. **HTTP ?** 500 — comportement **pré-existant**, indépendant de ce hotfix (`errorMiddleware.js` ne reconnaît pas le nom de l'erreur levée par `assertResourceTenantOrUnattributed` et ne lit jamais `err.statusCode` génériquement). Documenté comme `NEW_MESSAGING_FINDING_OUT_OF_SCOPE`, non corrigé ici.
55. **Staff A delete B ?** Refusé — 500 (même raison), zéro suppression confirmée par assertion DB.
56. **DB intacte ?** Oui, confirmé (`Conversation.findById(convB._id)` non-null après tentative).
57. **Staff A send B ?** Refusé — 500 (même raison), zéro message créé confirmé par assertion DB.
58. **Message absent ?** Oui, confirmé (`Message.countDocuments` = 0).
59. **Notification absente ?** Oui — code jamais atteint (l'erreur est levée avant la section notification/socket du contrôleur).
60. **Socket absent ?** Oui, même raison.
61. **PO global préservé ?** Non applicable tel quel — PO global (aucune sélection) est désormais **bloqué (403)**, exactement comme un staff ambigu, car Messaging n'a **jamais** eu de contrat de portée globale native (contrairement à Reporting/Dashboard Analytics, les deux seuls domaines qui le supportent, per commentaire source de `tenantContext.js`). Ce n'est donc pas une régression d'un mode légitime, mais la fermeture du même bug pour cet acteur.
62. **PO scoped A ?** 200, A uniquement, confirmé.
63. **PO scoped B ?** 200, B uniquement, confirmé.
64. **Admin capabilities changées ?** **NON.**
65. **RBAC changé ?** **NON.**
66. **Serializer changé ?** **NON** — `messageSerializer.js` non touché, ses tests passent sans adaptation.
67. **Socket payload changé ?** **NON.**
68. **Attachments policy changée ?** **NON.**
69. **HZ-08 modifié ?** **NON**, non touché, non retouché.
70. **HZ-09 modifié ?** **NON**, non touché.
71. **availability-blocks RBAC modifié ?** **NON** — RBAC-FINAL-01 explicitement hors périmètre, non touché.
72. **HZ cluster ?** Rejoué.
73. **Résultat ?** **8 suites / 137 tests — PASS**, identique à l'état pré-hotfix.
74. **Messaging targeted ?** Rejoué (existants + nouveau).
75. **Résultat ?** **5 suites / 54 tests — PASS.**
76. **ARCH-2C2 regression ?** Aucune — `messageSerializer.test.js` vert sans adaptation.
77. **Résultat ?** PASS.
78. **Backend complet ?** Rejoué.
79. **Suites ?** 141.
80. **Tests ?** 1579, tous PASS.
81. **Mongo exhaustif ?** Rejoué.
82. **Suites ?** **110** (+1 par rapport à la baseline connue de 109, exactement l'ajout de la nouvelle suite permanente).
83. **Tests ?** **1151**, tous PASS (+24 par rapport à la baseline connue de 1127, exactement les 24 tests de `messagingTenantAmbiguousStaff.mongo.integration.test.js`) — aucune régression sur les 1127 tests pré-existants.
84. **Checker ?** Rejoué.
85. **Architecture PASS ?** Oui.
86. **Files ?** 472 (identique).
87. **Edges ?** 1531 (identique).
88. **Cycles ?** 0 (identique).
89. **Unresolved ?** 0 (identique).
90. **New violations ?** 0.
91. **Lint ?** 0 erreur.
92. **Warnings ?** 108, identiques, aucun nouveau, aucun sur les fichiers modifiés.
93. **diff-check ?** Propre — 1 avertissement CRLF pré-existant sur `messageRoutes.js`, sans rapport avec le contenu ajouté.
94. **Frontend modifié ?** **NON.**
95. **Mobile modifié ?** **NON.**
96. **Schema modifié ?** **NON.**
97. **Migration ?** **NON.**
98. **Production utilisée ?** **NON** — tous les tests utilisent `MongoMemoryReplSet` éphémère.
99. **Commit ?** **NON.**
100. **Push ?** **NON.**
101. **Deploy ?** **NON.**
102. **HF-FINAL-01 entièrement fermé ?** **Oui**, sur les 7 endpoints démontrés vulnérables par l'audit final.
103. **Une autre route Messaging a le même bug ?** Non trouvée au-delà des 7 déjà corrigées — `getMessages`/`markAsRead`/`deleteMessage` (messageController) et `getConversations`/`getMyInbox` (les deux contrôleurs) sont bornés indépendamment (ownership stricte ou participant), non affectés par l'ambiguïté tenant.
104. **Nouveau finding ?** Oui, deux, tous deux **non corrigés** (hors périmètre, cause racine différente) : (a) `messageController.js::getMessages` n'a aucune vérification participant/staff même en tenant résolu ; (b) `errorMiddleware.js` renvoie 500 au lieu de 404 pour les erreurs `assertResourceTenant*` (nom d'erreur non reconnu). Voir `_ROOT_CAUSE.md`.
105. **RBAC-FINAL-01 reste séparé ?** Oui, non touché, non mentionné dans le diff.
106. **Campagne tenant peut-elle être clôturée après ce hotfix ?** **Non** — un sprint RBAC dédié pour RBAC-FINAL-01 puis un nouvel audit de clôture restent nécessaires, conformément à `TENANT_SCOPE_HORIZONTAL_FINAL_AUDIT1_DECISION.md`.
107. **Prochaine étape exacte ?** `RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1`, puis `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` (certification finale). Pas de `RELEASE-CONSOLIDATION-SECURITY-1` avant ces deux étapes.
108. **Verdict final ?** Voir §3.

## 3. Verdict

**HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 = CERTIFIÉ VERT.**

Rouge runtime archivé, correction minimale (câblage de routeur uniquement, réutilisation de la frontière canonique déjà prouvée), les 4 acteurs ambigus (staff multi-tenant, staff sans adhésion, PlatformOperator non scopé, en-tête invalide) sont désormais fail-closed (403) sur les 7 endpoints démontrés vulnérables, sans aucune régression sur les cas déjà sûrs (staff mono-tenant, staff scopé explicitement, client, propriétaire, PlatformOperator scopé). RBAC, règles métier de messagerie, serializer et contrat Socket.IO strictement inchangés. HZ-01→HZ-07 et backend complet inchangés. Architecture et lint stables.

## 4. Fichiers créés/modifiés

**Code** :
- `server/routes/conversationRoutes.js` (modifié)
- `server/routes/messageRoutes.js` (modifié)
- `server/__tests__/messagingTenantAmbiguousStaff.mongo.integration.test.js` (nouveau, **conservé** comme suite de non-régression permanente, conformément au mandat §22)

**Documentation** (`server/docs/`, préfixe `HOTFIX_MESSAGING_TENANT_AMBIGUOUS_STAFF1_`) :
`_ETAT_INITIAL.md`, `_ENDPOINT_MATRIX.md`, `_RBAC_MATRIX.md`, `_TENANT_FLOW.md`, `_RED_REPRODUCTION.md`, `_ROOT_CAUSE.md`, `_SECURITY_MATRIX.md`, `_SIDE_EFFECT_MATRIX.md`, `_BEHAVIOR_CONTRACT.md`, `_NON_REGRESSION.md`, `_GATE_MATRIX.md`, `_REPORT.md` (ce fichier) — les 12 documents requis.

**Aucune mutation de production. Aucun commit, push ou déploiement. Aucune consolidation de release entamée.**

## 5. STOP

Conformément au mandat, ce sprint s'arrête ici. Aucun autre sprint n'a été entamé (RBAC-FINAL-01 non touché, HZ-08/HZ-09 non retouchés, aucune consolidation de release).
