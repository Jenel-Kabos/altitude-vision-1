# Flux tenant

Avant : authentification → ObjectId client → `Accommodation.findById` → requêtes/mutations des enfants. L'ObjectId constituait de fait l'unique frontière.

Après : authentification → `requireTenantScopeForStaffAllowPlatformWide` → pour le staff scoped, `Accommodation.findOne({_id, tenant: platformTenant})` → requêtes/mutations enfant limitées à cette Accommodation.

- Staff sans tenant : 403 fail-closed.
- PlatformOperator global : bypass tenant canonique conservé.
- PlatformOperator scoped : filtre sur son tenant.
- Non-staff : le middleware ne fabrique pas de tenant ; le contrôle ownership historique demeure.
- Le tenant est porté directement par `Accommodation`. Les blocks, réservations et night locks sont rattachés indirectement par `accommodation`.
- Aucun `tenant`, `owner` ou `platformTenant` fourni par body/query/params n'est utilisé comme autorisation.
- Le service de création reçoit le parent déjà autorisé afin d'éviter une seconde lecture non scopée.

Aucune nouvelle politique tenant ni aucun champ de schéma n'a été créé.
