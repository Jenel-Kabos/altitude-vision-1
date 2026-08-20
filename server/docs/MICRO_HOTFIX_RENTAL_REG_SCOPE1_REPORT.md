# MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — Rapport final

Date : 2026-08-20. Branche `main`. `HEAD` inchangé depuis HOTFIX-OWNER-CONTRACT-RESEND-1 (`3f7b59bfb92f51c7ccc6e73c57636affc8cb7782`). Aucun commit créé pendant ce hotfix.

Aucun accès à la base MongoDB de production. Preuve exclusivement par lecture de code + tests avec fixtures locales sur la route HTTP réelle (middleware `requireTenantScope` inclus, pas seulement le service en isolation).

## Réponses aux 23 questions du mandat

**1. `rentalContractRegularizationRoutes.js` utilisait-il raw `tenantScopeUserIds` ?**
Oui — `req.tenantScopeUserIds` (posé par `requireTenantScope`, brut `OrgMembership`-only) était transmis tel quel par le contrôleur au service, sans jamais passer par `expandScopeWithUnaffiliatedUsersIfSoleTenant`.

**2. Sur quelles routes ?**
Les trois : `GET /` (liste), `POST /:contractId/decision`, `POST /:contractId/revert`.

**3. Quel acteur était concerné ?**
Important à noter (différence structurelle avec HOTFIX-USERS-COUNT-1/RESEND-1) : l'acteur qui appelle ces routes est **toujours du staff** — `Admin`, `GestionnaireImmobilier` ou `Collaborateur` (`restrictTo('Admin', 'GestionnaireImmobilier', 'Collaborateur')`). Jamais le Proprietaire/Client lui-même. Le bug n'affectait donc pas la capacité d'un compte public-signup à agir pour lui-même, mais la capacité du STAFF légitime à traiter un dossier dont le propriétaire lié est un tel compte.

**4. Quel type de compte pouvait être exclu ?**
Un `Contrat.proprietaire.user` référençant un `User` de rôle `Proprietaire` créé par inscription publique, sans `OrgMembership` — exactement le même profil qu'huinlogistics dans HOTFIX-USERS-COUNT-1.

**5. Le bug était-il réellement reproductible ?**
Oui — reproduit par test AVANT correction (`__tests__/microHotfixRentalRegScope1.mongo.integration.test.js`, describe "scénario réel") : 3 tests sur 7 échouaient précisément sur ce chemin, les 4 autres (cross-tenant, non-régression) passaient déjà (comportement pré-existant correct sur ces points).

