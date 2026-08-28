# ARCH-2M — Inventaire service→controller

L'inventaire contient exactement les deux exceptions `ARCH-LAYER-001` présentes dans `architecture/baseline.json`.

| Edge | Source | Target | Symbol | Domain | Call sites fonctionnels | Runtime | Classification |
|---|---|---|---|---|---:|---|---|
| A | `services/reporting/domains/accommodationReport.js` | `controllers/dashboardAnalyticsController.js` | `accommodations` | REPORTING + ACCOMMODATION + PROPERTY + FINANCE | 2 | LIVE | AGGREGATION / QUERY |
| B | `services/reporting/domains/hotelReport.js` | `controllers/dashboardAnalyticsController.js` | `hotels` | REPORTING + HOTEL + PROPERTY + FINANCE + IAM | 2 | LIVE | SECURITY_SCOPE / AGGREGATION / QUERY |

Chaque symbole est appelé directement par son DomainReport et par la table de dispatch de `getModuleAnalytics`. Les deux parcours HTTP sont montés : `/api/reporting/*` et `/api/dashboard-analytics/:module`. Le Web consomme les deux modules ; le mobile consomme aussi le cockpit hôtel.
