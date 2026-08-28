# HZ-04 — Flux tenant

## Avant

`HTTP → protect → ROLES_ALTIMMO → controller → service éventuel → Accommodation.find(global) → réponse A+B`

- `pending` construisait seulement `publicationStatus=soumis` et l'exclusion des hébergements d'hôtel.
- `listAdmin` initialisait `query={}` puis ajoutait uniquement les filtres fonctionnels.

## Après

`HTTP → protect → ROLES_ALTIMMO → requireTenantScopeForStaffAllowPlatformWide → req.platformTenant authentifié → controller → tenantId → Accommodation.find({tenant,...})`

- staff ordinaire sans tenant : 403 avant le handler ; aucune query globale.
- PlatformOperator non scopé : mode global explicitement autorisé, `tenantId=null`.
- PlatformOperator scopé : `req.platformTenant` résolu puis prédicat tenant.
- Le header n'est jamais cru seul : le middleware valide son accessibilité contre l'identité authentifiée.

