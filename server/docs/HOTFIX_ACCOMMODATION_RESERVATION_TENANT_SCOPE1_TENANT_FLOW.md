# Flux tenant

Avant : request → auth → ObjectId → `findById` → rôle staff global → mutation → effets de bord.

Après : request → auth → résolution tenant canonique → fail-closed staff → lookup `findOne({_id, tenant})` → même document Mongoose transmis au service → mutation → effets de bord.

Le PlatformOperator reconnu peut rester global ; lorsqu'il sélectionne un tenant, le lookup est borné à ce tenant. Proprietaire et Client conservent le contrôle owner/guest historique dans le service.