**6. Quel HTTP status était retourné ?**
`GET /` : `200` mais liste vide du dossier concerné (filtré silencieusement, pas d'erreur explicite). `POST /:contractId/decision` et `POST /:contractId/revert` : `409 {code: 'CASE_NOT_PENDING', message: "Ce contrat n'est plus régularisable."}`.

**7. Le controller était-il atteint ?**
Oui, contrairement à HOTFIX-OWNER-CONTRACT-RESEND-1 (où le garde `router.param` bloquait AVANT le contrôleur). Ici il n'existe aucun `router.param('id', …)` sur ce routeur — la ressource `:contractId` n'est jamais validée contre un scope avant le contrôleur. Le contrôleur et le service s'exécutent bien ; c'est `isContractInScope`/`assertContractInScope` (dans le SERVICE) qui rejette la ressource après l'avoir chargée. Distinction documentée par un test dédié ("atteint le controller/service — pas de 409 CASE_NOT_PENDING à tort").

**8. `OrgMembership` était-il la cause ?**
Oui, directement — `isContractInScope` compare `contract.proprietaire.user` au scope brut `OrgMembership`-only. Cause racine strictement identique à HOTFIX-USERS-COUNT-1 (catégorie D — tenant scoping / gap architectural), appliquée ici à la résolution d'appartenance d'une ressource tierce (`Contrat`) plutôt qu'à la visibilité de l'acteur.

**9. Le compte public-signup sans OrgMembership devait-il réellement être autorisé ?**
Oui, dans le cas précis testé : sur un déploiement à tenant unique, ce Proprietaire appartient sans ambiguïté au seul tenant existant — refuser au staff légitime de ce tenant l'accès à un dossier de régularisation lié à ce compte n'a aucune justification métier ou sécurité.

**10. La fonction `expandScopeWithUnaffiliatedUsersIfSoleTenant` était-elle applicable ?**
Oui — ses préconditions (tenant unique `trial`/`active`, exclusion des comptes techniques/suspendus/`OrgMembership`/`PlatformOperator`) correspondent exactement au besoin ici : élargir le référentiel des `User._id` considérés comme appartenant au tenant, indépendamment du fait que ce soit pour lister des `User` (HOTFIX-USERS-COUNT-1) ou pour matcher un `Contrat.proprietaire.user` (ce hotfix).

**11. A-t-elle été réutilisée ?**
Oui — importée depuis `userController.js` (déjà exportée pour HOTFIX-OWNER-CONTRACT-RESEND-1) dans `rentalContractRegularizationController.js`, appliquée aux trois actions (`list`, `decide`, `revert`) avant transmission au service. **Aucune nouvelle fonction équivalente créée**, conformément au mandat §9.

**12. Pourquoi ?**
Parce que c'est exactement la même sémantique ("qui appartient au tenant unique, y compris les comptes non affiliés") qu'il fallait appliquer, sans jamais toucher `resolveTenantScope` (portée globale déjà démontrée dangereuse — fuite property/hotel/reporting constatée et revertée dans HOTFIX-USERS-COUNT-1). Réutiliser la fonction canonique évite une divergence de comportement entre domaines et un code dupliqué.

**13. Le single-tenant safety gate est-il préservé ?**
Oui — `expandScopeWithUnaffiliatedUsersIfSoleTenant` conserve intégralement son garde interne (`PlatformTenant.countDocuments({status:{$in:['trial','active']}}) === 1`), non modifié par ce hotfix.

**14. Que se passe-t-il en multi-tenant ?**
Dès qu'un second tenant existe, l'extension se désactive (retour au scope `OrgMembership` strict) — testé explicitement : le dossier du Proprietaire non affilié au Tenant A disparaît de la liste d'AdminA (repli sûr documenté, pas une fuite, cohérent avec le comportement déjà observé sur `/dashboard/users`).

**15. Cross-tenant est-il toujours refusé ?**
Oui — testé explicitement : AdminB (Tenant B distinct) tentant `decision` sur le dossier du Tenant A reçoit `409 CASE_NOT_PENDING` (aucune fuite, aucun accès cross-tenant).

**16. Les workflows GL sont-ils non régressés ?**
Oui — `rentalContractRegularization.mongo.integration.test.js` (tests existants du service, appelant directement `service.getCases/decide/revert` avec un scope déjà correct à la main) : tous verts, aucun changement de comportement pour ces tests qui construisent leur `tenantScopeUserIds` manuellement (donc déjà "corrects" avant ce hotfix — le correctif n'affecte que la résolution RÉELLE via `requireTenantScope`, pas la signature du service).

**17. HOTFIX-USERS-COUNT-1 reste-t-il vert ?**
Oui — 7/7.

**18. HOTFIX-OWNER-CONTRACT-RESEND-1 reste-t-il vert ?**
Oui — 8/8.

**19. Quels fichiers ont changé ?**
- `server/controllers/rentalContractRegularizationController.js` — les 3 actions (`list`, `decide`, `revert`) résolvent désormais le scope via `expandScopeWithUnaffiliatedUsersIfSoleTenant` avant appel au service (fonction déjà existante, importée depuis `userController.js`).
- `server/__tests__/microHotfixRentalRegScope1.mongo.integration.test.js` (nouveau, 7 tests).
- `server/docs/MICRO_HOTFIX_RENTAL_REG_SCOPE1_ETAT_INITIAL.md`, `MICRO_HOTFIX_RENTAL_REG_SCOPE1_REPORT.md` (nouveaux).
Aucun autre fichier touché. Ni `resolveTenantScope`, ni `rentalContractRegularizationService.js` (le service reste inchangé — il reçoit simplement un `tenantScopeUserIds` déjà élargi en amont), ni le métier locatif (création de contrat, GL, paiements, pénalités, préavis, maintenance, documents, `TenantLinkRequest`).

**20. Quels tests ont été ajoutés ?**
7 tests dans `microHotfixRentalRegScope1.mongo.integration.test.js` : 3 sur le scénario réel (liste + décision + réversion sur un dossier non affilié, tenant unique), 2 sur la sécurité multi-tenant (repli sûr + refus cross-tenant explicite), 2 sur la non-régression IAM (staff avec `OrgMembership` normal continue de fonctionner ; rôle insuffisant reste `403`). Confirmé échouer 3/7 sur le code d'avant correctif (reproduction directe, pas de `git stash` nécessaire ici puisque testé avant toute modification).

**21. Quels gates passent ?**

| Gate | Résultat |
|---|---|
| Test dédié `microHotfixRentalRegScope1` | 7/7 ✅ (3/7 échouaient avant correctif, reproduction directe) |
| Tests existants `rentalContractRegularization` (service) | verts, non-régression ✅ |
| Test dédié `hotfixUsersCount1` (non-régression) | 7/7 ✅ |
| Test dédié `hotfixOwnerContractResend1` (non-régression) | 8/8 ✅ |
| Suites certification cross-tenant (6 fichiers, dont V3 platformAdminCert1.vulnerabilities) | 114/114 ✅ |
| Total run combiné (10 fichiers ci-dessus) | 142/142 ✅ |
| Balayage régression tenant/org (16 fichiers) | 224/225 ✅ (1 échec préexistant, déjà documenté non lié dans les 2 hotfixes précédents) |
| Server unit (`npm run test:unit`) | 1425/1425 ✅ |
| Server lint (fichiers touchés) | 0 erreur, 0 warning nouveau ✅ |
| Server lint (suite complète) | 0 erreur, 106 warnings (baseline inchangée) ✅ |
| `git diff --check` | exit 0 ✅ |

Client/mobile non touchés — aucun gate client requis (aucun fichier frontend/mobile modifié).

**22. Reste-t-il une anomalie analogue ailleurs ?**
Oui, potentiellement — **documentée, non corrigée**, conformément au mandat (§22 : "ne corrige pas automatiquement"). Sweep de tous les fichiers utilisant `req.tenantScopeUserIds`/`actor.tenantScopeUserIds` :
- `controllers/documentController.js`, `controllers/propertyPortfolioController.js`, `controllers/rentalManagementController.js`, `controllers/exportController.js`, `controllers/crmController.js`, `controllers/dossierController.js`, `services/hotel/hotelAccessScopeService.js`, `services/erp/erpService.js` — tous filtrent une ressource métier (`Property.owner`, documents, portefeuille, exports CRM, dossiers, accès hôtel, ERP) directement par `{$in: req.tenantScopeUserIds}` sans passer par `expandScopeWithUnaffiliatedUsersIfSoleTenant`. Le même schéma théorique (un `Property.owner`/`createdBy`/`manager` public-signup sans `OrgMembership` invisible sur tenant unique) pourrait s'y appliquer. **Aucune preuve par test n'a été apportée pour ces domaines dans ce micro-hotfix** — hors périmètre strict du mandat, qui portait exclusivement sur `rentalContractRegularizationRoutes.js`. À traiter, si confirmé nécessaire, dans un hotfix dédié ultérieur avec sa propre preuve par test.
- `controllers/conversationController.js` : simple commentaire de référence, pas d'usage direct de filtrage par appartenance — non concerné.

**23. Verdict final ?**
**MICRO-HOTFIX-RENTAL-REG-SCOPE-1 : CERTIFIÉ VERT** — bug confirmé par test (pas supposé), corrigé au point le plus étroit (contrôleur, réutilisation de la fonction canonique existante, aucune modification de `resolveTenantScope` ni du service métier), sécurité multi-tenant prouvée par test adversarial, aucune régression détectée sur 1425 tests unit + 142 tests cert/hotfix combinés + 225 tests de balayage tenant/org (1 échec préexistant confirmé non lié).

## STOP

Conformément au mandat (§28) : aucune action supplémentaire. Pas de PAY-5, pas de refactor IAM, pas de généralisation automatique aux autres domaines listés en Q22, pas de modification frontend, aucune migration. En attente de validation explicite.
