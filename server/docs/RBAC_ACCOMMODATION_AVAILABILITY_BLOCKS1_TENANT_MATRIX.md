# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Matrice tenant (non-régression HZ-02)

| Scénario | Avant ce hotfix | Après ce hotfix |
|---|---|---|
| Admin A → Accommodation A | 200 | 200 (inchangé) |
| Admin A → Accommodation B | 404 (`authorizedCalendarAccommodation`, tenant non trouvé) | 404 (inchangé — non atteint par la nouvelle vérification RBAC, qui ne s'exécute qu'après résolution tenant réussie) |
| Admin B → Accommodation A | 404 | 404 (inchangé) |
| Staff A → Accommodation A | 200 | 200 (inchangé) |
| Staff A → Accommodation B | 404 | 404 (inchangé) |
| Owner A → sa propre ressource | 200 | 200 (inchangé — `authorizedCalendarAccommodation` n'applique aucun filtre tenant pour un non-staff, l'ownership seul décide, comportement HZ-02 déjà en place) |
| Owner A → ressource d'un tiers | **200 (RBAC-FINAL-01)** | **403** (corrigé par ce hotfix — pas un changement tenant, un changement RBAC/ownership) |
| PlatformOperator global | 200 sur tout tenant | 200 (inchangé) |
| PlatformOperator scopé A | 200 sur A, 404 sur B | 200 sur A, 404 sur B (inchangé) |

## Confirmation directe

`accommodationCalendarTenantScope.mongo.integration.test.js` (HZ-02, 15 tests, aucune adaptation) reste intégralement vert après ce hotfix — preuve directe qu'aucune ligne de la frontière tenant n'a été modifiée ni affaiblie. La nouvelle vérification RBAC s'exécute **après** la résolution tenant réussie (`authorizedCalendarAccommodation` a déjà renvoyé la ressource ou levé une 404) — les deux frontières restent strictement séquentielles et indépendantes, jamais fusionnées.
