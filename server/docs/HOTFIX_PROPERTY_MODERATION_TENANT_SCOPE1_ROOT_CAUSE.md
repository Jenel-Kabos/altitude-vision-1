# HZ-07 — Cause racine

La cause est la combinaison de deux absences sur trois routes LIVE :

1. aucun guard tenant canonique après l’authentification/RBAC ;
2. aucune propagation de `req.platformTenant` dans les queries Mongo.

Conséquences précises :

- `runPropertySearch` initialisait `baseFilter = {}` pour le staff et APIFeatures acceptait même `tenant` depuis la query HTTP ;
- pending exécutait un `Property.find` global ;
- pending-count exécutait un `Property.countDocuments` global ;
- le staff sans tenant tombait donc implicitement sur une portée plateforme.

Approve/reject n’ont pas cette cause : `assertPropertyTenantAccess` les protégeait déjà. Ils n’ont pas été refactorés.
