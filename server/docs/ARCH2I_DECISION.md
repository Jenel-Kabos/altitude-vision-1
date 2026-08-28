# ARCH-2I — Décision

## OPTION B

**ROUTE→MODEL CLEANUP SHOULD STOP HERE.**

### État restant

- 9 frontières de sécurité protégées.
- 1 dette applicative vivante : Estimation, risque/blast radius HIGH.
- 2 routes mortes : Projet (modèle absent) et Realisation (données historiques possibles), à traiter par lifecycle/dead-code dédié et non par extraction de service.

### Next architectural priority

**ARCH-2J — IMMOBILIER REPORT QUERY BOUNDARY ASSESSMENT/CHARACTERIZATION**

TARGET : `services/reporting/domains/immobilierReport.js → controllers/dashboardAnalyticsController.js`.

CURRENT : service→controller = 4. EXPECTED après un futur sprint d'exécution, si la caractérisation autorise l'extraction : 4→3 ; route→model reste 12. RISK : MEDIUM-HIGH.

WHY : dette active read-only, sans provider ni écriture, et sous-domaine plus étroit que les rapports hôtel/location. Le prochain sprint doit d'abord verrouiller owner scope, KPI Property/visites/transactions/commissions et contrat reporting. Il ne doit ni traiter Estimation, ni supprimer les routes legacy, ni toucher `runPropertySearch`.

`runPropertySearch` reste important mais moins prioritaire : il porte des prédicats publics de publication, une pagination multi-collection et deux contextes staff divergents. Aucun ARCH-2J n'est exécuté ici.
