# ARCH-2M — Décision unique

## SERVICE→CONTROLLER CLEANUP SHOULD STOP HERE

Il reste deux dépendances, mais ce n'est pas une raison pour en supprimer une. Accommodation est HIGH et Hotel CRITICAL ; aucune n'offre un gain structurel suffisant face à tenant, ownership, IAM et finance. La catégorie s'arrête à `2` dans la campagne mécanique actuelle.

## NEW BUSINESS/SECURITY FINDING

La route vivante `/api/dashboard-analytics/:module` n'attache aucun contexte tenant alors que les deux helpers restants utilisent `req.user.platformTenant` comme source de scope et retombent sinon sur le global. Aucun correctif n'est réalisé ici.

## Next recommended sprint

**HOTFIX-DASHBOARD-ANALYTICS-TENANT-SCOPE-1 — caractérisation et fermeture du scope tenant des analytics.**

- **Target :** `routes/dashboardAnalyticsRoutes.js` → contrat tenant/PlatformOperator → `dashboardAnalyticsController.getModuleAnalytics` pour les quatre modules, avec priorité Hotel/Accommodation.
- **Expected :** Admin tenant A ne voit jamais tenant B ; PlatformOperator global uniquement dans un contexte explicitement autorisé ; propriétaire et consumers Web/mobile inchangés. Baseline architecture attendue : `2 / 1 / 12`.
- **Risk :** CRITICAL pour la confidentialité, HIGH pour l'implémentation.
- **Characterization :** tests adversariaux A/B sur les quatre modules, Admin/Gestionnaire/Propriétaire/PlatformOperator, tenant absent/invalide/sélectionné, ownership, assignments hôtel, finance et parité HTTP/Web/mobile.
- **Non-goals :** aucune extraction service→controller, aucun changement KPI/formule/statut/payload, aucune correction `runPropertySearch`, Estimation, dead route, route→model ou quittance.

Après ce hotfix séparé, la campagne service→controller reste arrêtée sauf nouvelle preuve réduisant matériellement le risque des deux edges.
