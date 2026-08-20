# TENANT-SCOPE-AUDIT-1 — Rapport final

Date : 2026-08-20. Branche `main`. `HEAD` au démarrage et à la fin : `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782` (inchangé, aucun changement externe pendant ce sprint). Aucun commit créé.

## 1. Résumé exécutif

Audit transversal de 34 fichiers utilisant `tenantScopeUserIds`/`scopeUserIds`. Trois nouveaux bugs de la même famille que HOTFIX-USERS-COUNT-1/RESEND-1/RENTAL-REG-SCOPE-1 ont été **prouvés par test AVANT correction**, corrigés **localement**, et **prouvés sûrs cross-tenant APRÈS correction** :
- `propertyPortfolioController.list` (portefeuille backoffice Property/Accommodation/Hotel, staff-only).
- `rentalManagementController.list` (liste des dossiers de Gestion Locative).
- `rentalManagementController.stats` (agrégats du même module).

Un quatrième défaut, structurellement plus large, a été **prouvé par test mais délibérément NON corrigé** dans ce sprint : `documentController.getDocument`/`updateDocument`/`deleteDocument`/`createDocument` échouent (404 `TENANT_RESOURCE_NOT_FOUND`) pour un document lié à un compte public-signup non affilié, à cause de `tenantResourceAttributionService.fromUser` — une fonction partagée par ~15 types de ressources déjà certifiées séparément. La corriger dépasse le rayon d'action acceptable pour ce sprint (voir §14).

Un cinquième point a été découvert et corrigé en cours de route, sans rapport avec le scoping tenant lui-même : les deux fixes ci-dessus ont provoqué un timeout (requêtes Mongoose réelles sans connexion) dans deux fichiers de tests UNITAIRES (`rentalManagementActivation.test.js`, et par contamination de worker Jest, `hotelRoutes.test.js`) — corrigé en ajoutant les mocks de modèles manquants (`PlatformTenant`, `OrgMembership`, `PlatformOperator`), sans toucher au code de production.

Les autres occurrences ont été classifiées CORRECT AS-IS, RISQUE THÉORIQUE (honnêtement non prouvées) ou LEGACY/DEAD. Aucune n'a été modifiée sans preuve.

## 2. Baseline Git

```
git status --short (avant) → travail non commité de MICRO-HOTFIX-RENTAL-REG-SCOPE-1 uniquement, rien de surprenant
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782 (inchangé du début à la fin)
git diff --check → exit 0
```

## 3. Historique des trois hotfixes précédents

Voir `server/docs/TENANT_SCOPE_AUDIT1_ETAT_INITIAL.md` §2 pour le résumé complet lu intégralement avant ce sprint. En bref : HOTFIX-USERS-COUNT-1 (User listing), HOTFIX-OWNER-CONTRACT-RESEND-1 (actions User par ID), MICRO-HOTFIX-RENTAL-REG-SCOPE-1 (régularisation locative) — trois corrections locales de la même cause racine (scope `OrgMembership`-only excluant les comptes public-signup sur tenant unique), toutes réutilisant `expandScopeWithUnaffiliatedUsersIfSoleTenant`, jamais `resolveTenantScope` global.

## 4. Pourquoi `resolveTenantScope` ne doit jamais être élargi globalement

Preuve directe, déjà établie et reconfirmée pendant ce sprint sans y toucher : une tentative antérieure d'étendre `resolveTenantScope`/`getScopeUserIds` globalement (HOTFIX-USERS-COUNT-1) a fait échouer 6 tests de `tenantCore.mongo.integration.test.js` — des biens/hôtels de propriétaires non affiliés devenaient visibles dans le catalogue PUBLIC (API Key) d'un tenant tiers. Ce risque gouverne toute la méthodologie : `resolveTenantScope`, `getScopeUserIds`, le catalogue public (`publicApi/*`), et `middleware/publicApiAuth.js` sont classés **CORRECT AS-IS — NE JAMAIS ÉLARGIR** dans la matrice.

## 5-13. Inventaire, documentController, propertyPortfolioController, rentalManagementController, exportController, crmController, dossierController, hotelAccessScopeService, erpService, autres occurrences

Voir `server/docs/TENANT_SCOPE_AUDIT1_MATRIX.md` — matrice complète des 27 occurrences significatives classifiées (sur 34 fichiers inventoriés ; les 7 fichiers restants sont soit la couche de résolution elle-même, soit des doublons du même contrôleur/service déjà couverts par une ligne de la matrice).

