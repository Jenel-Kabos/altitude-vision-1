# TENANT-REGRESSION-1 — Rapport de clôture

Date : 10 août 2026.

## Verdict

**PASS.** Les trois conditions de sortie sont satisfaites : Backend Unit complet vert, Backend Mongo complet vert et sécurité adversariale tenant verte. Aucune protection runtime n'a été relâchée pendant ce sprint.

L'inventaire initial et la classification détaillée A–F figurent dans [`TENANT_REGRESSION_1_AUDIT.md`](./TENANT_REGRESSION_1_AUDIT.md).

## Corrections réalisées

### Helper tenant-aware

`__tests__/helpers/tenantAwareFixture.js` centralise :

- `createTenantFixture` : création du `PlatformTenant` et de sa root org via le service canonique ;
- `addTenantMember` : création de l'`OrgMembership` via `organizationService` ;
- `tenantActor` et `createTenantUser` : acteurs portant un scope explicite ;
- `createTenantHotel` : hôtel directement attribué au tenant.

La chaîne de fixture est donc `PlatformTenant -> rootOrgUnit -> OrgMembership -> User -> ressource métier`, sans tenant inventé ni fallback global.

### Finance et Hôtel

- Les hôtels, réservations, documents financiers et acteurs de test portent désormais une attribution cohérente.
- Les attentes « Admin global » ont été remplacées par « Admin doté de ses capacités dans son tenant ».
- Le dashboard financier ne consolide plus implicitement plusieurs tenants.
- Le scénario JWT de résilience crée deux propriétaires dans deux tenants distincts. Une ressource étrangère est masquée en 404 et toute mutation falsifiée reste refusée.
- Les mocks Unit de portée hôtel autorisent uniquement l'Admin ou le propriétaire attendu ; les cas tiers continuent de vérifier le refus.

### Documents

- Les documents legacy de la whitelist possèdent désormais tenant, membres et relations explicites.
- Les factures Accommodation/Hôtel, ainsi que leurs réservations, sont attribuées au tenant du scénario.
- Aucun document unresolved n'est rendu accessible par défaut.

### Conversations

- Aucun changement spécifique n'a été nécessaire dans les fixtures Mongo de ce sprint.
- Les protections TENANT-ATTRIBUTION-1 restent couvertes par les tests adversariaux et par le targeted run incluant `conversationRoutes.test.js`.
- Le scénario original A vers B par ObjectId reste refusé.

### GL et Accommodation

- Les tests de dossiers, reporting et organisation simulent le contexte tenant ou créent membership et ressources métier cohérentes.
- Les fixtures Accommodation financières associent tenant, réservation, voyageur, propriétaire et document.
- Aucun endpoint, aucune règle GL/Accommodation et aucun fallback runtime n'ont été ajoutés.

### Backend Unit

Les suites HTTP à modèles mockés simulent explicitement `tenantContextService` et `tenantResourceAttributionService`. Cela évite les queries réelles pendantes tout en gardant les chemins 401/403/404. Les timeouts initiaux n'étaient donc pas des défauts runtime mais des fixtures incomplètes.

## Attentes historiques modifiées

- Admin Hôtel/Finance global -> Admin limité à son tenant.
- Consolidation dashboard globale -> consolidation du tenant courant.
- Lecture inter-tenant financière en 403 -> ressource étrangère masquée en 404.
- Ressource sans attribution acceptée par rôle/ownership -> attribution déterministe requise ou refus fail-closed.

## Régressions applicatives et impacts runtime

Aucune vraie régression applicative (classe D) n'a été trouvée. Par conséquent, **aucun fichier applicatif n'a été modifié par TENANT-REGRESSION-1**. Les changements runtime TENANT-ATTRIBUTION-1 déjà présents dans le worktree ont été préservés tels quels : attribution centrale, middleware tenant, protections Documents/Conversations/Finance/Hôtel et modèles associés.

## Résultats des tests réellement exécutés

Toutes les exécutions ci-dessous sont neuves et datées de ce sprint.

