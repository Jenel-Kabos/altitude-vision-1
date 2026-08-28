# SECURITY-FINAL-CLOSURE-AUDIT-1 — Revue adversariale (Partie B)

## Méthode
Recherche indépendante des anciens findings, ciblée sur le pattern principal découvert pendant toute la campagne : **une route canonique/liste reçoit un correctif tenant, une route sœur (create/update/delete/bulk/stats/download/assignment) sur la même ressource ne le reçoit pas**. Combinaison de greps à fort rendement (ObjectId direct, body-IDs bulk, fallback global, stats/aggregate, doublons legacy) et de lecture manuelle des chaînes de middleware (route → `router.param` → contrôleur) pour chaque domaine déjà corrigé par HZ/HF/RBAC/P0/P1.

## Domaines vérifiés et jugés propres (siblings couverts)
- `contratController`/`contratRoutes` : tous les `:id` couverts par `router.param` + `assertResourceTenantOrUnattributed` (TENANT-CERT-2). Seule `POST /` (create) est un trou — voir FCA1-01.
- `litigeController`/`litigeRoutes`, `signalementController`/`signalementRoutes` : tous les handlers staff appellent `assertLitigeTenantAccess`/`assertSignalementTenantAccess` ou `scopedPropertyIdsForTenant`.
- `realEstateApplicationController` (objet `Application`) : `getOne`/`review`/`accept`/`reject`/`downloadAttachment` appellent tous `assertApplicationTenantAccessIfStaff` ; `uploadAttachments`/`deleteAttachment`/`withdraw` correctement restreints à l'identité du candidat. Seuls les 2 endpoints `Reservation` du même fichier sont un trou — voir FCA1-02.
- `accommodationController`/`accommodationRoutes` : `getOne`/`update`/`submit`/`deactivate`/`reactivate`/`reviewDecision` appellent `assertAccommodationAccessible` ; `pending`/`listAdmin` filtrent par tenant.
- `hotelReservationController`/`hotelReservationRoutes` : tous les handlers passent par `assertReservationAccess`/`resolveHotelAccessScope`.
- `hotelStaffAssignmentController`/routes hôtel d'assignation : gated uniformément par `requireHotelCapability` + `assertAssignmentBelongsToHotel` (P1-H).
- `visiteRoutes` : toutes les routes staff portent `requireTenantScopeForStaffOrPlatformOperator`.
- `locataireController`/`proprietaireController`, `salePropertyController`/`rentalPropertyController`, `propertyAssetController`, `transactionController`/`paiementTransactionController`, `paiementController`/`rentalLeaseLifecycleController`/`adminController`, `messageController`/`conversationController` : spot-checkés (pattern body-IDs bulk, fallback global) sans anomalie détectée — idiome `req.platformTenant ? {…} : {}` utilisé de façon cohérente pour tolérer les ressources non attribuées (legacy), conforme au contrat documenté depuis HZ-01→07.

## Patterns recherchés sans résultat exploitable
- ObjectId direct sans vérification tenant (`findById`/`findByIdAndUpdate`/`findByIdAndDelete`) : les 2 seuls cas trouvés sont FCA1-01/02.
- Body-IDs bulk (`req.body.ids`, `paymentIds`, etc.) : un seul usage trouvé (`estimationController.compareEstimations`), domaine intentionnellement sans tenant (laboratoire d'évaluation interne).
- Fallback global implicite (`tenant ? {...} : {}`) hors des fichiers déjà corrigés : aucun cas nouveau.
- Doublons legacy (`/api/admin/*`, `/api/*/admin/*`) : `adminController.js` déjà couvert par P0-E ; aucun autre doublon détecté sur les domaines audités.
- Stats/aggregate globales sur un domaine dont la liste est scoped : non détecté de divergence liste/stats dans les domaines vérifiés.

## Arrêt de la recherche (§55 du mandat)
Deux blockers P0 concrets ayant été confirmés par reproduction runtime (FCA1-01, FCA1-02), la recherche horizontale s'arrête ici après une courte vérification du rayon d'impact direct de chacun (voir `_BLOCKERS.md`, section « Blast radius »). Aucune chasse supplémentaire n'a été menée au-delà, conformément à l'interdiction explicite de transformer ce sprint en audit infini.
