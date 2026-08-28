# Flux tenant Dashboard Analytics

## Avant

`Request → /api/dashboard-analytics → auth.protect → User Mongo → getModuleAnalytics → query/aggregate`

Le contexte était perdu entre l'authentification et le contrôleur : le JWT contient l'identifiant utilisateur et la version de token, le User Mongo n'embarque pas le tenant courant, et `protect` ne déclenche pas le resolver tenant. `req.user.platformTenant` pouvait donc être absent et les helpers interprétaient cette absence comme un scope large.

## Après

`Request → auth.protect → requireTenantScopeForAnalytics → resolveAndAttachTenantScope → resolveAvailableTenantsForUser + resolveEffectiveTenantContext → authorization rôle existante → getModuleAnalytics → query/aggregate tenant-scopée`

Le resolver canonique valide côté serveur l'appartenance, le statut et, pour un PlatformOperator, sa sélection. Les headers `X-Platform-Tenant-Id`/`X-Tenant-Id` ne sont que des sélecteurs : ils ne confèrent aucun droit. Le middleware peuple `req.platformTenant`, `req.tenantScopeUserIds` et l'acteur enrichi `req.user.platformTenant`.

Un staff doit résoudre un tenant et échoue en 403 sinon. Un vrai PlatformOperator peut rester global sur ce routeur, ou sélectionner A/B. Un `Proprietaire` self-service sans membership continue jusqu'aux gardes d'ownership historiques. `req.user.platformTenant` est autoritatif uniquement après cet enrichissement serveur ; il peut légitimement rester absent pour les deux modes globaux/self-service explicitement supportés.
