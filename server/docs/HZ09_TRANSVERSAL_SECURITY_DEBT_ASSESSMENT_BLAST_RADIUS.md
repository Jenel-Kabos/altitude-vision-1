# HZ-09 — Blast radius

| Couche | Surface |
|---|---|
| Routes | 7 routeurs avec appel direct ; tous montés |
| Controllers | 5 contrôleurs avec appel direct |
| Service/helper | `tenantContextService`, middleware tenant, helper d'attribution HZ-08 |
| Models | User, PlatformTenant, OrgMembership, OrgUnit et ressources Property/Accommodation/Reservation/GL/finance associées |
| Opérations | lectures ciblées/listes, CRUD, transitions, documents, paiements/remboursements selon entrypoint |
| RBAC/ownership | préexistants et distincts ; aucun changement autorisé |
| Frontend/mobile | consommateurs d'API possibles, aucun changement requis pour la reclassification |
| Jobs | aucun appel direct trouvé |
| Tests | tenant core/hardening, adversarial, platform operator et domaines HZ |
| Historique | legacy fallback canonique ; ressources unresolved = HZ-08, non HZ-09 |

Une canonicalisation future toucherait une large surface et exigerait des tests par route, notamment l'ordre des `router.param`, les routes self/owner, les codes 403/404, les deux alias et les modes PlatformOperator. Aucun schéma ni migration de données ne serait intrinsèquement nécessaire.
