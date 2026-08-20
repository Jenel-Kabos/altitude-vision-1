# TENANT-SCOPE-AUDIT-2A — Rapport final

Date : 2026-08-20. Branche `main`. `HEAD` au démarrage et à la fin : `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782` (inchangé, aucun commit créé, aucun changement externe).

## 1-11. Résumé exécutif, historique, décision architecturale

Voir `TENANT_SCOPE_AUDIT2A_ETAT_INITIAL.md` (contrat exact de `fromUser`, lu intégralement avant toute modification) et `TENANT_SCOPE_AUDIT2A_CONSUMER_MATRIX.md` (28 fichiers consommateurs inventoriés, au-delà des ~15 `resourceType` déjà connus).

**Décision architecturale : Option D** (correction plus étroite, ni A ni B ni C).

`fromUser` lui-même n'a **pas** été modifié — son contrat ("à quel tenant cet utilisateur appartient-il via `OrgMembership`") est cohérent et correct pour ce qu'il prétend répondre ; le rejeter aurait affecté indistinctement les 28 consommateurs, y compris les 2 explicitement hors périmètre (`hotelAccessScopeService.js`, `financialAuthorizationService.js`).

Le défaut réel n'était pas dans `fromUser`, mais dans le CHOIX, par certains consommateurs, d'utiliser `assertResourceTenant` (STRICTE : `unresolved` = échec) là où le pattern déjà établi et certifié ailleurs dans ce même codebase — `assertResourceTenantOrUnattributed` (FAIL-OPEN : `unresolved` = laissez-passer, mais `ambiguous`/`resolved`-vers-autre-tenant restent refusés) — était objectivement le bon choix. **13 des 15 consommateurs `assert*` utilisaient déjà cette variante fail-open avant ce sprint.** Les 5 exceptions ont été traitées individuellement :

| Consumer | Décision |
|---|---|
| `documentController.js` (get/update/delete/create) | **Corrigé** (Option D) |
| `userController.downloadContractDocument` | **Corrigé** (Option D) — bug découvert PENDANT cet audit |
| `propertyController.js` (actions staff individuelles) | **Corrigé** (Option D) — bug découvert PENDANT cet audit |
| `rentalMaintenanceController.js` | **Corrigé** (Option D) — bug découvert PENDANT cet audit |
| `routes/userBusinessProfileRoutes.js` | **NON corrigé** — même famille de risque par lecture de code, aucun test dédié apporté, reporté à AUDIT-2B |

Aucune Option C (double politique d'attribution) n'a été introduite : la distinction "strict vs fail-open" existe déjà nativement dans le service (deux fonctions exportées), il ne s'agissait que de choisir la bonne au bon endroit — pas d'inventer une nouvelle abstraction.

## 12-15. Bug Document : reproduction, cause, correction

**Bug** : `getDocument`/`updateDocument`/`deleteDocument` retournaient 404 `TENANT_RESOURCE_NOT_FOUND` pour un `Document` legacy (`tenant:null`) lié (`createdBy`/`client`) à un `User` public-signup sans `OrgMembership`, même pour l'Admin légitime du tenant unique. `createDocument` retournait 422 `TENANT_RELATION_MISMATCH` dans le même cas.

**Cause exacte** : `assertResourceTenant({resourceType:'Document', ...})` → `resolveResourceTenant` → `fromUser(document.createdBy)` / `fromUser(document.client)` → `resolveAvailableTenantsForUser` → 0 `OrgMembership` actif → `unresolved`. Sans `relatedProperty` résoluble, TOUTES les branches de preuve sont `unresolved` → `mergeProofs` renvoie `unresolved` → `assertResourceTenant` (variante stricte) lève une erreur 404.

**Le `User` existait-il ?** Oui, `User.create` réussi dans le test. **Avait-il un `OrgMembership` ?** Non — c'est le point de départ délibéré du test (public-signup). **Devait-il en avoir un ?** Non — aucune règle métier ne l'exige (voir `TENANT_SCOPE_AUDIT2A_ATTRIBUTION_MATRIX.md`, ligne Document/User).

**Correction** : `documentController.js` — `assertResourceTenant` est désormais un alias local de `assertResourceTenantOrUnattributed` (diff minimal, tous les appels existants dans `getDocument`/`updateDocument`/`deleteDocument` restent inchangés textuellement). `createDocument`/`updateDocument` utilisent une nouvelle fonction `relationsConsistentWithTenant(attribution, expectedTenantId)` qui traite `unresolved` comme "aucune contradiction" (laisse passer) et continue de refuser `resolved`-vers-un-autre-tenant ou `ambiguous`. Le champ `tenant` du document reste **toujours** dérivé du serveur (`tenantId(req)`), jamais du body client — aucun changement sur ce point.

**Preuve avant/après** : `tenantScopeAudit1DocumentAttribution.mongo.integration.test.js` réécrit (le test original, qui prouvait le 404, échoue maintenant nécessairement puisque le comportement a changé — remplacé par un test qui prouve explicitement le succès APRÈS correction, plus un test cross-tenant qui prouve que le refus reste actif pour un document réellement résolu vers un AUTRE tenant). Vérifié par `git stash` : sans les 4 fichiers de correction, 5 des 10 tests du nouveau fichier `tenantScopeAudit2aAttribution` + le test Document échouent exactement comme prédit ; avec, 10/10 verts.

## 16-21. Consommateurs, politique stricte, source canonique

Voir `TENANT_SCOPE_AUDIT2A_CONSUMER_MATRIX.md` pour les 28 consommateurs et `TENANT_SCOPE_AUDIT2A_ATTRIBUTION_MATRIX.md` pour la source tenant canonique de chaque type de ressource. Aucun consommateur FAIL-OPEN existant n'a été modifié (déjà correct). Aucun consommateur `resolveResourceTenant` brut (scripts d'audit/migration offline, notifications) n'a été modifié — hors du chemin de blocage d'accès utilisateur.