| Gate | Commande | Résultat |
| --- | --- | --- |
| Backend Unit complet | `npm run test:unit -- --runInBand` | PASS — 105 suites, 1 217 tests, 90,945 s |
| Backend Mongo complet | `npm run test:mongo` | PASS — 64 suites, 587 tests, 688,821 s ; replica set arrêté proprement |
| Adversarial tenant | 3 suites tenant ciblées | PASS — 3 suites, 18 tests, 63,734 s |
| Finance/Hôtel/Documents/Conversations/GL/Accommodation ciblés | 6 suites ciblées | PASS — 6 suites, 61 tests, 133,767 s |
| Finance resilience replica ciblé | `financialCore.resilience.replica.integration.test.js` | PASS — 24 tests, 40,633 s |
| Web Vitest | `npm test` dans `client` | PASS — 76 fichiers, 510 tests, 25,51 s |
| Mobile Jest | `npm test` dans `altimmo-app` | PASS — 24 suites, 227 tests, 14,632 s |
| TypeScript mobile | `npm run typecheck` | PASS |
| Expo Doctor | `npm run doctor` | PASS — 20/20 contrôles |
| ESLint serveur | `npm run lint` | PASS — 0 erreur, 124 warnings legacy |
| ESLint client | `npm run lint` | PASS — 0 erreur, 268 warnings legacy |
| ESLint mobile | `npm run lint` | PASS — 0 erreur, 82 warnings legacy |
| Next.js build | `npm run build:next` | PASS — Next 15.5.22, 142 pages statiques générées |
| Export Android | `npm run export` | PASS — bundle Android Hermes 6,6 MB, 54 assets |
| Playwright desktop | `npm run test:e2e -- --project=desktop-chromium` | PASS — 17/17, 5,3 min |
| Playwright mobile | `npm run test:e2e -- --project=mobile-chromium` | PASS — 17/17, 6,0 min |
| Diff whitespace | `git diff --check` | PASS — aucun défaut ; avertissements CRLF/LF préexistants uniquement |

L'EPERM sandbox rencontré par Supertest/Playwright et l'échec DNS initial d'Expo Doctor ont été qualifiés comme infrastructure (classe E). Leurs reruns hors sandbox sont ceux retenus ci-dessus.

Le premier run mobile complet a produit 16/17 avec un échec intermittent sur le portefeuille Établissements. Le scénario a immédiatement passé isolément (1/1, 55,3 s), puis le second run mobile **complet** a passé 17/17. Le résultat certifiant est ce second run complet ; le flake initial reste documenté dans les dettes ci-dessous.

## Fichiers créés par TENANT-REGRESSION-1

- `server/__tests__/helpers/tenantAwareFixture.js`
- `server/docs/TENANT_REGRESSION_1_AUDIT.md`
- `server/docs/TENANT_REGRESSION_1_REPORT.md`

## Fichiers modifiés par TENANT-REGRESSION-1

- `server/__tests__/accommodationRoutes.test.js`
- `server/__tests__/documentFilterWhitelist.mongo.integration.test.js`
- `server/__tests__/financialAccommodationDocumentsListing.mongo.integration.test.js`
- `server/__tests__/financialCore.resilience.replica.integration.test.js`
- `server/__tests__/financialSecurityHotelAdapter.test.js`
- `server/__tests__/hotelAccessFinalizationF263.mongo.integration.test.js`
- `server/__tests__/hotelEntityAccessF262.mongo.integration.test.js`
- `server/__tests__/hotelFinancialCheckoutF23.mongo.integration.test.js`
- `server/__tests__/hotelFinancialDashboardF25.mongo.integration.test.js`
- `server/__tests__/hotelOperationalAccessF261.mongo.integration.test.js`
- `server/__tests__/hotelOperationsRoutes.test.js`
- `server/__tests__/hotelReservationRoutes.test.js`
- `server/__tests__/hotelRoutes.test.js`
- `server/__tests__/hotelStaffAccessF26.mongo.integration.test.js`
- `server/__tests__/housekeepingMaintenanceRoutes.test.js`
- `server/__tests__/organization.mongo.integration.test.js`
- `server/__tests__/rentalDossiersRoutes.test.js`
- `server/__tests__/reporting.mongo.integration.test.js`
- `server/__tests__/routeOrdering.test.js`

## Dettes et risques résiduels

- Les trois linters restent verts mais signalent respectivement 124, 268 et 82 warnings legacy ; ils ne sont pas issus exclusivement de ce sprint.
- Vitest journalise volontairement une erreur simulée et des APIs JSDOM non implémentées ; le gate reste intégralement vert.
- Mobile Jest journalise des warnings React `act(...)` ; le gate reste intégralement vert.
- Les bases `baseline-browser-mapping`, Browserslist/caniuse sont signalées anciennes par les outils de build ; leur mise à niveau sort du périmètre de cette réparation tenant.
- Le scénario Playwright mobile du portefeuille Établissements a fluctué une fois lors d'un run long avant de passer isolément puis dans le rerun complet. Sa stabilité temporelle reste à surveiller.
- Le dépôt contenait déjà les modifications non commitées TENANT-ATTRIBUTION-1. Elles ont été conservées et n'ont pas été écrasées.

## Confirmations

- Aucun commit.
- Aucun push.
- Aucun déploiement.
- Aucune migration destructive.
- Aucun backfill réel.
- Aucune suppression de données.
- Aucune réintroduction d'un bypass Admin global.
- Aucun fallback tenant global.
