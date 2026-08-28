# HZ-07 — Contrat comportemental

- RBAC avant = RBAC après.
- Admin conserve les mêmes actions dans son tenant.
- Catalogue public, payloads et codes publics inchangés.
- Liste staff : mêmes filtres, recherche, pagination, total et tri ; le filtre tenant serveur est ajouté en amont.
- `tenant` HTTP ne peut jamais écraser le tenant serveur ; `owner`, status, listingType, type et autres filtres restent combinés au scope.
- Pending : même classification classique, même populate owner, même tri `-createdAt`, même payload `{status,results,data:{properties}}`.
- Pending-count : même payload `{status,data:{unreadCount}}`, désormais compté dans le tenant.
- Staff sans tenant : 403, conformément au guard canonique.
- Ressource cross-tenant sur validate/reject : 404, convention historique préservée.
- Validation, rejet, approved/published, publication, recommandation, vente/location, Parcelle, ownership, notifications, commissions et transactions : inchangés.
- Aucun changement frontend, mobile, schéma ou migration.
