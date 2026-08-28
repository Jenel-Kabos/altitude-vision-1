# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Rapport final

## 1. Résumé

RBAC-FINAL-01 est **fermé**. Le contrat métier a été prouvé (pas supposé) par symétrie sur trois routes sœurs déjà en production (`calendar`, `createBlock`, `deleteBlock`), toutes gardées par `isStaff(4 rôles) || owner===user.id`. `listBlocks` (`GET .../availability-blocks`) était la seule exception. Rouge reproduit (3/12 tests échoués : Client, Proprietaire non-owner, staff hors périmètre), fermé par l'ajout d'une seule ligne de vérification, identique au guard déjà utilisé par ses routes sœurs. La frontière tenant HZ-02 (`authorizedCalendarAccommodation`) n'a pas été touchée. Zéro réduction de capacité Admin/staff/Proprietaire légitime, zéro changement frontend/mobile/schéma.

## 2. Réponses aux 106 questions du mandat

1. **HEAD initial ?** `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé).
2. **Branche ?** `main`.
3. **Worktree initial ?** Non propre, 577 lignes, cumul de sprints antérieurs — inchangé au-delà des fichiers listés en §100-102.
4. **Finding RBAC-FINAL-01 exact ?** `GET /accommodations/:id/availability-blocks` accessible à tout utilisateur authentifié, sans ownership.
5. **Endpoint exact ?** `GET /api/accommodations/:id/availability-blocks`.
6. **Route réellement montée ?** Oui, `routes/accommodationRoutes.js:44`.
7. **Méthode HTTP ?** GET.
8. **Auth middleware ?** `auth.protect` (router-level, via `router.use(auth.protect)` plus haut dans le fichier).
9. **RBAC avant fix ?** Aucun — tout rôle authentifié passait.
10. **Tenant middleware avant fix ?** `requireTenantScopeForStaffAllowPlatformWide` (HZ-02) + `authorizedCalendarAccommodation` dans le contrôleur — déjà correct, non touché.
11. **Ownership avant fix ?** Aucun.
12. **Controller ?** `controllers/accommodationReservationController.js::listBlocks`.
13. **Service ?** Aucun service dédié pour la lecture (contrairement à `createBlock`, qui délègue à `service.createBlock`) — `listBlocks` interroge directement `Block.find(...)`.
14. **Model/query ?** `AccommodationAvailabilityBlock.find({accommodation}).sort({startDate:1}).lean()`.
15. **Données retournées ?** Document complet : `startDate`, `endDate`, `type`, `reason` (texte libre), `createdBy` (ObjectId User).
16. **Données internes ou publiques ?** Internes — `reason` et `createdBy` ne sont jamais exposés par la route publique équivalente (`GET .../availability`).
17. **Route publique d'availability existe ?** Oui — `GET /:id/availability`, monté avant `auth.protect`, dérive `unavailableDates` de `NightLock` (pas du modèle `AvailabilityBlock`).
18. **Consumer frontend ?** `AccommodationReservationsPanel.jsx`, monté uniquement dans `AccommodationDetailPage.jsx` (dashboard staff/propriétaire).
19. **Consumer mobile ?** Aucun (`NOT FOUND`).
20. **Tests existants ?** `accommodationCalendarTenantScope.mongo.integration.test.js` (HZ-02, focus tenant, ne testait pas le rôle Client/non-owner sur `listBlocks`) — gap de couverture confirmé, comblé par la nouvelle suite.
21. **HZ-02 protège quoi exactement ?** L'isolation tenant (Admin A ne peut pas agir sur Accommodation B), via `authorizedCalendarAccommodation`.
22. **HZ-02 reste-t-il correct ?** Oui, revérifié vert (15/15) sans adaptation.
23. **Qui doit légitimement lire les blocks ?** `isStaff` (Admin, Collaborateur, GestionnaireImmobilier, CommunityManager) ou le Proprietaire propriétaire de la ressource — prouvé par symétrie, voir `_EXISTING_CONTRACT.md`.
24. **Qui doit créer ?** Mêmes acteurs — déjà en production (`service.createBlock`).
25. **Qui doit modifier ?** N/A — aucun endpoint UPDATE n'existe.
26. **Qui doit supprimer ?** Mêmes acteurs — déjà en production (`deleteBlock`).
27. **Admin doit-il lire ?** Oui, confirmé — `isStaff` inclut `Admin`.
28. **Admin doit-il écrire ?** Oui, préservé, inchangé.
29. **Proprietaire doit-il lire ?** Oui, s'il possède réellement la ressource — confirmé par symétrie avec CREATE/DELETE.
30. **Ownership requis ?** Oui — `property.owner === user.id`, jamais `role==='Proprietaire'` seul (confirmé par le test "Proprietaire NON-owner → 403").
31. **Staff autorisé exact ?** Admin, Collaborateur, GestionnaireImmobilier, CommunityManager (`isStaff` local à ce contrôleur).
32. **Staff non autorisé ?** Tout autre rôle staff au sens large (`Secretaire`, `Communicant`) — testé et confirmé refusé après fix.
33. **Client doit-il lire les blocks internes ?** Non — aucune preuve de contrat, testé et confirmé refusé après fix.
34. **Unauthenticated ?** 401, mécanisme d'auth existant, inchangé.
35. **PlatformOperator global ?** Autorisé (rôle sous-jacent `Admin`), contrat HZ-02 préservé.
36. **PlatformOperator scoped ?** Autorisé sur le tenant sélectionné, refusé sur un autre (HZ-02, inchangé).
37. **Staff sans tenant ?** 403 fail-closed, déjà correct avant ce hotfix (garde routeur HZ-02), non affecté.
38. **Rouge runtime reproduit ?** Oui.
39. **Combien de tests rouges ?** 3 sur 12.
40. **Quel rôle démontre le bug ?** Client, Proprietaire non-owner, staff hors périmètre (Secretaire).
41. **HTTP avant fix ?** 200 pour les 3 scénarios rouges.
42. **Données visibles avant fix ?** Liste complète des blocages (dates, type, `reason`, `createdBy`) de l'Accommodation ciblée.
43. **Cross-tenant reproduit ?** Non — le gap concernait des acteurs du **même** tenant (ou sans tenant, Client), jamais un franchissement de frontière tenant (déjà fermée par HZ-02).
44. **Ou uniquement RBAC ?** Uniquement RBAC/ownership, confirmé.
45. **Root cause exacte ?** `listBlocks` n'appliquait aucune vérification `isStaff || owner` contrairement à ses 3 routes sœurs sur la même ressource.
46. **Guard canonique existant ?** Oui — `isStaff(req.user) || String(accommodation.property?.owner) === String(req.user.id)`, déjà utilisé par `calendar`/`deleteBlock`/`service.createBlock`.
47. **Guard réutilisé ?** Oui, à l'identique, aucune nouvelle politique.
48. **Correction route-level possible ?** Non pertinente ici — les 3 routes sœurs n'ont pas non plus de garde au niveau routeur ; la vérification vit délibérément dans le contrôleur pour toutes les 4 routes, cohérence préservée.
49. **Controller modifié ?** Oui — `accommodationReservationController.js::listBlocks`, une seule fonction.
50. **Service modifié ?** Non.
51. **Schema modifié ?** Non.
52. **RBAC final ?** Voir `_RBAC_MATRIX.md`.
53. **Tenant behavior changé ?** **NON** — confirmé par 15/15 tests HZ-02 inchangés.
54. **Ownership behavior changé ?** Non élargi ni réduit — l'ownership déjà utilisé par CREATE/DELETE est désormais aussi appliqué à GET, cohérence rétablie, pas un changement de règle.
55. **Admin A→A ?** 200, inchangé.
56. **Admin A→B ?** 404 (tenant, HZ-02), inchangé.
57. **Admin B→A ?** 404, inchangé.
58. **Owner→own ?** 200, inchangé.
59. **Owner→other ?** **403** (corrigé).
60. **Client après fix ?** 403 (corrigé).
61. **Staff autorisé après fix ?** 200, inchangé.
62. **Staff non autorisé après fix ?** 403 (corrigé).
63. **PO global ?** 200, inchangé.
64. **PO scoped ?** 200 sur son tenant, 404 sur un autre, inchangé.
65. **Mutations non autorisées ?** Toujours refusées (déjà correct avant ce hotfix), revérifié.
66. **DB intacte ?** Oui, confirmé par assertion (`Block.findById` non-null après tentative DELETE refusée).
67. **Side effects zéro ?** Oui — pour GET, aucune requête Mongo de lecture exécutée pour un acteur refusé (vérification avant `Block.find`).
68. **Payload autorisé inchangé ?** Oui, strictement identique pour tout acteur toujours autorisé.
69. **HTTP contract autorisé inchangé ?** Oui.
70. **Test rouge devenu vert ?** Oui, 12/12 après fix.
71. **Nombre final tests RBAC ?** 12 (nouvelle suite permanente).
72. **HZ-02 résultat ?** 15/15 PASS.
73. **Accommodation targeted résultat ?** 11 suites / 146 tests — PASS.
74. **HZ-01→HZ-07 résultat ?** 137/137 (au sein du cluster de 9 suites/161 tests incluant HF-FINAL-01).
75. **HF-FINAL-01 24/24 ?** Oui, confirmé.
76. **Backend complet suites ?** 141.
77. **Backend complet tests ?** 1579, tous PASS.
78. **Mongo exhaustif suites ?** **111** — 1er passage 110/111 (1 échec flaky, `propertyModerationTenantScope`, domaine Property sans rapport, confirmé 17/17 vert en isolation) ; 2e passage (propre) **111/111**.
79. **Mongo exhaustif tests ?** **1163**, tous PASS au 2e passage (1er passage 1162/1163, le seul échec étant le test flaky ci-dessus).
80. **Checker ?** Rejoué.
81. **Architecture ?** PASS.
82. **Files ?** 472 (identique).
83. **Edges ?** 1531 (identique).
84. **Cycles ?** 0.
85. **Unresolved ?** 0.
86. **New violations ?** 0.
87. **Lint ?** 0 erreur.
88. **diff-check ?** Propre sur les fichiers de ce mandat.
89. **Frontend modifié ?** **NON.**
90. **Mobile modifié ?** **NON.**
91. **Migration ?** **NON.**
92. **Production mutée ?** **NON.**
93. **messageController.getMessages modifié ?** **NON.**
94. **errorMiddleware modifié ?** **NON.**
95. **HZ-08 modifié ?** **NON.**
96. **HZ-09 modifié ?** **NON.**
97. **Commit ?** **NON.**
98. **Push ?** **NON.**
99. **Deploy ?** **NON.**
100. **RBAC-FINAL-01 fermé ?** **Oui.**
101. **Nouveau finding découvert ?** Non — aucun nouveau finding hors périmètre rencontré pendant ce sprint.
102. **Le finding Messaging ownership reste ouvert ?** Oui — `messageController.getMessages`, non touché, non caractérisé plus avant ici.
103. **Closure re-audit peut-il commencer immédiatement ?** Non recommandé.
104. **Ou faut-il d'abord caractériser Messaging ownership ?** Oui — `MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1` recommandé avant `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1`.
105. **Prochaine étape recommandée ?** `MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1` (caractérisation, pas de correctif automatique), puis seulement `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1`.
106. **Verdict final ?** Voir §3.

## 3. Verdict

**RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 = CERTIFIÉ VERT — RBAC-FINAL-01 CLOSED.**

## 4. Fichiers créés/modifiés

**Code** :
- `server/controllers/accommodationReservationController.js` (modifié — une seule fonction, `listBlocks`)
- `server/__tests__/accommodationAvailabilityBlocksRbac.mongo.integration.test.js` (nouveau, **conservé** comme suite de non-régression permanente)

**Documentation** (`server/docs/`, préfixe `RBAC_ACCOMMODATION_AVAILABILITY_BLOCKS1_`) :
`_ETAT_INITIAL.md`, `_ENDPOINT_MATRIX.md`, `_EXISTING_CONTRACT.md`, `_RED_REPRODUCTION.md`, `_ROOT_CAUSE.md`, `_RBAC_MATRIX.md`, `_TENANT_MATRIX.md`, `_SIDE_EFFECT_MATRIX.md`, `_NON_REGRESSION.md`, `_GATE_MATRIX.md`, `_DECISION.md`, `_REPORT.md` (ce fichier) — les 12 documents requis.

**Aucune mutation de production. Aucun commit, push ou déploiement.**

## 5. STOP

Conformément au mandat, ce sprint s'arrête ici. `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` n'est **pas** lancé — `MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1` est la prochaine étape recommandée.
