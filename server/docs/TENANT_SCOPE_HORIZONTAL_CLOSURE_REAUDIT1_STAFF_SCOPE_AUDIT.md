# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Audit staff sans tenant / multi-tenant ambigu / fallback global

## Pattern « fallback global involontaire » recherché

`if (tenant) { filter.tenant = tenant } ` sans `else` restrictif — recherché par analyse de branches (pas seulement grep littéral) dans tous les controllers listés aux domaines ci-dessous.

### Confirmés (branches qui retombent sur `{}`/aucun filtre en l'absence de tenant résolu)

- `paiementController.getAll/getStats/getAlertes` — `filter = {}` construit uniquement à partir de `req.query`, jamais de `req.platformTenant` (RA-02).
- `contratController.getAll` — même pattern (RA-04).
- `locataireController.getAll`, `proprietaireController.getAll` — même pattern (RA-15).
- `visiteController.getAllVisites/getAllPayments` — `Visite.find()`/`Visite.find({paiementStatus:...})` sans aucun filtre (RA-06).
- `litigeController.*` — `isStaff` ⇒ `filter = {}` explicite, sans branche `else` restrictive (RA-07).
- `signalementController.getAllSignalements` — filtre construit uniquement de `statut`/`propertyId` (RA-07/08 apparentés).
- `transactionController.getAllTransactions` — filtre `status`/`transactionType` seulement (RA-14).
- `realEstateApplicationController.list` — `isStaff(user) ? {} : {...}` littéral (RA-08).
- `quoteController.getAllQuotes` — aucune notion tenant sur le modèle du tout (RA-16).
- `dashboardKpiQueryService.getDashboardKpis` — comptages globaux, aucun paramètre tenant dans la signature (RA-17).
- `rentalMaintenanceController.list` (staff, sans `propertyId`) — `query = {}` (RA-19).

### SAFE (fallback en apparence mais correctement bordé)

- `dashboardAnalyticsController.getModuleAnalytics` (module `accommodations`) : `sameTenant = !actorTenantId || ...` — en apparence un fallback global, mais la route (`dashboardAnalyticsRoutes.js`) applique `requireTenantScopeForAnalytics` avec `allowPlatformWide: true` et `requireWhen: isPlatformOperator || ALL_STAFF` : un staff `ALL_STAFF` sans tenant résolu est 403 **avant** d'atteindre ce code ; seul un PlatformOperator réellement non-scopé (mode plateforme explicitement autorisé pour ce module analytics) peut déclencher cette branche — comportement voulu et documenté, pas une régression. Signalé comme dette de robustesse (pattern fragile à ne pas copier-coller ailleurs sans le même garde de route), pas comme un gap.

## Staff sans tenant → fail-closed ?

Confirmé fail-closed pour tous les domaines déjà couverts par HF-FINAL-01/RBAC-FINAL-01/HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 (Messaging lecture, Accommodation, Hotel, Property canonique, RentalManagement) — re-testé via les 3 suites permanentes (24+14+12 tests, voir `_GATE_MATRIX.md`). **Non fail-closed** dans tous les domaines listés en CONFIRMED GAP ci-dessus : un staff sans tenant résolu (ou de tenant A) atteint des données/mutations globales/d'un autre tenant B, précisément parce qu'aucun garde tenant n'existe sur ces routes, fail-closed ou non.

## Multi-tenant ambigu sans en-tête `X-Platform-Tenant-Id`

Comportement HF-FINAL-01 (403 sur tenant ambigu) reconfirmé intact pour Messaging (tests 8/10 de `messageReadAuthority.mongo.integration.test.js`, tests dédiés de `messagingTenantAmbiguousStaff.mongo.integration.test.js`). Pour les domaines en CONFIRMED GAP, la question est sans objet différentiel : ces routes ne vérifient le tenant dans **aucun** cas (ni résolu, ni ambigu, ni absent) — un staff multi-tenant sans en-tête obtient exactement le même résultat qu'un staff mono-tenant : accès total, non filtré.

## Admin A / Admin B

- Sur les surfaces SAFE (Property canonique, Accommodation, Hotel, RentalManagement, PlatformTenant) : Admin A → A autorisé, Admin A → B refusé, confirmé par les hotfixs déjà certifiés et par les contre-exemples cités dans `_OBJECTID_AUTHORITY_AUDIT.md`.
- Sur les surfaces en CONFIRMED GAP (RA-02 à RA-17) : Admin A → B est **systématiquement autorisé**, puisque `Admin` dispose de la capacité joker `*` (voir `utils/iamArchitecture.js:DEFAULT_CAPABILITIES.Admin`) et qu'aucune de ces routes ne vérifie de tenant après la capacité.

## PlatformOperator — global vs « scopé »

Confirmé (finding RA-22, agent fallback) : le modèle `PlatformOperator` **n'implémente aucune notion de PO restreint à une liste de tenants** — chaque opérateur actif peut sélectionner n'importe quel `PlatformTenant` par ID via l'en-tête, sans filtre d'appartenance. C'est un comportement voulu par le modèle de données actuel (l'opérateur est une identité de confiance plateforme, gouvernée par rôle/statut, pas par une liste blanche de tenants qui n'existe pas). Ce re-audit ne le traite pas comme une régression du code, mais documente explicitement que l'hypothèse « PO scopé à des tenants précis » du mandat (§17) ne correspond à aucune implémentation existante — à faire trancher par le produit si un vrai périmètre de PO restreint est un jour souhaité.
