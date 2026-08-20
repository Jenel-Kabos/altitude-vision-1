# TENANT-SCOPE-HOTFIX-3 — Rapport final

Date : 2026-08-20. Branche `main`. `HEAD` au démarrage et à la fin : `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782` (inchangé, aucun commit créé, aucun changement externe).

## Résumé exécutif

Les deux bugs confirmés par TENANT-SCOPE-AUDIT-2B (lockout self-service Hotel et Financial) ont été corrigés. Cause commune : `requireTenantScope` (fail-closed) monté globalement sur `hotelRoutes.js`/`financialRoutes.js`, bloquant tout acteur sans tenant résolu — y compris les propriétaires/exploitants légitimes sans `OrgMembership` — avant que `hotelAccessScopeService.js`/`financialAuthorizationService.js` (tous deux non modifiés) puissent appliquer leur propre vérification d'ownership déjà correcte.

**Solution retenue (Option B du mandat)** : un nouveau middleware, `attachTenantScopeIfResolvable` (`middleware/tenantContext.js`), qui réutilise EXACTEMENT la même logique de résolution/enrichissement que `requireTenantScope` quand un tenant se résout (zéro changement pour le staff), mais ne bloque plus quand aucun tenant ne se résout — laissant la requête atteindre le contrôleur puis le service d'autorisation métier, qui décide seul de l'ownership. Aucun bypass d'autorisation créé : le middleware ne décide jamais lui-même de l'accès.

## Réponses aux 41 questions obligatoires (mandat §56)