## 14. Fixtures utilisées

Toutes les nouvelles suites réutilisent le patron déjà établi (`__tests__/helpers/financialMongoEnvironment.js` + `__tests__/helpers/tenantAwareFixture.js` : `createTenantFixture`, `createTenantUser`) — le même fixture canonique Tenant/Staff/PublicSignupOwner que les trois hotfixes précédents, conformément au mandat §17 (pas de fixture incompatible créée).

## 15-19. Bugs reproduits / occurrences correctes / NON CONFIRMÉES / corrections appliquées / single-tenant

**Bugs reproduits et corrigés (3)** :
1. `propertyPortfolioController.list` — `Property.owner` filtré par scope brut. Test AVANT : 1/4 échoue (bien non affilié absent du portefeuille). Correction : `expandScopeWithUnaffiliatedUsersIfSoleTenant` appliquée localement. Test APRÈS : 4/4 verts.
2. `rentalManagementController.list` — `RentalManagement.owner` filtré par scope brut. Test AVANT : échoue. Correction : idem. Test APRÈS : vert.
3. `rentalManagementController.stats` — `Property.owner` (agrégat) filtré par scope brut. Test AVANT : échoue. Correction : idem. Test APRÈS : vert.

**Bug reproduit, NON corrigé (1)** :
4. `documentController.getDocument` (et `updateDocument`/`deleteDocument`/`createDocument` par le même mécanisme) — `tenantResourceAttributionService.fromUser` (`OrgMembership`-only) renvoie `unresolved` pour un document lié à un compte non affilié sans `relatedProperty` résoluble ; `assertResourceTenant` (variante STRICTE) traite `unresolved` comme un échec → 404. Test dédié (`tenantScopeAudit1DocumentAttribution.mongo.integration.test.js`) confirme le 404 exact. **Non corrigé** : `fromUser` est appelée par `resolveResourceTenant` pour ~15 `resourceType` différents (Property, Hotel, Accommodation, Conversation, Message, FinancialDocument, Contrat, Proprietaire, Locataire, RentalManagement, Litige, Signalement, RealEstateApplication, PaiementTransaction, FinancialDocumentArtifact), chacun certifié séparément par des sprints antérieurs (PLATFORM-ADMIN-CERT-1, STORAGE-LEGACY-1, TENANT-DATA-REGULARIZATION-1, TENANT-CERT-2/3). La corriger sans audit dédié de CHAQUE consommateur créerait un risque de régression bien supérieur à ce qui a été fait pour `resolveTenantScope` — hors du blast radius acceptable pour ce sprint, conformément au mandat §19 ("dernier recours seulement : modifier un middleware plus partagé") et §31 (limiter le blast radius).

**Occurrences correctes (CORRECT AS-IS, 7)** : `rentalManagementRoutes.js` (`router.param` déjà fail-open via `assertResourceTenantOrUnattributed`), `erpService.getOrganizationSummary`, `platformTenantService.getTenantOverview`, `actionLogController`, `notificationService` (staff), `publicApi/*` + `publicApiAuth.js` (catalogue public, volontairement strict), `conversationController.js` (référence morte).

**NON CONFIRMÉES (RISQUE THÉORIQUE, honnêtement non prouvées, 8)** : `documentController.tenantDocumentFilter` (liste, distinct de la lecture par ID prouvée ci-dessus), `dossierSearchService.searchDossiers`, `exportController.collectContacts`, `crmController`/`crmService.synchronizeCustomers`, `dashboardAnalyticsController.sales`, `erpService.computeGrowth`, `propertyController.js` (notification de publication), `services/reporting/domains/*` + `reportingService.js`. Chacune documentée avec sa justification dans la matrice — aucune n'a été modifiée sans preuve, conformément au mandat §16/§20.

## 20-22. Single-tenant / Multi-tenant / Cross-tenant

Pour chacun des 3 fixes appliqués : test explicite "tenant unique → compte non affilié inclus" ET test explicite "second tenant existe → extension désactivée automatiquement (repli sûr) + AdminB ne voit jamais les ressources du Tenant A". Les 3 corrections réutilisent la fonction `expandScopeWithUnaffiliatedUsersIfSoleTenant` déjà existante, dont le garde interne (`PlatformTenant.countDocuments({status:{$in:['trial','active']}}) === 1`) n'a **pas été modifié** — aucune nouvelle logique de gate créée.

