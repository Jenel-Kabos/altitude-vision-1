# PLATFORM-ADMIN-CERT-1 — Audit de certification adversariale

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Documents de référence : `server/docs/PLATFORM_ADMIN_1_AUDIT.md`, `server/docs/PLATFORM_ADMIN_1_REPORT.md`

## Méthode

Cartographie systématique, domaine par domaine, de la garde d'autorisation réelle (middleware monté + logique contrôleur/service), suivie d'une classification honnête (`TESTÉ DIRECTEMENT` / `HÉRITÉ MAIS NON TESTÉ` / `NON APPLICABLE` / `ÉCHEC` / `BLOQUÉ`), conformément à la mission. Aucune supposition — chaque ligne de la matrice est sourcée par lecture de code.

## Matrice d'architecture d'autorisation

| Domaine | Garde réelle | PlatformOperator supporté par construction ? |
|---|---|---|
| Property/Portfolio | `requireTenantScope` (`propertyRoutes.js:28`) | Oui — déjà testé PLATFORM-ADMIN-1 |
| Conversations | `requireTenantScope` (`conversationRoutes.js:23`) | Oui — déjà testé PLATFORM-ADMIN-1 |
| Reporting | `requireTenantScopeAllowPlatformWide` (`reportingRoutes.js`) | Oui — déjà testé PLATFORM-ADMIN-1 |
| Gouvernance PlatformOperator | `platform.operators.manage` | Oui — déjà testé PLATFORM-ADMIN-1 |
| Hotel | `requireTenantScope` (`hotelRoutes.js:29`) + `assertOperationalHotelAccess`/`assertResourceTenant` en profondeur | Oui, architecturalement — **non testé directement avant ce sprint** |
| Accommodation | **Pas de `requireTenantScope`** — `assertResourceTenantOrUnattributed` au niveau contrôleur (`accommodationController.js:21,55`) | Oui, architecturalement (résolution via `resolveTenantForUser`, bénéficie de la correction centrale) — **non testé directement avec identité opérateur avant ce sprint** (couverture existante = Admin/Admin uniquement, TENANT-CERT-3-PRE) |
| Documents (`documentRoutes.js`) | `requireTenantScope` + `assertResourceTenant` (`documentController.js:176`) | Oui — non testé directement |
| **Documents (`gestionDocumentRoutes.js`)** | **AUCUNE** — rôle seul (`STAFF_DOC`/`Admin`) | **NON — VULNÉRABLE confirmé** |
| Finance | `requireTenantScope` (`financialRoutes.js:8`) + `assertFinancialScope`/`hasPlatformOperatorFinanceCapability` | Oui — additif, vérifié non-régressif, non testé par HTTP direct avant ce sprint |
| CRM | `requireTenantScope` (`crmRoutes.js:7`) + double filtre tenant sur `consolidateCustomers` | Oui — fusion cross-tenant structurellement bloquée, non testé avec identité opérateur avant ce sprint |
| CRM Automation | `requireTenantScope` (`crmAutomationRoutes.js:13`) | Oui — non testé directement |
| Marketing | `requireTenantScope` (`marketingRoutes.js:14`) | Oui — non testé avec identité opérateur avant ce sprint |
| Organization | `staffOnly`/`restrictTo('Admin')` (pas `requireTenantScope`) + `assertOrgUnitInActorTenant`/`assertMembershipInActorTenant` (déjà durci TENANT-CERT-2) | Oui architecturalement (passe par `resolveTenantForUser`) — non testé avec identité opérateur |
| Reporting/ERP | ERP : `requireTenantScope` STRICT (pas de mode plateforme, contrairement à Reporting) — comportement inchangé, documenté comme non patché dans PLATFORM_ADMIN_1_REPORT.md §26 | Oui pour un tenant sélectionné, jamais de mode global (comportement voulu, non testé directement) |
| API Platform | `requireTenantScope` STRICT, jamais de mode global (`apiPlatformAdminController.js` force `req.platformTenant._id` partout) | Oui pour un tenant sélectionné — non testé avec identité opérateur |
| USER-ARCH (business profiles) | `assertTargetInActorTenant` (pas `requireTenantScope` mais même service `resolveTenantForUser`/`assertResourceTenant`) | Oui architecturalement — non testé avec identité opérateur |
| ActionLog | Attribution `tenant` correcte tant que `req.platformTenant` est renseigné | Oui — vérifié par lecture de code |
| GL — RentalManagement | `requireTenantScope` (`rentalManagementRoutes.js:27`) sur l'essentiel ; routes `owner/*` avant le middleware, scopées par ownership direct (safe) | Oui — non testé avec identité opérateur |
| GL — Paiement/Contrat | `resolveTenantForUser` + en-tête explicite (corrigé PLATFORM-ADMIN-1) | Oui — corrigé mais **jamais testé par un vrai test HTTP avec identité opérateur** |
| **GL — Locataire/Proprietaire CRUD** | **AUCUNE** sauf la seule route `identity-document` | **NON — VULNÉRABLE confirmé** |
| **GL — Régularisation (17 contrats historiques)** | **AUCUNE** | **NON — VULNÉRABLE confirmé, y compris attribution cross-tenant lors de la décision** |
| **User CRUD (`userRoutes.js`)** | **AUCUNE** sauf `role` seul (`restrictTo('Admin')`) | **NON — VULNÉRABLE confirmé, la plus sévère : lecture/modification/suspension/suppression/changement de rôle de N'IMPORTE QUEL utilisateur de N'IMPORTE QUEL tenant** |

