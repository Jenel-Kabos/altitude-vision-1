# TENANT-REGRESSION-1 — Audit initial

Date de l'audit : 10 août 2026.

## Périmètre et méthode

L'audit a été réalisé avant les corrections de ce sprint à partir d'une exécution neuve de la suite MongoDB complète (`npm run test:mongo`). Le résultat initial était de 11 suites en échec sur 64, 49 tests en échec sur 587. La suite Unit a ensuite été exécutée séparément ; ses blocages ont été isolés fichier par fichier, sans modification du code runtime de sécurité.

Classification utilisée : A = fixture sans tenant ; B = attente legacy Admin global ; C = relation métier incomplète ; D = vrai bug introduit ; E = flake/infrastructure ; F = test devenu invalide.

## Cartographie initiale MongoDB

| Suite | Domaine | Cause observée | Hypothèse historique | Contrat tenant attendu | Classe |
| --- | --- | --- | --- | --- | --- |
| `documentFilterWhitelist.mongo.integration.test.js` | Documents | Documents et acteurs sans attribution tenant | Une ressource isolée pouvait être lue par son rôle seul | Tenant, membership et attribution explicite ou refus fail-closed | A |
| `hotelEntityAccessF262.mongo.integration.test.js` | Hôtel | Hôtels/acteurs sans chaîne tenant complète | Admin global et ownership seuls suffisants | Hôtel et acteur dans le même tenant | A, B |
| `hotelOperationalAccessF261.mongo.integration.test.js` | Hôtel | Portée opérationnelle legacy globale | Admin voit tous les hôtels | Admin limité aux hôtels de son tenant | B, F |
| `hotelStaffAccessF26.mongo.integration.test.js` | Hôtel | Affectations sans tenant résolu | Le rôle ou l'affectation suffisait hors tenant | Membership, tenant et affectation cohérents | A, C |
| `hotelAccessFinalizationF263.mongo.integration.test.js` | Hôtel | Fixture de concurrence non attribuée | L'Admin global pouvait finaliser toute ressource | Ressource directement attribuée au tenant actif | A, B |
| `hotelFinancialCheckoutF23.mongo.integration.test.js` | Finance/Hôtel | Acteur et hôtel sans tenant | Autorisation financière fondée sur rôle/manager | Tenant actif et hôtel du même tenant | A, C |
| `hotelFinancialDashboardF25.mongo.integration.test.js` | Finance/Hôtel | Consolidation Admin globale attendue | Dashboard multi-hôtels global | Consolidation limitée au tenant courant | B, F |
| `organization.mongo.integration.test.js` | Organisation/Reporting | Hôtel de reporting non attribué | Reporting organisationnel sans contexte SaaS | Tenant, root org, membership et hôtel tenant-aware | A, C |
| `reporting.mongo.integration.test.js` | Reporting | Acteur et hôtel sans appartenance commune | Le rôle autorisait le reporting | Scope organisationnel déterministe dans un tenant | A, C |
| `financialAccommodationDocumentsListing.mongo.integration.test.js` | Finance/Accommodation | Utilisateurs, réservations et documents sans tenant | Les relations personnelles ou le rôle suffisaient | Membership et `tenant` explicite sur documents/réservations | A, C |
| `financialCore.resilience.replica.integration.test.js` | Finance/Hôtel | Scénario JWT à deux propriétaires sans tenants | Refus inter-propriétaires en 403 | Deux tenants distincts ; ressource étrangère masquée en 404 | A, F |

## Cartographie initiale Unit

Les premiers runs complets n'étaient pas qualifiables : des routes nouvellement protégées tentaient de résoudre un tenant réel à travers des modèles entièrement mockés et atteignaient le timeout. Les relances isolées ont établi les causes suivantes :

| Suites | Cause | Classe | Correction de fixture attendue |
| --- | --- | --- | --- |
| `hotelRoutes.test.js`, `hotelOperationsRoutes.test.js`, `hotelReservationRoutes.test.js` | services tenant/access non simulés | A | mocks tenant déterministes et portée hôtel négative conservée |
| `accommodationRoutes.test.js`, `rentalDossiersRoutes.test.js`, `routeOrdering.test.js` | middleware strict monté avec modèles mockés | A | mocks du contexte et de l'attribution ; aucune requête DB pendante |
| `housekeepingMaintenanceRoutes.test.js` | scope tenant/hôtel absent | A, C | tenant unique et liste d'hôtels explicitement limitée |
| `financialSecurityHotelAdapter.test.js` | attente « Admin global » | B, F | Admin doté de toutes les capacités uniquement dans son tenant |

Les erreurs `EPERM` rencontrées dans la sandbox lors de l'ouverture des serveurs Supertest ont été classées E : elles disparaissent lors d'une exécution autorisée hors sandbox. Les timeouts dus à des queries non mockées étaient, eux, des défauts réels de fixtures et non des flakes.

## Conclusions de l'audit

- Aucun échec n'a démontré un bug runtime nécessitant d'assouplir l'isolation.
- Les classes rencontrées sont A, B, C, E et F. Aucun cas D n'a été confirmé.
- Les attentes Admin globales sont obsolètes : un Admin conserve ses capacités fonctionnelles, jamais une visibilité inter-tenant.
- Les ressources étrangères doivent être masquées en 404 lorsque le filtrage tenant intervient avant l'autorisation métier.
- Un helper commun doit construire `PlatformTenant -> rootOrgUnit -> OrgMembership -> User -> ressource` pour éviter la duplication dans les tests MongoDB.
- Les tests Unit à modèles mockés doivent simuler explicitement le contrat du middleware tenant, tout en préservant leurs cas négatifs d'autorisation.

