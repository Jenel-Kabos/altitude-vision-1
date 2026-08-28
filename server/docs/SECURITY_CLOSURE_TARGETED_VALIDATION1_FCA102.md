# SECURITY-CLOSURE-TARGETED-VALIDATION-1 — FCA1-02 (reservations/:id [GET/cancel])

## Vérification statique (code actuel)
- Routes réelles : `GET /api/real-estate-applications/reservations/:id` et `POST /api/real-estate-applications/reservations/:id/cancel` (`routes/realEstateApplicationRoutes.js:17-18`) — portent désormais `requireTenantScopeForStaffOrPlatformOperator`, identique aux 6 autres routes staff du même fichier (`GET /`, `GET /:id/attachments/:attachmentId`, `GET /:id`, `POST /:id/review`, `POST /:id/accept`, `POST /:id/reject`).
- Handlers : `getReservation`, `cancelReservation` (`controllers/realEstateApplicationController.js:162-182`).
- Helper utilisé : `assertApplicationTenantAccessIfStaff(req, res, application, isStaffGranted)` — **le même helper déjà utilisé par 6 autres appels** dans ce fichier (`getOne`, `review`, `accept`, `reject`, `downloadAttachment`, `create`'s sibling `list`... vérifié : 8 sites d'appel au total, dont les 2 nouveaux). Aucun second helper créé.
- Position : dans `getReservation`, appelé après le calcul de `isClientOrOwner` et **avant** la réponse (`res.json`). Dans `cancelReservation`, appelé après le calcul de `allowed`/`isClientOrOwner` et **avant** la validation du motif et `workflow.releaseReservation` (le side effect métier).
- `isStaffGranted` calculé comme `isStaff(req.user) && !isClientOrOwner` dans les deux handlers — cohérent avec la convention déjà établie ailleurs dans le fichier (P1-D/P1-I) : le contrôle tenant ne s'applique jamais à un client/propriétaire déjà légitimé par identité.

## Rejeu de la suite permanente
`realEstateReservationTenantAuthority.mongo.integration.test.js` : **10/10 PASS** (exécution indépendante).
- Staff A→Reservation A (GET) : autorisé (test 1).
- Staff A→Reservation B (GET) : refusé (test 2).
- Staff B→Reservation A (GET) : refusé symétrique (test 3).
- Client propriétaire de sa réservation : autorisé sans tenant (test 4).
- Staff A→Reservation A (cancel) : autorisé, historique préservé (test 5).
- Staff A→Reservation B (cancel) : refusé, 0 side effect (test 6).
- Staff sans tenant (cancel) : refusé (test 7).
- En-tête tenant invalide (cancel) : refusé (test 8).
- PlatformOperator global (cancel) : autorisé (test 9).
- PlatformOperator scoped A→Reservation B (cancel) : refusé (test 10).

## Side effects (via la suite permanente)
Cancel cross-tenant refusé (test 6) : `Reservation.status` reste `active`, `Property.availability` reste `Réservé` — aucune libération, aucune notification déclenchée (conséquence directe de l'absence d'appel à `releaseReservation`).

## Siblings (inspection statique uniquement, §12 du mandat)
`getOne`, `review`, `accept`, `reject`, `downloadAttachment` : tous appellent `assertApplicationTenantAccessIfStaff` de façon identique — confirmé cohérent avec le fix. Rejoué (non modifié) : `securityClosureP1WaveRealEstateApplicationTenantAuthority` — 6/6 PASS, aucune régression.

## Statut
**FCA1-02 : CLOSED — confirmé par cette validation indépendante.**