## Vulnérabilités démontrées (à corriger, mission §40)

### V1 — User CRUD sans frontière tenant (`server/routes/userRoutes.js`)

`router.use(restrictTo('Admin'))` (ligne 44) protège `GET /`, `GET/PUT/DELETE /:id`, `PATCH /:id/verify|suspend|activate|role` — **aucune vérification tenant**. Un Admin du Tenant A peut lister, consulter, modifier, suspendre, activer, changer le rôle, ou supprimer n'importe quel utilisateur de n'importe quel tenant en devinant/énumérant un ObjectId. C'est la vulnérabilité la plus sévère trouvée dans ce sprint — un god-mode de fait sur l'identité de tous les utilisateurs de la plateforme, sans qu'aucune capacité PlatformOperator ne soit requise.

**Correction retenue** : monter `requireTenantScope` sur ce routeur (après les routes publiques/self-service), scoper `getAllUsers` à `req.tenantScopeUserIds`, et ajouter un `router.param('id', …)` qui vérifie que la cible appartient à `req.tenantScopeUserIds` avant tout accès — même patron que `paiementRoutes.js`/`contratRoutes.js`. Un PlatformOperator bénéficie automatiquement de cette correction via le même mécanisme central.

### V2 — Locataire/Proprietaire CRUD quasi sans frontière tenant

Seule la route `identity-document` est protégée. Le reste (`GET /`, `GET/PUT/DELETE /:id`, `dossiers`, `link-requests`, `invite`) n'a aucune vérification tenant.

**Correction retenue** : même patron `requireTenantScope` + `router.param('id', …)` avec `assertResourceTenantOrUnattributed`, cohérent avec `paiementRoutes.js`/`contratRoutes.js`.

### V3 — Centre de régularisation (17 contrats historiques) sans frontière tenant

`rentalContractRegularizationRoutes.js` n'a aucune vérification tenant. `getCases` interroge `Contrat.find({})` globalement. `decide()` permet d'attribuer un contrat historique à n'importe quel `propertyId`, sans jamais vérifier que ce Property appartient au même tenant que l'acteur — un Admin/Collaborateur de n'importe quel tenant peut donc attribuer un contrat historique à une Property d'un AUTRE tenant.

**Correction retenue** : scoper `getCases` par `req.tenantScopeUserIds` (via la relation `proprietaire.user`) et, dans `decide()`, vérifier explicitement que le `Property` cible appartient au même tenant que l'acteur avant toute attribution — jamais uniquement une vérification `owner`.

