# Flux tenant

Avant : request → auth → handler → `query={}` → filtres client → si staff, `resolveTenantForUser` → filtre tenant seulement si résolution réussie → sinon query globale.

Après : request → auth → `requireTenantScopeForStaffAllowPlatformWide` → staff classique sans tenant : 403 → staff/PO scoped : contexte canonique attaché → handler → `{tenant}` → PO global explicitement reconnu : passage autorisé et query globale légitime → self-service : middleware non bloquant, query owner/guest historique.

La source canonique est l'identité serveur, `OrgMembership`/`PlatformTenant`, résolue par `resolveEffectiveTenantContext`. Aucun query/body/header n'est cru sans validation : les headers tenant passent par cette résolution. `AccommodationReservation` porte directement `tenant`; les populate Accommodation/Property, guest et owner ne modifient pas le filtre racine.