1. **Quelles routes Hotel étaient bloquées ?** Toutes les routes self-service/mixtes (`/mine`, `/:id/submit`, `/:id/duplicate`, `/:id/deactivate`, `/:id/reactivate`, `DELETE /:id`, `/:id` GET, `/portfolio*`, room-categories, rooms, inventory, room-assignments) — voir `TENANT_SCOPE_HOTFIX3_ROUTE_MATRIX.md`.
2. **Quelles routes Financial étaient bloquées ?** Toutes les routes correspondant à une capacité déjà présente dans `ownerCapabilities` (`DOCUMENT_VIEW`, `PAYMENT_VIEW`, `LEDGER_VIEW`, `DASHBOARD_VIEW`/`ALERTS`, `DOCUMENT_PDF_DOWNLOAD`, `DOCUMENT_DELIVERY_VIEW`) — voir matrice.
3. **`requireTenantScope` était-il la cause ?** Oui, confirmé et reproduit par test AVANT toute modification (`git stash` sur `hotelRoutes.js`/`financialRoutes.js`/`middleware/tenantContext.js` : 4/14 tests échouent exactement sur les assertions liées au fix).
4. **Le rejet avait-il lieu avant controller ?** Oui — 403 `TENANT_CONTEXT_REQUIRED` levé par le middleware, avant tout `req.route`/contrôleur.
5. **`hotelAccessScopeService` était-il correct ?** Oui — non modifié, sa logique de bypass ownership (`!actor.platformTenant && hotel.manager===actor`) était déjà correcte, seulement inatteignable.
6. **`financialAuthorizationService` était-il correct ?** Oui, même constat (`assertFinancialScope`).
7. **Pourquoi `attachTenantContext` seul était-il insuffisant ?** Il ne peuple ni `req.user.platformTenant` ni `req.user.tenantScopeUserIds` — des champs dont dépendent directement `resolveHotelAccessScope` (branche Admin) et `assertFinancialScope` pour la protection cross-tenant du staff. Un simple remplacement aurait cassé le staff (vérifié en AUDIT-2B, non re-testé ici par choix architectural — nouvelle solution dès le départ).
8. **Quelle architecture a été choisie ?** Option B du mandat : nouveau middleware `attachTenantScopeIfResolvable`, extrait de la même logique interne que `requireTenantScope` (`resolveAndAttachTenantScope`, factorisée), qui enrichit `req.user` à l'identique quand un tenant se résout, et laisse simplement passer sinon.
9. **Pourquoi ?** Plus petit rayon d'action démontré : aucune duplication de logique (la fonction de résolution est partagée, pas réécrite), aucune modification de `hotelAccessScopeService.js`/`financialAuthorizationService.js`/`fromUser`/`resolveTenantScope`, comportement staff prouvé strictement identique (même fonction interne).
10. **Un nouveau middleware a-t-il été créé ?** Oui, `attachTenantScopeIfResolvable`.
11. **Son contrat exact ?** Authentification déjà acquise (`auth.protect` en amont) ; résout `req.platformTenant`/`req.tenantScopeUserIds` et enrichit `req.user.*` EXACTEMENT comme `requireTenantScope` si un tenant se résout ; sinon laisse `req.platformTenant = null` et `req.tenantScopeUserIds = null`, `req.user.platformTenant` JAMAIS peuplé, et appelle `next()` sans erreur ; ne décide jamais de l'ownership ; ne crée aucun `tenantScopeUserIds` global ; ne transforme jamais un utilisateur non affilié en `OrgMember`.
12. **`requireTenantScope` global a-t-il été modifié ?** Sa logique interne a été extraite dans `resolveAndAttachTenantScope` (factorisation), mais son comportement observable est byte-identique — prouvé par le rejeu de 280 tests Hotel/Financial/cert AVANT toute modification de routeur, puis par le rejeu complet après.
13. **`resolveTenantScope` a-t-il été modifié ?** Non (le service `tenantContextService.js`, pas le middleware).
14. **`fromUser` a-t-il été modifié ?** Non.
15. **Owner sans OrgMembership peut-il maintenant accéder à Hotel A ?** Oui, prouvé.
16. **Owner A peut-il accéder à Hotel B ?** Non, refusé (403), prouvé.
17. **Staff A peut-il toujours accéder à Hotel A ?** Oui, prouvé.
18. **Staff A peut-il accéder à Hotel B ?** Non, refusé, prouvé (via `/admin/list`, staff non-Admin — le comportement Admin sur `/admin/list` est un gap pré-existant distinct, documenté en dette §24, non introduit par ce hotfix).
19. **selected tenant fonctionne-t-il toujours ?** Oui — `requestedTenant(req)` (en-tête `X-Platform-Tenant-Id`) lu identiquement dans les deux middlewares, code inchangé.
20. **Owner finance reste-t-il read-only ?** Oui, prouvé (`payments/manual`, `payments/:id/confirm` refusés).
21. **Owner A peut-il lire ses documents Hotel A ?** Oui, prouvé.
22. **Owner A peut-il lire Hotel B ?** Non, prouvé.
23. **Owner peut-il créer/valider/reverse un paiement staff-only ?** Non, prouvé (`assertFinancialCapability` RBAC non modifié).
24. **Client a-t-il gagné une capacité ?** Non, prouvé explicitement.
25. **Admin reste-t-il conforme au contrat ?** Oui — branche Admin de `resolveHotelAccessScope`/`assertFinancialScope` non modifiée, testée (F21-F25, F26.1-F26.3, platformAdminCert1).
26. **Financial Core est-il intact ?** Oui — 280/280 (F21-F25 + certs + Hotel).
27. **PAY-3 est-il intact ?** Oui — 70/70 (mtnMoMoClient/Provider/Controller/HotelPaymentBridge/paymentProviderRegistry — même run que PAY-4).
28. **PAY-4 est-il intact ?** Oui — mêmes suites, MTN non touché, routes `/hotel/payments/mtn/*` restent sous `auth.protect` uniquement (jamais dépendantes de `platformTenant` en amont).
29. **Callbacks MTN sont-ils intacts ?** Oui — `paymentProviderRoutes.js` (callback, sans JWT) monté séparément, jamais sous `hotelRoutes.js`/`financialRoutes.js`, non touché.
30. **Manual payments sont-ils intacts ?** Oui — `PAYMENT_CREATE` reste absente de `ownerCapabilities`, prouvé refusé pour Owner.
31. **Checkout policy est-elle intacte ?** Oui — `hotelFinancialCheckoutF23`/`hotelCheckoutFinancialReadiness` rejoués verts.
32. **Public Property/Hotel catalog est-il intact ?** Oui — `tenantCore.mongo.integration.test.js` rejoué vert (6 tests API Gateway).
33. **Conversation invariant est-il intact ?** Oui — non modifié, suites rejouées vertes.
34. **BusinessProfiles est-il intact ?** Oui — non re-touché ce sprint, 9/9 rejoués verts.
35. **Cross-tenant est-il prouvé avec Mongo ?** Oui — `MongoMemoryReplSet` réel via `financialMongoEnvironment.js`, fixtures Tenant A/Tenant B réelles (`createTenantFixture`/`createTenantUser`).
36. **Cross-owner est-il prouvé ?** Oui — comptes `User.create` directs (jamais `createTenantUser`), donc sans `OrgMembership`, testés explicitement l'un contre l'autre.
37. **Quels fichiers production ont changé ?** `server/middleware/tenantContext.js` (nouveau middleware + factorisation), `server/routes/hotelRoutes.js` (1 ligne de montage), `server/routes/financialRoutes.js` (1 ligne de montage). **3 fichiers.**
38. **Quels tests ont été ajoutés ?** Aucun nouveau fichier — les deux fichiers de preuve d'AUDIT-2B (`tenantScopeAudit2bHotel...test.js`, `tenantScopeAudit2bFinancial...test.js`) ont été réécrits pour prouver la correction (6 + 8 = 14 tests), conformément au mandat §13 (ne jamais affaiblir un test rouge, le faire passer au vert par une vraie correction).
39. **Quels gates passent ?** Voir tableau ci-dessous.
40. **Quelle dette tenant-scope reste ?** Voir §Dette ci-dessous.
41. **Peut-on reprendre PAY-5 ?** Oui — voir verdict.

