# ARCH-2K — Décision unique

## NEXT RECOMMENDED SPRINT

**ARCH-2L — RENTAL REPORT QUERY BOUNDARY**

**TARGET:** `services/reporting/domains/locationReport.js → controllers/dashboardAnalyticsController.js` (`rentals`).

**CURRENT:** service→controller = 3.

**EXPECTED:** service→controller = 2.

**RISK:** MEDIUM.

**WHY:** la fonction est une agrégation read-only vivante, indépendante d'Express, sans provider ni écriture, avec cinq modèles directs et un scope d'owners explicite fourni en entrée. Son owner peut rester étroit et descriptible en une phrase. Elle présente un meilleur ratio valeur/risque que Hotel, Accommodation, `runPropertySearch` et Estimation.

**OWNER:** futur `rentalReportQueryService`, uniquement responsable de construire les KPI read-only de gestion locative sous un scope d'owners fourni.

**CHARACTERIZATION:** verrouiller avant production les scopes null/Set/tableau, isolation owners/tenant, contrats, paiements/impayés/pénalités, maintenance, fenêtres de 30 jours, erreurs et payload exact ; Mongo ciblé + PlatformOperator global.

**NON-GOALS:** aucune règle locative/financière, quittance, IAM, tenant, ownership, PlatformOperator, route, payload, status, provider, migration de données, baseline autre que l'unique edge après preuve ; ne pas traiter Hotel/Accommodation, `runPropertySearch`, Estimation ou les dead routes.

ARCH-2L n'est pas exécuté ici.
