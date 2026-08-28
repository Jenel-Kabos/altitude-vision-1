# Décision

**NEXT PRIORITY:** `HOTFIX-ACCOMMODATION-RESERVATION-TENANT-SCOPE-1`

**TARGET:** toutes les routes montées de cycle de vie, finance et calendrier autour de `AccommodationReservation`, `AccommodationAvailabilityBlock` et `AccommodationNightLock`, avec characterization préalable des contrats Client/Proprietaire/staff/PlatformOperator.

**SEVERITY:** P0.

**WHY:** un Admin/staff d'un Tenant A peut statiquement atteindre une réservation ou un calendrier du Tenant B par ObjectId parce que `canManage` et les contrôleurs acceptent le rôle seul. Les mutations peuvent confirmer/check-in/check-out/no-show, créer/supprimer des blocks, modifier les locks et déclencher une facture. C'est plus grave que les listes globales en lecture.

**TESTS REQUIS POUR LE FUTUR HOTFIX:** sentinelles Tenant A/B, Admin A/B, staff A, owner, guest, staff sans tenant, PlatformOperator global/scopé, lectures et mutations, Mongo ciblé puis exhaustif.

**NON-GOALS:** aucun changement de workflow, KPI, facture, transition, ownership, rôle, PlatformOperator, modèle ou API ; ne pas traiter simultanément les listes Hotel/Property sauf dépendance strictement requise.

Ce hotfix n'est pas exécuté dans le présent audit.
