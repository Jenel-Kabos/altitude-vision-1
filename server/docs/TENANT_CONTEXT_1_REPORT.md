# HOTFIX TENANT-CONTEXT-1 — Rapport

## 1. Cause exacte du 403

`GET /api/properties/portfolio` suit `propertyRoutes → protect → restrictTo(STAFF_IMMO) → requireTenantScope → tenantContextService → propertyPortfolioController → propertyPortfolioService`.

Après TENANT-HARDENING-1, `resolveAvailableTenantsForUser` ne considérait que les `OrgMembership` actifs. Un compte historique ayant créé Altitude Vision avant l'introduction des memberships n'en possède aucun : la résolution retournait donc `null`, puis `requireTenantScope` répondait 403. Le rôle Admin n'était ni la cause ni une preuve acceptable.

L'audit a aussi révélé que `getScopeUserIds` retourne un `Set`, alors que Property Portfolio attend un tableau. Sans normalisation, la route pouvait interpréter le scope comme absent. Le middleware normalise désormais toujours ce scope en tableau.

## 2. État réel du compte concerné

Le schéma historique ne relie pas `UserBusinessProfile` à une organisation. En revanche, la création canonique d'un tenant conserve deux relations réelles vers son créateur : `PlatformTenant.createdBy` et `OrgUnit.createdBy` sur la racine. Le fallback utilise cette double preuve uniquement; `role === 'Admin'` n'est jamais consulté.

## 3. Résolution avant / après

Avant : tenant explicitement accessible, sinon tenant unique via membership, sinon refus.

Après, fonction unique `resolveEffectiveTenantContext(userId, requestedTenantId)` :

1. tenant explicite présent dans les memberships actifs : `explicit_membership`;
2. un seul tenant actif par membership : `single_membership`;
3. aucune appartenance et une seule double preuve legacy sûre : `legacy_fallback`;
4. sinon `null`, puis 403.

## 4. Fallback legacy

Le fallback exige simultanément : aucun tenant demandé, aucun membership de quelque statut que ce soit, compte actif/non technique antérieur à la racine et au tenant, racine active créée par l'utilisateur, PlatformTenant actif/trial créé par le même utilisateur et résultat unique. Plusieurs candidats, un compte suspendu, un membership suspendu/révoqué ou un tenant suspendu/archivé échouent fermés.

Le middleware expose `req.tenantContextSource = 'legacy_fallback'` et ajoute uniquement l'utilisateur prouvé au scope de sa racine; il n'accorde jamais un catalogue global.

## 5. Protections fail-closed conservées

- tenant explicite adverse : refus;
- plusieurs tenants par membership sans sélection : refus;
- plusieurs racines legacy compatibles : refus;
- absence de relation : refus;
- rôle Admin seul : refus;
- membership inactif : aucun fallback de contournement;
- scope manquant : tableau vide, jamais filtre global.

## 6. Impact Property Portfolio

Aucune règle métier PROPERTY-PORTFOLIO-1 n'a changé. Le service continue d'agréger ventes, locations, hébergements et hôtels, de dédupliquer par Property physique et de calculer les KPI sur le dataset affiché. Seul le contexte commun fournit désormais un tableau `scopeUserIds` sûr. Le test HTTP direct prouve qu'un Admin legacy voit son bien et qu'un Admin sans relation reçoit 403.

## 7. Autres routes corrigées par le moteur commun

Le même middleware protège ActionLog, CRM, CRM Automation et Marketing; ces routes bénéficient de la résolution déterministe sans exception locale. Reporting/ERP consomment `resolveTenantScope` lorsqu'un tenant est fourni. Finance, Documents, Organization et API Platform n'utilisent pas actuellement `requireTenantScope`; aucun changement route-spécifique n'a été introduit.

## 8. Tests

Toutes les gates ont été exécutées fraîchement :

| Gate | Résultat |
|---|---|
| Tenant + Property Portfolio ciblés | PASS — 2 suites, 16 tests, 47,741 s |
| Backend Unit complet | PASS — 105 suites, 1 217 tests, 96,425 s |
| Backend Mongo complet | PASS — 62 suites, 579 tests, 675,222 s |
| Web Vitest complet | PASS — 76 fichiers, 510 tests, 32,35 s |
| Next.js build | PASS — 142 pages, compilation 39,5 s |
| ESLint serveur | PASS — 0 erreur, 124 avertissements existants |
| ESLint client | PASS — 0 erreur, 268 avertissements existants |
| Playwright desktop | PASS — 17/17, 5,5 min |
| Playwright mobile | PASS — 17/17, 5,7 min |
| git diff --check | PASS — contrôle final |

La première exécution ciblée a volontairement révélé la divergence `Set`/tableau du scope (15/16). Après correction commune, la relance complète ciblée est passée 16/16. Une tentative Web a appelé un script inexistant (`test:run`); elle n'est pas comptée comme gate et a été remplacée par la commande canonique `npm test`, réussie.

## 9. Risques

La preuve legacy dépend des champs `createdBy` historiques. Un tenant ancien qui ne les possède pas reste volontairement refusé et nécessite une régularisation métier explicite. Un créateur de plusieurs tenants reste ambigu et doit recevoir un membership ou choisir un tenant explicite après rattachement.

## 10. Dettes

- procédure contrôlée pour rattacher les comptes legacy non prouvables;
- observabilité persistante de `tenantContextSource` si une métrique opérationnelle est souhaitée;
- sélecteur tenant Web/Mobile pour les utilisateurs réellement multi-tenant.

## 11. Fichiers du hotfix

- `server/services/platformTenant/tenantContextService.js`;
- `server/middleware/tenantContext.js`;
- `server/__tests__/tenantHardening.mongo.integration.test.js`;
- `server/docs/TENANT_CONTEXT_1_REPORT.md`.

Les autres fichiers du worktree appartiennent aux sprints antérieurs et ont été préservés.

## 12. Confirmation

Aucun commit, push, déploiement, migration destructive, changement de données réelles ou modification de production n'a été effectué.
