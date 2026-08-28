# ARCH-2J — Inventaire service→controller

| # | Service | Controller | Symbol | Domain | Responsibility | Risk |
|---:|---|---|---|---|---|---|
| 1 | `reporting/domains/accommodationReport.js` | `dashboardAnalyticsController.js` | `accommodations` | Hébergement | KPI publication, réservations, occupation et finance | HIGH |
| 2 | `reporting/domains/hotelReport.js` | même | `hotels` | Hôtel | scope hôtels, chambres, opérations et finance | CRITICAL |
| 3 | `reporting/domains/immobilierReport.js` | même | `sales` | Immobilier vente | KPI Property, visites et transactions | MEDIUM-HIGH |
| 4 | `reporting/domains/locationReport.js` | même | `rentals` | Gestion locative | mandats, contrats, paiements, maintenance | HIGH |

Chaque edge avait un call site dans son DomainReport. Les quatre symboles étaient des helpers async sans `req/res/next`, read-only, mais avec des scopes et modèles différents. Seule l'edge #3 est candidate ARCH-2J.
