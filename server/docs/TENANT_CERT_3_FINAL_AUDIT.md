# TENANT-CERT-3-FINAL — Baseline avant campagne adversariale

Date : 2026-08-12. Ce document a été créé avant toute modification runtime du sprint.

## 1. État du worktree

Le worktree contient plusieurs sprints non commités : 105 fichiers suivis sont modifiés et de nombreux fichiers sont non suivis. Les changements couvrent notamment TENANT-HARDENING-2, TENANT-CERT-3-PRE, STORAGE-SECURITY-1, STORAGE-LEGACY et CLOUDINARY-SANDBOX-PROVISION-1. Aucun fichier n'a été supprimé, réinitialisé ou restauré. `git diff --check` est vert ; seuls sept avertissements de future normalisation CRLF sont présents.

Les changements préexistants ne seront pas attribués automatiquement à TENANT-CERT-3-FINAL. Les seuls artefacts créés à ce stade par ce sprint sont ce rapport d'audit ; aucune ligne runtime n'a été modifiée.

## 2. Baseline tenant

La source de vérité demeure `PlatformTenant → rootOrgUnit → OrgMembership → User`. `requireTenantScope` résout le contexte effectif et refuse l'absence ou l'ambiguïté. `tenantResourceAttributionService` attribue les ressources par champ tenant direct ou preuve relationnelle et distingue `resolved`, `ambiguous` et `unresolved`. Les contrôleurs doivent appliquer la frontière tenant ET l'autorisation métier ; un rôle seul n'est jamais une preuve de tenant.

Les rapports requis ont été relus : TENANT-CERT-2, TENANT-HARDENING-2, TENANT-CERT-3-PRE, STORAGE-SECURITY-1, STORAGE-LEGACY-CERT-1, CLOUDINARY-SANDBOX-CERT-1 et CLOUDINARY-SANDBOX-PROVISION-1. Le code courant, et non ces rapports, reste l'autorité de la présente campagne.

## 3. Vulnérabilités déjà corrigées à préserver

- Property : anciens bypass `role === Admin` fermés par l'attribution canonique.
- GL/Organization/Reporting/ERP/exports/documents GL/notifications : frontières fermées par TENANT-CERT-2 et TENANT-HARDENING-2.
- Socket.IO : contexte tenant au handshake et contrôle de conversation au join.
- Mobile : cache purgé aux frontières de session.
- PlatformTenant ciblé par `:id` et Accommodation/AccommodationReservation list/get : corrections TENANT-CERT-3-PRE.
- Nouveaux documents privés : delivery authenticated et accès backend métier.

## 4. Modèle de menace

Deux tenants A et B, chacun avec Org racine, Admin, Gestionnaire, Collaborateur, Proprietaire, Exploitant, Locataire et Client. Les attaques connaissent les ObjectId de B. Les contrôles suivent strictement `B→B succès`, puis `A→la même ressource B refus`. Les cas complémentaires sont UserAB, ressource ambiguë/unresolved et opérateur plateforme selon la politique réelle.

Les données canaris B sont volontairement asymétriques (`TENANT_B_SECRET_SEARCH_938472`, grands KPI/montants B) afin qu'une fuite de liste, recherche, export ou agrégat soit visible.

## 5. Domaines à retester

Priorité obligatoire : Property Portfolio, Finance complète, USER-ARCH, API publique, recherche transverse ; puis PlatformTenant et Accommodation ; ensuite Property, GL, Hotel, Documents, Conversations, CRM/Automation, Marketing, Organization, Reporting, ERP, Webhooks, Notifications, Socket.IO, exports, ActionLog, jobs, e-mail, mass assignment et caches.

Pour chaque domaine applicable seront classés LIST, GET, SEARCH, CREATE, UPDATE, DELETE/ARCHIVE, opérations métier, EXPORT/DOWNLOAD, ASYNC, DASHBOARD/KPI. Une cellule non exercée restera `PARTIAL`, `N/A` ou `NOT TESTABLE`, jamais PASS par déduction.

## 6. Matrice prévue

| Domaine | Isolation/IDOR | Search/List | Write | Export/Download | Async/KPI |
|---|---|---|---|---|---|
| Portfolio | A/B + suppression source | canari B | N/A projection | N/A | KPI asymétriques |
| Finance | document/payment/allocation/journal | list/dashboard | issue/finalize/allocate/reverse | PDF/export | index/key |
| USER-ARCH | profile/history/effective | bulk derivation | grant/suspend/revoke | N/A | KPI |
| API Public | ApiKey A/B/legacy | pagination/filtres | webhook | N/A | dispatch |
| Search/Exports | canari global B | toutes surfaces trouvées | N/A | parse contenu | compteurs |
| PlatformTenant | Admin A/B/operator | list/detail | settings/status/subscription/domain | N/A | N/A |
| Accommodation | rôle+tenant | list/rates/availability | lifecycle/reservation/refund | documents | paiement |
| Autres domaines | contrôles hérités rejoués + attaques consolidées | selon applicabilité | selon applicabilité | selon applicabilité | selon applicabilité |

## 7. Exception storage legacy

La certification sépare obligatoirement : autorisation backend legacy (`PASS` si A→B refusé) et ancienne URL Cloudinary publique directe (`LEGACY-STORAGE-EXCEPTION`). Aucun asset réel, aucune migration et aucun appel volontaire au compte production `dop8vzm5z` ne seront effectués.

## 8. Risques connus avant attaque

- `platformTenantRoutes` considère actuellement tout Admin sans membership comme opérateur plateforme. Hypothèse à reproduire : un Admin normal dont la dernière membership est révoquée pourrait acquérir des capacités globales.
- `GET /platform-tenants` et `POST /platform-tenants` restent globaux pour tout Admin tenant-bound. Hypothèse à reproduire : fuite de métadonnées inter-tenant et création SaaS non autorisée.
- PRE documente les sous-flux financiers Accommodation comme insuffisamment retestés.
- Portfolio, Finance hors Hôtel, USER-ARCH, API publique et recherche transverse n'ont pas de preuve fraîche exhaustive.
- `assertResourceTenantOrUnattributed` préserve certains objets GL legacy unresolved : ces cas doivent être classés et ne doivent jamais devenir un fallback tenant implicite.
- Les URLs Cloudinary legacy restent exploitables hors application.
- Expo Doctor et deux scénarios Playwright étaient rouges lors de STORAGE-SECURITY-1 ; seul un run frais déterminera leur état actuel.

Ces éléments sont des hypothèses/limitations, pas encore des vulnérabilités déclarées par ce sprint. Toute correction exige test rouge, RCA, correction canonique et test vert.

## 9. Stratégie de certification

1. Créer une suite consolidée réutilisant les fixtures tenant existantes.
2. Attaquer d'abord les cinq domaines explicitement incomplets.
3. Reproduire les risques PlatformOperator/PlatformTenant et les corrections Accommodation.
4. Étendre aux domaines hérités, sorties asynchrones et caches.
5. Corriger uniquement une fuite réellement rouge, au point canonique minimal.
6. Rejouer suites de domaine, suites tenant ciblées, Backend Unit/Mongo, Web/Mobile/builds/linters/Playwright et `git diff --check`.
7. Produire un verdict exact, avec matrice, registre des risques, tests positifs/négatifs et exception Cloudinary legacy.

## Baseline runtime

À la création de ce document : **aucune modification runtime TENANT-CERT-3-FINAL**.
