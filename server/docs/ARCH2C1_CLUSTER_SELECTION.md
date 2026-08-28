# ARCH-2C1 — Sélection du cluster pilote

| Cluster | Arêtes | Domaine | Couverture initiale | Risque | Décision |
|---|---:|---|---|---|---|
| Document streaming | 9 | Infrastructure documentaire | Intégration réelle du flux et RBAC bail; helper à compléter en unitaire | Faible, sécurité sensible | **Choisi** |
| Property partagé | 5 | Property/publication/recherche | Large | Élevé, hotspot métier | Attend |
| Reporting analytics | 4 | Reporting multi-domaines | Présente | Moyen/élevé, finance/hôtel | Attend |
| User scope | 3 | Tenant/IAM | Présente | Élevé | Attend |
| Message serialization | 1 | Messagerie | Présente | Faible/moyen | Candidat ARCH-2C2 |
| Mobile Property payload | 1 | Publication mobile | Présente | Élevé, transaction | Attend |
| Lease payment generation | 1 | Bail/finance | Présente | Élevé | Attend |

## Choix

Le streaming documentaire est une responsabilité infrastructurelle homogène, déjà appelée après les autorisations propres à neuf contrôleurs. L'extraction vers `services/storage/documentStreamingService.js` ne déplace aucune décision métier et supprime neuf arêtes en une seule opération cohérente.

Property, scope utilisateur, reporting et échéances sont différés car ils combinent règles métier, tenant ou finance. Le serializer message est le prochain candidat le plus étroit, mais ARCH-2C1 s'arrête après le cluster pilote.