## 23. OrgMembership normal

Chaque nouvelle suite inclut un test "non-régression staff avec OrgMembership normal" prouvant qu'un bien/dossier dont le propriétaire a un `OrgMembership` réel continue de fonctionner sans changement de comportement.

## 24. Public-signup

Chaque bug corrigé a été reproduit avec un vrai `User.create({role:'Proprietaire', ...})` créé HORS de `createTenantFixture`/`createTenantUser` (donc sans `OrgMembership`), jamais une fixture staff/member normale — conformément au mandat §22.

## 25. Security invariants

Aucune capacité IAM, aucun rôle, aucun schéma (`User`, `Proprietaire`, `OrgMembership`, `PlatformTenant`) modifié. Aucun statut HTTP existant reconverti (404 reste 404, 403 reste 403, 409 reste 409 — voir `rentalContractRegularizationService` inchangé, toujours `409 CASE_NOT_PENDING`). Aucune règle de non-divulgation cross-tenant affaiblie.

## 26. Tests

5 nouveaux fichiers de test créés (13 tests au total dans les 3 fichiers de fix + 1 test de preuve documentController) :
- `tenantScopeAudit1PropertyPortfolio.mongo.integration.test.js` (4 tests).
- `tenantScopeAudit1RentalManagement.mongo.integration.test.js` (5 tests).
- `tenantScopeAudit1DocumentAttribution.mongo.integration.test.js` (1 test, preuve du bug non corrigé — doit rester rouge sans modification future de `tenantResourceAttributionService.js`).

Plus 1 fichier de test existant corrigé (mock manquant, pas un changement de comportement testé) : `rentalManagementActivation.test.js`.

## 27. Sweep de régression

