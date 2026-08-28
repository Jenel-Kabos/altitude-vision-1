# P0-C — Rental Payment Bulk Collection (RA-03)

## Rouge (avant correctif)

Même suite que P0-B, tests 6-9. Correctifs retirés : tests 6, 8, 9 échoués (encaissement cross-tenant accepté avec statut 200, `Paiement.statut` du tenant B modifié, `RentalPaymentReceipt` créé pour une échéance hors autorité).

## Root cause

`encaisserMultiple` prenait `contrat` et `allocations[].paiementId` directement du corps de la requête, sans jamais les vérifier contre le tenant de l'acteur — contournant le `router.param('id', …)` (TENANT-CERT-2) qui protège les autres routes `:id` de ce même fichier, puisque cette route ne consomme pas de paramètre `:id`.

## Atomicité (caractérisée, pas inventée)

Le contrat historique est *all-or-nothing par construction* (`runFinancialOperation` transactionnel : soit toutes les allocations validées sont appliquées, soit aucune, en cas d'échec de concurrence). Le correctif s'insère **avant** cette section transactionnelle — un contrat hors autorité fait échouer la requête entière avant qu'aucune allocation ne soit tentée, préservant cette sémantique sans la modifier.

## Correctif

`server/controllers/paiementController.js::encaisserMultiple` — après validation du format de `contrat`, chargement du `Contrat` et appel à `assertResourceTenantOrUnattributed({resourceType:'Contrat', resource: contratDoc, tenantId: req.platformTenant._id})` (uniquement si `req.platformTenant` résolu — garanti par le garde de route ajouté au même moment pour P0-B, `requireTenantScopeForStaffOrPlatformOperator`, désormais également sur cette route). Refus AVANT toute lecture/mutation de `Paiement`, avant toute création de `RentalPaymentReceipt`.

## Effets de bord vérifiés (refus cross-tenant)

- `Paiement.statut` inchangé (`impayé`) — test 6, 8.
- Aucun `RentalPaymentReceipt` créé — test 9.
- Aucune mutation partielle silencieuse sur un lot mixte A+B (test 8 : ni le paiement A ni le B ne sont affectés lorsque `contrat` pointe vers B).

## Vert (après correctif)

**Tests 6 à 9 : 4/4 PASS.** Encaissement légitime (test 7, même tenant) inchangé.

## Statut : **CLOSED**
