# SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 — Matrice d'autorité

| Blocker | Acteur | Tenant | Ressource | Résultat attendu | Preuve |
|---|---|---|---|---|---|
| FCA1-01 | Admin A | Tenant A | Property A | Autorisé, Contrat + Paiement créés | test 1 |
| FCA1-01 | Admin A | Tenant A | Property B | Refusé, 0 Contrat, 0 Paiement | test 2 |
| FCA1-01 | Admin B | Tenant B | Property A | Refusé symétrique | test 3 |
| FCA1-01 | Staff sans tenant | — | Property B | Refusé (fail-closed) | test 4 |
| FCA1-01 | PlatformOperator global | Tenant A (explicite) | Property A | Autorisé (historique) | test 5 |
| FCA1-01 | PlatformOperator scoped A | Tenant A | Property B | Refusé | test 6 |
| FCA1-01 | Admin A | Header tenant invalide | Property A | Refusé | test 7 |
| FCA1-02 | Staff A | Tenant A | Reservation A | Autorisé (GET) | test 1 |
| FCA1-02 | Staff A | Tenant A | Reservation B | Refusé (GET) | test 2 |
| FCA1-02 | Staff B | Tenant B | Reservation A | Refusé symétrique (GET) | test 3 |
| FCA1-02 | Client propriétaire | — | Sa réservation | Autorisé sans tenant (GET) | test 4 |
| FCA1-02 | Staff A | Tenant A | Reservation A | Annulation historique OK | test 5 |
| FCA1-02 | Staff A | Tenant A | Reservation B | Refusé (cancel), 0 side effect | test 6 |
| FCA1-02 | Staff sans tenant | — | Reservation B | Refusé (fail-closed, cancel) | test 7 |
| FCA1-02 | Staff A | Header tenant invalide | Reservation A | Refusé (cancel) | test 8 |
| FCA1-02 | PlatformOperator global | Tenant A (explicite) | Reservation A | Autorisé (historique, cancel) | test 9 |
| FCA1-02 | PlatformOperator scoped A | Tenant A | Reservation B | Refusé (cancel) | test 10 |

## Règle Admin préservée (§20 du mandat)

Admin A conserve toutes ses capacités CRUD légitimes à l'intérieur du Tenant A pour les deux blockers (tests FCA1-01 #1, FCA1-02 #1/#5). Aucun droit Admin n'a été retiré ; seule la frontière cross-tenant a été ajoutée.

## PlatformOperator (§22)

Mode global préservé pour les deux blockers (tests FCA1-01 #5, FCA1-02 #9) — un PlatformOperator ayant explicitement sélectionné un tenant via `X-Platform-Tenant-Id` reste soumis à la frontière de ce tenant sélectionné (tests FCA1-01 #6, FCA1-02 #10), cohérent avec le contrat PLATFORM-ADMIN-1 déjà établi dans `contratRoutes.js`/`paiementRoutes.js`.