### V4 — `gestionDocumentRoutes.js` sans frontière tenant

Génération de documents légaux (bail, quittance, mise en demeure, préavis, état des lieux) résolus uniquement par `contratId`/`paiementId`, sans aucune vérification tenant.

**Correction retenue** : ajouter `requireTenantScope` + vérification que le `Contrat`/`Paiement` résolu appartient au tenant actif (réutiliser `assertResourceTenantOrUnattributed`).

### V5 — En-tête de sélection tenant jamais transmis (gap fonctionnel, pas une fuite de sécurité)

Découvert pendant l'écriture des tests adversariaux (pas par l'audit initial) : `resolveTenantForUser(userId, requestedTenantId)` accepte un second paramètre pour l'en-tête `X-Platform-Tenant-Id`, mais 7 sites d'appel l'ignoraient et appelaient `resolveTenantForUser(userId)` seul — `accommodationController.js`, `accommodationReservationController.js` (deux sites), `rentalDocumentController.js`, `rentalManagementRoutes.js`, `propertyController.js` (deux fonctions), `organizationController.js`. Conséquence : un PlatformOperator qui sélectionnait pourtant explicitement un tenant dans l'UI restait bloqué sur ces domaines précis — pas une fuite cross-tenant (aucune donnée n'était exposée à tort), mais une régression fonctionnelle qui aurait rendu la certification PlatformOperator incomplète pour Accommodation, Property, Organization, RentalManagement et les documents de bail. Corrigé de façon strictement additive (lecture de l'en-tête + transmission au paramètre déjà existant), aucun comportement existant modifié pour un non-opérateur.

### Corrections apportées après la première exécution complète des gates

Deux régressions réelles ont été détectées par la campagne Backend Unit/Mongo complète et corrigées avant certification finale :

1. **`router.param('id', …)` s'exécute avant tout middleware propre à la route dans Express** — `locataireRoutes.js`/`proprietaireRoutes.js` utilisaient ce mécanisme pour le correctif V2, ce qui faisait courir la vérification tenant AVANT les contrôles de rôle (`restrictTo`) déclarés par route (ex. `/:id/invite`), cassant `__tests__/tenantPortalRoutes.test.js` (403 attendu, 404 obtenu). Corrigé en remplaçant `router.param` par une fonction de middleware nommée, appliquée explicitement et uniquement sur les routes réellement concernées par V2 (`GET/PUT/DELETE /:id` et les sous-routes `/biens/*` de `proprietaireRoutes.js`), positionnée APRÈS le contrôle de rôle dans le tableau de middlewares de chaque route.
2. **`rentalContractRegularizationService.js`** — le correctif V3 a cassé `__tests__/rentalContractRegularization.mongo.integration.test.js`, un test de niveau service antérieur à toute notion de tenant qui appelait `getCases()`/`decide()`/`revert()` sans aucun contexte. Conformément à la mission (modifier un test dont l'hypothèse métier devient explicitement obsolète), ce fichier de test a été mis à jour pour transmettre `tenantScopeUserIds` correspondant au propriétaire de sa fixture — reflétant l'appel réel désormais effectué par le contrôleur HTTP.

Les deux corrections ont été revérifiées individuellement (18/18 et 6/6) puis par une campagne Backend Unit/Mongo complète fraîche.

## Principe de correction

Conformément à la mission §40, chaque correction est appliquée à la couche la plus centrale possible (middleware de routeur + service de résolution déjà existant `assertResourceTenant`/`assertResourceTenantOrUnattributed`/`resolveTenantForUser`), jamais un correctif isolé dans un seul contrôleur. Un test de non-régression permanent accompagne chaque correction.

## Domaines confirmés sûrs, à certifier par test direct (pas de correction requise)

Property, Conversations, Reporting, Hotel, Accommodation (chemin existant), Documents (`documentRoutes.js`), Finance, CRM (y compris fusion), CRM Automation, Marketing, Organization, ERP, API Platform, USER-ARCH, ActionLog, GL (RentalManagement/Paiement/Contrat une fois V1-V4 corrigés).
