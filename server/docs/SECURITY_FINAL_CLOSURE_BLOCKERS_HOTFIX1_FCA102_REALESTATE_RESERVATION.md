# SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 — FCA1-02 : reservations/:id [GET/cancel]

## Root cause
`realEstateApplicationController.getReservation`/`cancelReservation` accordaient l'accès via `isStaff(req.user)` sans jamais appeler `assertApplicationTenantAccessIfStaff`, contrairement à tous les autres handlers `Application` du même fichier (`getOne`, `review`, `accept`, `reject`, `downloadAttachment`) qui l'utilisent déjà systématiquement.

## Autorité canonique réutilisée
Exactement le helper déjà existant dans ce fichier : `assertApplicationTenantAccessIfStaff(req, res, application, isStaffGranted)`, introduit pour RA-08/P1-D. Appliqué sur `reservation.application` (peuplé via `.populate('application')`, ajouté à `cancelReservation` qui ne le faisait pas). Aucun nouveau helper créé.

`isStaffGranted` est calculé comme `isStaff(req.user) && !isClientOrOwner` — même convention que P1-D/P1-I (le contrôle tenant s'applique UNIQUEMENT quand l'accès est accordé via le statut staff, jamais quand l'acteur est déjà légitimé par son identité de client/propriétaire).

## Garde de route
Ajout de `requireTenantScopeForStaffOrPlatformOperator` sur les deux routes `reservations/:id` et `reservations/:id/cancel` — même garde que les endpoints `Application` sœurs de ce fichier (no-op pour client/propriétaire, résout `req.platformTenant` pour le staff). La reproduction RED a confirmé que cette seule garde de route ne suffit pas : elle bloque le staff sans tenant résolu, mais pas le staff dont le tenant résolu diffère de celui de la ressource — c'est le contrôle **au niveau ressource**, dans le contrôleur, qui ferme le blocker réel.

## Authority avant side effects
`cancelReservation` : la vérification est insérée juste après le calcul de `allowed` et **avant** : la validation du motif d'annulation, `workflow.releaseReservation` (qui modifie `Reservation.status`, libère potentiellement le bien, et déclenche les notifications).

## Reproduction RED → GREEN
Suite permanente : `server/__tests__/realEstateReservationTenantAuthority.mongo.integration.test.js` (10 tests).
- **Avant fix** (contrôle contrôleur temporairement désactivé, garde de route conservée) : 4/10 échoués (tests 2, 3, 6, 10 — les cas de désaccord tenant réel), 6/10 passés (les cas déjà couverts par la garde de route seule : sans tenant, header invalide, client légitime, PO global).
- **Après fix** : 10/10 verts.

## Side effects vérifiés sur refus (test 6)
`Reservation.status` reste `active` (pas `cancelled`). `Property.availability` du bien Tenant B reste `Réservé` (pas libérée).

## Lecture cross-tenant (GET)
Refusée avant fix (test 2/3 rouges), refusée après fix (200 uniquement pour même-tenant ou identité légitime) — aucune donnée sensible (`property.owner`, etc.) exposée cross-tenant.

## Admin/PlatformOperator
- Staff A→Reservation A : autorisé (test 1). A→B / B→A : refusés (tests 2, 3, 6).
- Client propriétaire de sa réservation : autorisé sans tenant (test 4).
- Staff sans tenant résolu : refusé, fail-closed (test 7).
- En-tête tenant invalide : refusé (test 8).
- PlatformOperator global : autorisé (test 9) — comportement historique préservé.
- PlatformOperator scoped sur A tentant B : refusé (test 10).

## Non-régression siblings (§19 du mandat — non modifiés, uniquement rejoués)
`securityClosureP1WaveRealEstateApplicationTenantAuthority` : 6/6 verts, aucune régression sur `getOne`/`review`/`accept`/`reject`/`downloadAttachment`.

## Statut
**FCA1-02 : CLOSED.**