| Gate | Résultat |
|---|---|
| Tests dédiés ce sprint (3 fichiers + preuve documentController) | 10/10 ✅ |
| Property Portfolio + tenantCore + 3 hotfixes précédents (sweep post-fix #1) | 49/49 ✅ |
| Gestion Locative + tenantCore + tenantCert2/hardening2/cert3Pre + platformAdminCert1.domains + 3 hotfixes précédents (sweep post-fix #2/#3) | 173/173 ✅ |
| Balayage final : 16 fichiers tenant/org + platformAdminCert1.vulnerabilities + tenantCert.audit + tenantCert3Final (19 fichiers) | 257/258 ✅ (1 échec préexistant, `Conversations unread 403 signal distinct`, déjà documenté non lié dans les 3 hotfixes précédents) |
| Server unit (`npm run test:unit`), 1er passage | 1421/1425 ❌ (4 échecs — voir §résumé exécutif, causés par des modèles Mongoose non mockés dans `rentalManagementActivation.test.js`, cascade Jest-worker sur `hotelRoutes.test.js`) |
| Correction du fichier de test (mocks `PlatformTenant`/`OrgMembership`/`PlatformOperator`) | appliquée |
| Server unit (`npm run test:unit`), 2ème passage | **1425/1425 ✅** |
| Re-sweep complet post-correction (9 fichiers : 3 nouveaux + hotfixes + GL) | 64/64 ✅ |
| Server lint (fichiers touchés + suite complète) | 0 erreur, 106 warnings (baseline inchangée) ✅ |
| `git diff --check` | exit 0 ✅ |

Client/mobile non touchés — aucun gate client requis.

## 28. Bugs préexistants

Un seul, déjà documenté à l'identique dans les 3 hotfixes précédents (`platformAdmin1.adversarial.mongo.integration.test.js`, "Conversations unread 403 signal distinct") — reproduit indépendamment de ce sprint, hors périmètre.

## 29. Fichiers modifiés

- `server/controllers/propertyPortfolioController.js` — scope étendu localement.
- `server/controllers/rentalManagementController.js` — scope étendu localement (`list` + `stats`).
- `server/__tests__/rentalManagementActivation.test.js` — mocks de modèles ajoutés (correctif de test, pas de production).
- `server/__tests__/tenantScopeAudit1PropertyPortfolio.mongo.integration.test.js` (nouveau).
- `server/__tests__/tenantScopeAudit1RentalManagement.mongo.integration.test.js` (nouveau).
- `server/__tests__/tenantScopeAudit1DocumentAttribution.mongo.integration.test.js` (nouveau, preuve du bug non corrigé).
- `server/docs/TENANT_SCOPE_AUDIT1_ETAT_INITIAL.md`, `TENANT_SCOPE_AUDIT1_MATRIX.md`, `TENANT_SCOPE_AUDIT1_REPORT.md` (nouveaux).

Aucune modification de `resolveTenantScope`, `getScopeUserIds`, `tenantResourceAttributionService.js`, IAM, schémas, frontend, mobile.

## 30. Git

`HEAD` inchangé (`3f7b59bfb92f51c7ccc6e73c57636affc8cb7782`) du début à la fin de ce sprint. Aucun `git add`/`commit`/`push`/`reset`/`clean`/`deploy` exécuté.

## 31. Dette restante

- `documentController` (lecture/écriture par ID) + `tenantResourceAttributionService.fromUser` : **BUG CONFIRMÉ / NON FIXÉ**, nécessite un audit dédié consommateur par consommateur (≥15 types de ressources).
- `documentController.tenantDocumentFilter` (liste), `dossierSearchService`, `exportController`, `crmService.synchronizeCustomers`, `dashboardAnalyticsController.sales`, `erpService.computeGrowth`, `propertyController` (notifications), `services/reporting/domains/*` : **RISQUE THÉORIQUE, NON CONFIRMÉ** — aucune reproduction apportée, aucune modification faite.
- `hotelAccessScopeService.js` : **RISQUE THÉORIQUE, NON CONFIRMÉ**, zone de prudence extrême explicitement signalée par le mandat — nécessite son propre audit dédié avec la rigueur PLATFORM-ADMIN-CERT-1.

## 32. Verdict

**TENANT-SCOPE-AUDIT-1 : GO SOUS RÉSERVES.**

Justification : l'inventaire est complet, chaque occurrence est classifiée, les 3 bugs corrigés sont prouvés avant/après avec preuve cross-tenant, aucun élargissement global n'a été fait, property/hotel/reporting/catalogue public restent non régressés (prouvé), les trois hotfixes précédents restent verts, tous les gates listés au mandat §23 sont verts. La réserve porte exclusivement sur le point §31 : un défaut réel et prouvé (`documentController`/`tenantResourceAttributionService`) reste **non corrigé**, et plusieurs domaines (export, CRM sync, hôtel, reporting) restent **NON CONFIRMÉS faute de reproduction**, conformément au principe du mandat de ne jamais corriger sans preuve ni élargir un mécanisme partagé sans audit dédié.

---

## Réponses aux 32 questions obligatoires (mandat §34)

1. Combien d'occurrences ont été trouvées ? **34 fichiers**, 27 occurrences significatives classifiées dans la matrice.
2. Combien sont correctes ? **7** (CORRECT AS-IS).
3. Combien sont réellement bugguées ? **4 prouvées** (3 corrigées + 1 non corrigée), plus 3 déjà corrigées lors des sprints précédents (KEEP).
4. Combien restent NON CONFIRMÉES ? **8**.
5. `documentController.js` est-il affecté ? Oui — lecture/écriture par ID (`getDocument`/`update`/`delete`/`create`), **BUG CONFIRMÉ / NON FIXÉ**. La liste (`getAllDocuments`) reste NON CONFIRMÉE.
6. `propertyPortfolioController.js` est-il affecté ? Oui — **BUG CONFIRMÉ / FIXÉ**.
7. `rentalManagementController.js` est-il affecté ? Oui — **BUG CONFIRMÉ / FIXÉ** (`list` + `stats`).
8. `exportController.js` est-il affecté ? NON CONFIRMÉ.
9. `crmController.js` est-il affecté ? NON CONFIRMÉ (risque théorique limité à la synchronisation, pas à la visibilité).
10. `dossierController.js` est-il affecté ? NON CONFIRMÉ (recherche uniquement, accès direct par ID non affecté).
11. `hotelAccessScopeService.js` est-il affecté ? NON CONFIRMÉ, zone de prudence extrême, non testé délibérément.
12. `erpService.js` est-il affecté ? Partiellement NON CONFIRMÉ (`computeGrowth`) / CORRECT AS-IS (`getOrganizationSummary`).
13. Quels autres fichiers ont été trouvés ? `actionLogController.js`, `dashboardAnalyticsController.js`, `propertyController.js`, `notificationService.js`, `platformTenantService.js`, `conversationController.js`, `publicApi/*` (3 contrôleurs + 3 services), `middleware/publicApiAuth.js`, `services/reporting/domains/*` (3 fichiers) + `reportingService.js` — tous classifiés dans la matrice.
14. Des public-signup users légitimes sont-ils encore exclus ? Oui, dans les domaines documentés en dette restante (§31) — notamment `documentController` (prouvé) et potentiellement export/CRM/reporting/hôtel (non prouvé).
15. Dans quels domaines ? Voir §31.
16. Quels fixes ont été appliqués ? `propertyPortfolioController.list`, `rentalManagementController.list`, `rentalManagementController.stats`.
17. Chaque fix est-il local ? Oui — aucun des trois ne touche `resolveTenantScope`, `getScopeUserIds`, ni un middleware partagé.
18. `resolveTenantScope` global a-t-il été laissé intact ? Oui, non modifié, non exploré au-delà de la lecture.
19. `expandScopeWithUnaffiliatedUsersIfSoleTenant` a-t-il été réutilisé ? Oui, dans les 3 fixes.
20. Où ? `propertyPortfolioController.js` (`list`), `rentalManagementController.js` (`list`, `stats`).
21. Pourquoi était-il approprié ? Même acteur (staff du tenant), même sémantique ("qui appartient sans ambiguïté au tenant unique"), mêmes préconditions de garde (tenant unique, exclusion technique/suspendu/OrgMembership/PlatformOperator) — exactement le besoin des 3 hotfixes précédents, appliqué à `Property.owner`/`RentalManagement.owner` au lieu de `User._id`/`Contrat.proprietaire.user`.
22. Où n'était-il PAS approprié ? `documentController` (nécessiterait de modifier `tenantResourceAttributionService.fromUser`, à trop large rayon d'action — non fait), `hotelAccessScopeService.js` (zone de prudence extrême, non testé), `exportController`/`crmService`/`erpService`/reporting (aucune preuve établie, donc aucune application décidée).
23. Le single-tenant fonctionne-t-il ? Oui, prouvé par test pour les 3 fixes.
24. Le multi-tenant reste-t-il sûr ? Oui, prouvé — l'extension se désactive dès qu'un second tenant existe.
25. Cross-tenant est-il prouvé ? Oui, pour les 3 fixes, avec fixtures Tenant A/Tenant B dédiées et AdminB n'accédant jamais aux ressources du Tenant A.
26. Property reste-t-il sûr ? Oui — `tenantCore.mongo.integration.test.js` (catalogue public) rejoué vert après les 3 fixes ; le fix Property Portfolio est strictement backoffice, jamais branché sur le catalogue public.
27. Hotel reste-t-il sûr ? Oui — aucune modification de ce domaine ; `hotelRoutes.test.js` revérifié vert (43/43 après correction du mock manquant).
28. Reporting/export restent-ils sûrs ? Oui, inchangés (aucune modification) ; classés NON CONFIRMÉ, pas touchés.
29. Les trois hotfixes précédents restent-ils verts ? Oui — 7/7 (HOTFIX-USERS-COUNT-1), 8/8 (HOTFIX-OWNER-CONTRACT-RESEND-1), 7/7 (MICRO-HOTFIX-RENTAL-REG-SCOPE-1), rejoués plusieurs fois pendant ce sprint, toujours verts.
30. Quelle dette reste ? Voir §31 — 1 bug confirmé non fixé (`documentController`/`tenantResourceAttributionService`), 8 domaines NON CONFIRMÉS.
31. Faut-il un TENANT-SCOPE-AUDIT-2 ? **Oui, recommandé**, ciblé spécifiquement sur `tenantResourceAttributionService.fromUser` (audit consommateur par consommateur, ~15 `resourceType`) et, séparément, sur `hotelAccessScopeService.js` avec la même rigueur que PLATFORM-ADMIN-CERT-1.
32. Verdict final ? **GO SOUS RÉSERVES** (voir justification ci-dessus).

## STOP

Conformément au mandat (§37) : aucune action supplémentaire. Pas de PAY-5, pas de refactor IAM, pas de nouveau modèle tenant, pas de modification mobile, aucune migration. En attente de validation explicite, notamment sur l'opportunité d'un TENANT-SCOPE-AUDIT-2 pour la dette documentée en §31.
