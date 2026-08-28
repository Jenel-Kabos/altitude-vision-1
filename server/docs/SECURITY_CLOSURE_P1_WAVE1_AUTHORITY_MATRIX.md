# SECURITY-CLOSURE-P1-WAVE-1 — Matrice d'autorité (10 lots)

| Lot | Acteur | Tenant | Ressource | Résultat attendu | Preuve |
|---|---|---|---|---|---|
| P1-A | Admin A | Tenant A | Liste Contrat | A uniquement | test 1 |
| P1-A | Staff multi-tenant sans en-tête | Ambigu | Liste Contrat | Refusé | test 2 |
| P1-J | Admin A | Tenant A | Liste Locataire/Proprietaire | A uniquement | tests 1, 5 |
| P1-J | Admin A | Tenant A | `:id/dossier` Locataire du tenant B | Refusé | test 3 |
| P1-B | Admin A | Tenant A | Visites/paiements du tenant A | Autorisé, B jamais visible | tests 1-3 |
| P1-B | Admin A | Tenant A | PATCH visite du tenant B | Refusé, aucune mutation | tests 5, 6 |
| P1-C | Admin A | Tenant A | Litige/Signalement du tenant B (liste et unitaire) | Refusé | tests 2, 3, 7 |
| P1-C | Admin A | Tenant A | Litige/Signalement de son propre tenant | Autorisé | test 4 |
| P1-D | Admin A (staff) | Tenant A | Dossier du tenant B | Refusé | tests 2, 3 |
| P1-D | Candidat/Propriétaire | — | Son propre dossier, sans tenant | Autorisé | test 5 |
| P1-E | Admin A | Tenant A | Hébergement du tenant B (`updateFull`) | Refusé | test 1 |
| P1-F | Admin A | Tenant A | Annonce vente/location du tenant B (`updateFull`) | Refusé | tests 1, 3 |
| P1-F | Proprietaire B | — | Bien du Proprietaire A | Refusé (ownership, inchangé) | test 5 |
| P1-G | GestionnaireImmobilier (STAFF_IMMO) tenant A | Tenant A | Transition sur bien du tenant B | Refusé | test 1 |
| P1-H | Admin A (Hôtel A) | Tenant A | Assignment de l'Hôtel B via URL Hôtel A | Refusé (404, hôtel non recroisé) | tests 1-3 |
| P1-I | Admin A | Tenant A | Liste/détail/mutation Transaction du tenant B | Refusé | tests 1, 2, 5, 6 |
| P1-I | Client | — | Sa propre transaction, sans tenant | Autorisé | test 3 |

## Règle Admin préservée (§15 du mandat)

Dans chaque lot, un Admin (ou staff équivalent) conserve l'intégralité de ses capacités CRUD légitimes **à l'intérieur de son propre tenant** — vérifié explicitement par un test dédié dans chaque suite (P1-A test 1 partiel, P1-C test 4, P1-D test 4 [P0-wave héritage], P1-E test 2, P1-F tests 2/4, P1-G test 2, P1-H test 4, P1-I test 7). Aucun droit Admin n'a été retiré ; seule la frontière cross-tenant/cross-ressource a été ajoutée.

## PlatformOperator (§18)

Aucun des 10 lots n'a modifié ou introduit de mode PlatformOperator global — chaque lot préserve le comportement PO déjà établi par les hotfixs précédents (résolution explicite via en-tête, jamais un mode global fabriqué pour un domaine qui ne l'avait pas déjà).

## Leçon transversale confirmée sur les 10 lots (§14 du mandat)

Un filtre RBAC seul (rôle autorisé par la route) ne suffit jamais à fermer une faille resource authority : P1-G (`propertyAssetController.transition`) en est l'exemple le plus net — la route restreignait déjà l'accès à `STAFF_IMMO`, mais AUCUNE frontière tenant n'existait sur QUELLE ressource ce staff pouvait affecter. Répliquer naïvement le contrôle RBAC des handlers sœurs (`assertReadAccess`, `ROLES_DOCS`) aurait été un no-op de sécurité tout en risquant une régression (blocage d'un `GestionnaireImmobilier` légitime, absent de `ROLES_DOCS`).
