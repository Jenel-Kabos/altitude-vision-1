# RBAC-2 — État initial

Date : 2026-08-22. Branche `main`. `HEAD` = `63880f58ff41bd805b828d07603d878d55122d45` (inchangé depuis RBAC-1). `git status --short` : 22 lignes au démarrage, toutes issues des sprints précédents de cette même session (RBAC-1 : 8 docs ; HOTFIX-WEB-GOOGLE-AUTH-1 : 1 fichier de code + 5 docs + 1 test ; HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 : 1 test + 6 docs). `git diff --check` exit 0. Aucun de ces fichiers n'est modifié ou écrasé par RBAC-2.

## Baseline RBAC-1 (relue intégralement, pas ré-auditée)

RBAC-1 : AUDIT CERTIFIÉ. Découverte principale : 5 systèmes d'autorisation coexistants (`User.role`, `UserBusinessProfile`, `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator`) plus une 6e couche déjà réellement branchée, `server/utils/iamArchitecture.js` (`DEFAULT_CAPABILITIES` + `requireCapability(...)`, câblée sur 10 fichiers de routes), elle-même dupliquée manuellement dans `client/lib/utils/staffCapabilities.js` (web, réellement consommée) et `altimmo-app/src/utils/staffCapabilities.js` (mobile, jamais consommée). 4 drifts P1 identifiés, aucun P0. Duplication interne au backend confirmée : `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` (même valeur d'ensemble, 4 noms).

## Cadrage RBAC-2

Ce sprint **ne crée aucun nouveau système d'autorisation**. Il consolide `iamArchitecture.js` comme source canonique des capacités STAFF globales, dédoublonne les 4 alias identifiés par RBAC-1, migre une seule route pilote à faible risque (`POST /property-asset/:id/transition`, déjà gatée par `STAFF_IMMO`, aucune complexité financière/hôtelière/plateforme), et prépare (sans l'exposer) un helper `getEffectiveCapabilities(role)` pour un futur payload `/me`.

## Découverte en cours de sprint (documentée honnêtement)

En auditant `iamArchitecture.js` en profondeur pour ajouter une validation "capacité inconnue → erreur de configuration claire" (mandat §32), la validation a immédiatement révélé que **`payments.reverse`** — exigée par `paiementRoutes.js` (`POST /:id/receipts/:receiptId/cancel`) depuis un sprint antérieur — n'était déclarée dans **aucun** rôle de `DEFAULT_CAPABILITIES`. Une première hypothèse de correction (se fiant au commentaire `CANCEL_ROLES = ['Admin', 'GestionnaireImmobilier']` de `paiementController.js`) s'est révélée **fausse** : elle cassait un test existant et intentionnel, `"IAM-3 : GestionnaireImmobilier ne peut pas annuler un encaissement"` (`rentalPaymentReceiptsAndCancellation.mongo.integration.test.js`). Corrigée après relecture de ce test — voir `RBAC2_MIGRATION_MATRIX.md` et `RBAC2_SECURITY_MATRIX.md` pour le détail complet de cet aller-retour, conservé ici pour la traçabilité plutôt que masqué.

## Plan

1. Auditer `iamArchitecture.js` en profondeur (`RBAC2_IAM_BASELINE_MATRIX.md`).
2. Construire la matrice rôle → capacités (`RBAC2_ROLE_CAPABILITY_MATRIX.md`).
3. Dédoublonner `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` en alias d'une constante unique, avec test anti-drift.
4. Ajouter la validation "capacité inconnue → erreur de configuration" + `getEffectiveCapabilities(role)` (préparé, non exposé).
5. Migrer une route pilote unique vers `requireCapability`, avec caractérisation avant/après et parité stricte prouvée par test.
6. Documenter la découverte `payments.reverse` et sa résolution correcte.
7. Gates complets (unit, Mongo pertinents, lint, `git diff --check`).