## Gates

| Gate | Résultat |
|---|---|
| Preuve AVANT correction (`git stash` sur les 3 fichiers de production) | 4/14 échouent exactement comme prédit ✅ |
| Tests dédiés HOTFIX-3 (Hotel 6 + Financial 8) | 14/14 ✅ |
| businessProfiles + 5 sprints précédents (11 fichiers) | 82/82 ✅ |
| Hotel access (F26.1-F26.3) + hotelRoutes + Financial Core (F21-F25) + tenantCert (4) + platformAdminCert1 (2) | 280/280 ✅ |
| PAY-3/PAY-4 + Conversation (7 fichiers) | 81/81 ✅ |
| Server unit (`npm run test:unit`) | 1425/1425 ✅ |
| Balayage cross-tenant/tenantCore (10 fichiers) | 134/135 ✅ (1 échec préexistant, `Conversations unread 403 signal distinct`, reproduit indépendamment contre baseline complet en AUDIT-2B via `git stash` de toute la session — même échec identique, aucun fichier de ce hotfix n'y touche) |
| Server lint (fichiers touchés + suite complète) | 0 erreur, 106 warnings (baseline inchangée) ✅ |
| `git diff --check` | exit 0 ✅ |

Client/mobile non touchés — aucun fichier `client/`/`altimmo-app/` modifié, aucun changement de contrat backend l'exigeant.

## Dette tenant-scope restante

- **`hotelController.listAdmin`/`hotelService.listHotelsForAdmin` (Admin uniquement)** : découverte fortuite pendant ce sprint, sans lien avec `requireTenantScope` — pour un Admin, `hotelIds` reste `undefined` et `listHotelsForAdmin({...})` interroge `Hotel.find({})` SANS AUCUN filtre tenant. Ce comportement est **pré-existant** (confirmé non introduit par ce hotfix — aucun fichier `hotelController.js`/`hotelService.js` n'a été modifié) et concerne uniquement le rôle `Admin` sur `/admin/list` (le rôle non-Admin est déjà correctement scopé via `listAccessibleHotels`). **NON CONFIRMÉ comme un problème de sécurité actif** (Admin a par ailleurs une portée large par construction dans ce système), mais mérite un audit dédié séparé — non traité ici, hors périmètre strict de ce hotfix (routing self-service, pas la logique de listing Admin).
- Les domaines déjà documentés NON CONFIRMÉS lors des sprints précédents (export, CRM sync, dossier search, ERP/dashboard metrics, reporting, `userBusinessProfileRoutes` déjà corrigé) restent inchangés.

## Verdict

**TENANT-SCOPE-HOTFIX-3 : CERTIFIÉ VERT.**

Justification : les deux lockouts Hotel et Financial sont corrigés, reproduits AVANT correction (preuve `git stash`) et vérifiés APRÈS (14/14) ; owner sans OrgMembership fonctionne pour Hotel et Financial ; cross-owner refusé (prouvé, les deux domaines) ; cross-tenant refusé (prouvé, les deux domaines, avec Mongo réel) ; les chemins staff restent pleinement fonctionnels (`resolveAndAttachTenantScope` byte-identique à l'ancien `requireTenantScope` pour le cas résolu, prouvé par 280 tests Hotel/Financial/cert inchangés) ; `selected tenant` intact ; owner Financial reste read-only (prouvé) ; Client ne gagne aucune capacité (prouvé) ; `hotelAccessScopeService.js`/`financialAuthorizationService.js` non modifiés et cohérents ; Financial Core intact ; PAY-3/PAY-4 verts ; catalogue public intact ; anciens hotfixes verts ; tous les gates listés au mandat §53 sont verts.

Une dette mineure, pré-existante et non liée à ce hotfix (`listAdmin` Admin sans filtre tenant) a été découverte et documentée honnêtement plutôt que masquée, conformément au mandat §54 — elle ne remet pas en cause le verdict CERTIFIÉ VERT de ce hotfix précis, dont le périmètre était strictement le lockout self-service.

## STOP

Conformément au mandat (§60) : baseline → reproduction Hotel → reproduction Financial → cartographie routes → conception middleware → correction minimale → tests owner/staff/cross-owner/cross-tenant/Financial security → régression complète → documentation → verdict. **STOP.** PAY-5 n'est PAS démarré. En attente de validation explicite, y compris sur l'opportunité d'un audit dédié pour la dette `listAdmin` documentée ci-dessus.
