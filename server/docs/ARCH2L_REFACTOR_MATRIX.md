# ARCH-2L — Matrice de refactor

| Consumer | Old owner | Symbol | New owner | Behavior unchanged | Edge removed |
|---|---|---|---|---|---|
| `dashboardAnalyticsController` | helper local | `rentals` | `rentalReportQueryService` | OUI, table handler délègue à `getRentalReportData` | Sans objet : controller consommateur |
| `locationReport` | `dashboardAnalyticsController` | `rentals` | `rentalReportQueryService` | OUI, mêmes arguments et output | OUI |
| test de caractérisation | ancien export controller | `rentals` | `rentalReportQueryService` | OUI, même fixture avant/après | OUI |

Une seule source de vérité. Aucun wrapper, façade générique ou copie résiduelle. `immobilierReportQueryService` reste séparé.
