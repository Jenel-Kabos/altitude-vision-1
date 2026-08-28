# ARCH-2L — Matrice owner scope

| Scenario | Owner filter before | Owner filter after | Cross-owner leakage |
|---|---|---|---|
| Owner A | `Property.owner in [ObjectId(A)]`, propagation par IDs Property/Contrat | Identique | NON, prouvé avec données B plus élevées |
| Owner B | `Property.owner in [ObjectId(B)]` | Identique | NON par symétrie du filtre et fixture |
| Owners A+B | `Property.owner in [ObjectId(A),ObjectId(B)]` | Identique | Scope union attendu |
| Owner valide sans données | `$in` retourne zéro Property puis filtres `$in:[]` | Identique | NON ; tous les KPI à zéro |
| Owner invalide | Conversion `new ObjectId(String(id))` peut lever | Identique | Sans objet ; erreur propagée |
| Scope absent / PlatformOperator global | Aucun filtre Property/Contrat/Paiement/maintenance | Identique | Mode global volontaire |

## Provenance séparée

- **OWNER :** `scopeUserIds` est produit en Reporting par `reportingService.resolveOrgScope` via `organizationService.getScopeUserIds`; la query ne le décide pas.
- **TENANT :** `reportingController.scopeParams` et `reportingService.resolveEffectiveOrgUnitId` résolvent le tenant/OrgUnit en amont. Aucun `tenantId` n'entre dans le query service.
- **PLATFORM OPERATOR :** l'opérateur non scopé autorisé produit l'absence de scope et donc le mode global historique ; un tenant sélectionné suit le scope normal.
- **DASHBOARD ANALYTICS :** le handler appelle sans scope après auth/RBAC historique ; mode global inchangé.