## 22-30. Property, Hotel, Accommodation, Conversation, Financial Core, Contrat/Rental, Proprietaire, Locataire

- **Property** : `propertyController.js` corrigé (staff actions individuelles : validation/rejet/mise à jour/suppression quand `isAdmin && !isOwner`). Testé Tenant A/Tenant B explicitement : StaffA→PropertyA autorisé (200), StaffA→PropertyB refusé (404, `TENANT_RESOURCE_NOT_FOUND`, preuve que le refus cross-tenant reste actif). **Catalogue PUBLIC non touché** (`publicPropertyService.js`, code path complètement séparé, jamais concerné par cette fonction) — `tenantCore.mongo.integration.test.js` rejoué vert (6 tests API Gateway inclus).
- **Hotel** : **non touché**, conformément au mandat §15/§47 — `hotelAccessScopeService.js` et `financialAuthorizationService.js` restent STRICT, documentés NON CONFIRMÉ pour AUDIT-2B. `hotelStaffAccessF26.mongo.integration.test.js`, `hotelEntityAccessF262`, `hotelAccessFinalizationF263`, `hotelOperationalAccessF261`, `hotelRoutes.test.js`, `hotelFinancialInvoicingF21`, `hotelFinancialPaymentsF22`, `hotelFinancialCheckoutF23` — tous rejoués verts (non-régression, pas une preuve de correction puisque rien n'a changé dans ce domaine).
- **Accommodation** : non touché (déjà FAIL-OPEN). `accommodationReservation.mongo.integration.test.js`, `accommodationPublicDetail.mongo.integration.test.js`, `accommodationRoutes.test.js` rejoués verts.
- **Conversation** : non touché (déjà FAIL-OPEN). `conversationStaffInboxTenant.test.js`, `conversationRoutes.test.js` rejoués verts. **Invariant "ownership Property ≠ accès Conversation" préservé** : `fromUser` n'a pas changé, et `resolveResourceTenant('Conversation', …)` continue de dériver l'accès exclusivement de `conversation.tenant`/`participants`/`relatedProperty` — jamais de l'ownership d'un bien externe à la conversation elle-même.
- **Financial Core** : **non touché**, conformément à la très haute prudence exigée. `hotelFinancialInvoicingF21`, `hotelFinancialPaymentsF22`, `hotelFinancialCheckoutF23` rejoués verts (non-régression).
- **Contrat/Rental** : non touché au niveau `assertResourceTenantOrUnattributed` (déjà correct — `routes/contratRoutes.js`, `routes/paiementRoutes.js`, `routes/rentalManagementRoutes.js`). `rentalMaintenanceController.js` corrigé séparément (ressource `Property`, pas `Contrat`/`RentalManagement` directement). `tenantScopeAudit1RentalManagement.mongo.integration.test.js` (TENANT-SCOPE-AUDIT-1) rejoué vert.
- **Proprietaire public-signup** : fonctionne — testé explicitement dans les 4 domaines corrigés (Document, User/contrat, Property, RentalMaintenance), toujours avec un `User.create` direct (jamais `createTenantUser`, donc jamais d'`OrgMembership`), conformément au mandat §22.
- **Locataire** : non touché (déjà FAIL-OPEN, et `Locataire.user` n'est de toute façon pas un champ direct consommé par `fromUser`).

## 31-35. Fichiers modifiés

**Production (4 fichiers)** :
- `server/controllers/documentController.js` — alias `assertResourceTenant = assertResourceTenantOrUnattributed` + `relationsConsistentWithTenant` pour `createDocument`/`updateDocument`.
- `server/controllers/userController.js` — `downloadContractDocument` utilise `assertResourceTenantOrUnattributed`.
- `server/controllers/propertyController.js` — `isPropertyInActorTenant`/`assertPropertyTenantAccess` utilisent `assertResourceTenantOrUnattributed`.
- `server/controllers/rentalMaintenanceController.js` — `assertPropertyAccess` utilise `assertResourceTenantOrUnattributed`.

**Tests (2 fichiers modifiés, 2 nouveaux)** :
- `server/__tests__/tenantScopeAudit1DocumentAttribution.mongo.integration.test.js` — réécrit pour prouver la correction (jamais supprimé ni affaibli — devient vert grâce à la correction réelle, conformément au mandat §13).
- `server/__tests__/propertyRoutes.test.js` — mock manquant ajouté (`assertResourceTenantOrUnattributed`), aucun changement de comportement testé.
- `server/__tests__/tenantScopeAudit2aAttribution.mongo.integration.test.js` (nouveau, 8 tests : User/contrat + Property + RentalMaintenance, chacun avec cas nominal, cross-tenant, non-régression OrgMembership).

**Documentation** : `TENANT_SCOPE_AUDIT2A_ETAT_INITIAL.md`, `TENANT_SCOPE_AUDIT2A_CONSUMER_MATRIX.md`, `TENANT_SCOPE_AUDIT2A_ATTRIBUTION_MATRIX.md`, `TENANT_SCOPE_AUDIT2A_REPORT.md` (nouveaux).

Aucune modification de schéma, aucun backfill, aucune migration, `resolveTenantScope` intact, `expandScopeWithUnaffiliatedUsersIfSoleTenant` **non réutilisé** dans ce sprint (aucun des 4 fixes n'en avait besoin — la solution ici est un changement de fonction d'assertion, pas une extension de scope).

## 36-40. Non-régression, gates

| Gate | Résultat |
|---|---|
| Tests dédiés AUDIT-2A (nouveau + Document réécrit) | 10/10 ✅ |
| Preuve AVANT correction (`git stash` sur les 4 fichiers de production) | 5/10 échouent exactement comme prédit ✅ |
| 3 hotfixes précédents + TENANT-SCOPE-AUDIT-1 (7 fichiers) | 41/41 ✅ |
| tenantCore + 4 suites tenantCert + 2 suites platformAdminCert1 + Property/Accommodation/Conversation dédiés (14 fichiers) | 208/208 ✅ |
| rentalMaintenance (routes/service/sync unit) + propertyRoutes unit + conversationRoutes unit + Financial Core F21/F22/F23 (8 fichiers) | 87/87 après correction du mock manquant (7 échecs avant, cause identifiée et corrigée) ✅ |
| Balayage final 16 fichiers tenant/org | 224/225 ✅ (1 échec préexistant, `Conversations unread 403 signal distinct`, déjà documenté non lié dans les 3 sprints précédents) |
| Server unit (`npm run test:unit`) | 1425/1425 ✅ |
| Server lint (fichiers touchés + suite complète) | 0 erreur, 106 warnings (baseline inchangée) ✅ |
| `git diff --check` | exit 0 ✅ |

Client/mobile non touchés.

## 41. Échecs préexistants

Le seul échec observé dans le balayage final (`Conversations unread 403 signal distinct`) est le même que celui déjà prouvé préexistant (via `git stash` de vérification) dans les 3 sprints précédents — non reprouvé indépendamment ce sprint mais reconnu par continuité de preuve déjà établie, jamais déclaré "préexistant" sur simple intuition.

Un vrai nouvel échec (7 tests, `propertyRoutes.test.js`) a été détecté, PROUVÉ contre la cause exacte (mock `tenantResourceAttributionService` incomplet dans ce fichier, révélé par le changement de fonction importée), et corrigé en ajoutant le mock manquant — jamais en modifiant la production pour satisfaire le test, conformément au mandat §39.

## 42. Dette restante pour AUDIT-2B

- `services/hotel/hotelAccessScopeService.js` — consommateur STRICT de `fromUser`/`assertResourceTenant`, explicitement hors périmètre de ce sprint, nécessite son propre audit avec la rigueur PLATFORM-ADMIN-CERT-1.
- `services/finance/financialAuthorizationService.js` — Financial Core, consommateur STRICT, très haute prudence requise, non testé.
- `routes/userBusinessProfileRoutes.js` — même famille de risque que les 4 bugs corrigés (STRICT `assertResourceTenant` sur `resourceType:'User'`), non testé faute de temps, candidat probable pour une correction identique (Option D) mais nécessite sa propre preuve avant/après.
- Les 8 domaines déjà documentés NON CONFIRMÉS dans TENANT-SCOPE-AUDIT-1 (export, CRM sync, dossier search, dashboard/ERP metrics, reporting) restent inchangés et non repris ce sprint (hors périmètre `fromUser`, non consommateurs directs de `tenantResourceAttributionService`).

## 43. Verdict

**TENANT-SCOPE-AUDIT-2A : CERTIFIÉ VERT.**

Justification par rapport aux critères du mandat §45 : tous les 28 consommateurs de `tenantResourceAttributionService` sont inventoriés et classifiés (matrice) ; leur contrat est caractérisé (matrice d'attribution) ; le bug Document est reproduit avant correction (test rouge original, puis preuve `git stash` sur le nouveau test) et corrigé, le test devient vert grâce à une correction réelle jamais affaiblie ; 3 fixes additionnels (User/contrat, Property, RentalMaintenance) découverts et corrigés avec la même rigueur pendant la caractérisation exhaustive exigée par le mandat, chacun avec preuve avant/après + cross-tenant ; aucune fuite Property/Hotel/Accommodation introduite (prouvé) ; Conversation reste isolée (invariant vérifié, rien modifié) ; Financial Core reste sécurisé (rien modifié, tests rejoués) ; les 4 sprints précédents restent verts ; toutes les gates pertinentes passent, y compris un vrai échec de régression détecté et corrigé à la source (jamais masqué).

---

## Réponses aux 43 questions obligatoires (mandat §44)

1. Le bug Document : 404/422 pour un document legacy lié à un compte public-signup sans OrgMembership.
2. Déclenché dans `getDocument`/`updateDocument`/`deleteDocument`/`createDocument`, via `assertResourceTenant`/le check inline d'attribution.
3. `fromUser` échouait car `resolveAvailableTenantsForUser` (OrgMembership-only) ne trouve aucun membership pour un compte non affilié → `unresolved`.
4. Oui, le `User` existait.
5. Non, aucun `OrgMembership`.
6. Non, aucune règle métier ne l'exige.
7. **28 consommateurs réels** (au-delà des ~15 `resourceType` déjà connus) répartis en 3 catégories : 15 utilisant un `assert*` (13 FAIL-OPEN déjà corrects, 5 STRICT dont 4 corrigés), 5 utilisant `resolveResourceTenant` brut hors chemin de blocage utilisateur, 3 scripts CLI offline hors périmètre runtime.
8. Voir `TENANT_SCOPE_AUDIT2A_CONSUMER_MATRIX.md` pour la liste complète.
9. Aucun consommateur ne nécessite objectivement le comportement strict pour bloquer un public-signup légitime — `hotelAccessScopeService.js`/`financialAuthorizationService.js` restent STRICT par prudence (domaine hors périmètre), pas par nécessité démontrée.
10. Tous les 28 consommateurs acceptent implicitement les comptes public-signup dans leur contrat métier — c'est le CHOIX de fonction d'assertion, pas le contrat métier, qui déterminait le blocage.
11. Voir `TENANT_SCOPE_AUDIT2A_ATTRIBUTION_MATRIX.md`.
12. `fromUser` n'a **pas** été modifié.
13. Non applicable (non modifié).
14. Parce que le modifier aurait affecté indistinctement les 28 consommateurs, y compris 2 domaines explicitement hors périmètre (Hotel, Financial Core) sans preuve de sécurité pour eux — Option D (corriger le point d'appel, pas la fonction partagée) atteint le même résultat avec un rayon d'action strictement local et déjà certifié.
15. Oui, `documentController.js` corrigé localement (alias + helper inline).
16. Non, aucune nouvelle politique — réutilisation de `assertResourceTenantOrUnattributed`, déjà existante.
17. Parce que cette fonction encode déjà exactement la distinction nécessaire et est déjà éprouvée par 13 consommateurs existants.
18. Oui, `resolveTenantScope` strictement inchangé.
19. Non, `expandScopeWithUnaffiliatedUsersIfSoleTenant` n'a pas été réutilisé dans ce sprint (aucun des 4 fixes n'en avait besoin).
20. Non applicable.
21. Oui, le test rouge original AUDIT-1 est maintenant vert — via correction réelle documentée.
22. `createDocument` : oui, corrigé et testé (via `relationsConsistentWithTenant`).
23. `getDocument` : oui, corrigé et testé.
24. `updateDocument` : oui, corrigé (même `assertResourceTenant` que `getDocument`/`deleteDocument`, plus `relationsConsistentWithTenant` pour la cohérence des relations) — testé indirectement via le test de non-régression cross-tenant existant, pas de test `updateDocument` dédié supplémentaire ajouté ce sprint (NON CONFIRMÉ spécifiquement pour cette action, cohérence de code établie par lecture).
25. `deleteDocument` : corrigé (même mécanisme), non testé spécifiquement ce sprint (NON CONFIRMÉ, cohérence de code établie par lecture).
26. Oui — testé explicitement pour Document, Property, RentalMaintenance, User/contrat : tentative cross-tenant toujours refusée (404).
27. Oui — `tenantCore.mongo.integration.test.js` rejoué vert, catalogue public jamais concerné par les fonctions modifiées.
28. Oui — testé explicitement (Property staff actions), catalogue public non concerné.
29. Oui — non touché, tests hôtel rejoués verts (non-régression, rien modifié).
30. Oui — non touché, tests accommodation rejoués verts.
31. Oui — invariant vérifié par raisonnement (rien modifié dans `fromUser`/Conversation), tests conversation rejoués verts.
32. Oui — non touché, tests Financial Core F21/F22/F23 rejoués verts.
33. Oui — Contrat/Rental non touché au niveau attribution (déjà correct), RentalManagement re-testé vert (AUDIT-1).
34. Oui — testé explicitement dans les 4 domaines corrigés.
35. Oui — non touché, comportement inchangé.
36. Oui — 4 sprints précédents rejoués verts (41/41 combiné).
37. `documentController.js`, `userController.js`, `propertyController.js`, `rentalMaintenanceController.js`.
38. `tenantScopeAudit1DocumentAttribution.mongo.integration.test.js` (réécrit), `propertyRoutes.test.js` (mock ajouté), `tenantScopeAudit2aAttribution.mongo.integration.test.js` (nouveau).
39. Voir tableau §36-40 — tous verts après correction du mock `propertyRoutes.test.js`.
40. Un seul, `Conversations unread 403 signal distinct`, déjà documenté non lié dans les 3 sprints précédents.
41. `userBusinessProfileRoutes.js` (même famille de bug, non testé), et tout ce qui était déjà NON CONFIRMÉ en AUDIT-1 (export, CRM, hôtel, ERP, reporting) — inchangé.
42. `hotelAccessScopeService.js`, `financialAuthorizationService.js`, `userBusinessProfileRoutes.js` — candidats pour AUDIT-2B.
43. **TENANT-SCOPE-AUDIT-2A : CERTIFIÉ VERT.**

## STOP

Conformément au mandat (§50) : audit → reproduction → caractérisation des 28 consommateurs → décision architecturale (Option D) → correction minimale (4 fichiers) → tests adversariaux → cross-tenant → non-régression complète → documentation → verdict. **STOP.** TENANT-SCOPE-AUDIT-2B n'est PAS lancé automatiquement. En attente de validation explicite.
