# HZ-06 — Architecture

Flux final :

`server.js → /api/hotels → protect + attach-if-resolvable → RBAC existant → requireTenantScopeForStaffAllowPlatformWide → req.platformTenant → controller → service/query Hotel tenant-scoped`.

La primitive canonique distingue staff tenant-scoped, PlatformOperator global et PlatformOperator scoped. Le filtre est appliqué dans Mongo, jamais après lecture. Aucun nouveau module, modèle, index, cycle ou edge architectural n’est nécessaire.

Baseline : 472 fichiers, 1 531 edges, service→controller 2, controller→controller 1, route→model 12/11, cycles 0, unresolved 0, new violations 0. Gate final à reporter après exécution.
