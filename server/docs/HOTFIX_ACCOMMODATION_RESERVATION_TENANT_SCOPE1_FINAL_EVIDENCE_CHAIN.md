# Chaîne de preuves finale

## PRE-PATCH STATIC EVIDENCE

HZ-01 documente une route montée et authentifiée, un lookup `Reservation.findById(id)`, `canManage()` vrai sur le rôle staff seul, puis save/locks/facture. Aucun resolver ni authorization tenant ne précédait la mutation. **Pre-patch runtime red archive: NOT AVAILABLE.** Aucune archive rétroactive n'a été fabriquée.

## POST-PATCH RUNTIME EVIDENCE

Les cinq routes utilisent `requireTenantScopeForStaffAllowPlatformWide`. Le controller exécute pour le staff `Reservation.findOne({_id, tenant})`; seul un PlatformOperator reconnu et non scopé omet volontairement le prédicat tenant. Le document autorisé est transmis au service, évitant un second lookup non scopé. Matrice Mongo : 25/25.

## POST-PATCH SIDE-EFFECT EVIDENCE

Pour les dix attaques A→B/B→A : statut/historique, locks, Accommodation, Notification, FinancialDocument, FinancialPayment, PaymentAllocation et FinancialLedgerEntry sont comptés avant/après et restent identiques. Le handler s'arrête avant facture/notification/logAction.

## GLOBAL REGRESSION EVIDENCE

Backend non-Mongo : 141/141 suites, 1566/1566 tests. Checker 7/7, architecture PASS, lint 0 erreur. Mongo global : 101 suites et 1023 tests verts ; trois tests ARCH-2L échouent sur une collision d'index de fixture, puis la suite isolée passe 6/6. Cette anomalie est hors hotfix mais le run exhaustif n'est pas totalement vert.

