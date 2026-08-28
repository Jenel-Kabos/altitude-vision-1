# ARCH-2E — Reporting transversal

| Source | Cible | Symbole / calls | Responsabilité | Mongo / sécurité | Risque |
|---|---|---|---|---|---|
| `reporting/domains/accommodationReport.js` | `dashboardAnalyticsController.js` | `accommodations`, 1 | KPI hébergements, réservations, nuitées, documents, allocations, remboursements | Lectures 7 collections ; filtre tenant explicite | Élevé |
| `reporting/domains/hotelReport.js` | même cible | `hotels`, 1 | Hôtels accessibles, chambres, réservations, housekeeping, maintenance, finance | Lectures multi-collections ; tenant, rôle, HotelStaffAssignment via scope ; erreur 403 | Très élevé |
| `reporting/domains/immobilierReport.js` | même cible | `sales`, 1 | Property, visites, transactions, commissions | Lectures ; scope owner IDs | Moyen-élevé |
| `reporting/domains/locationReport.js` | même cible | `rentals`, 1 | Gestion locative, baux, paiements, maintenance | Lectures ; scope owner/Property | Élevé |

Les quatre fonctions sont read-only et n'appellent aucun provider, notification ou écriture. Elles forment un cluster technique cohérent par propriétaire actuel et finalité KPI, mais pas une seule responsabilité métier : quatre sous-domaines et des règles de scope différentes.

Une abstraction canonique de pilotage existe déjà : `services/reporting/reportingService.js` et ses DomainReports. Le défaut est que leurs sources de données restent dans le controller. Déplacer les quatre fonctions dans un unique `ReportingService` géant concentrerait 15+ modèles, scopes Hotel/tenant et finance : risque manifeste de God Object. Une migration sûre devrait extraire des query services par domaine, pas un service partagé générique.

Gain réel : suppression du couplage HTTP→domaine et meilleure réutilisation. Coût/blast radius élevés, caractérisation Mongo transversale obligatoire. Dette structurelle réelle mais non prioritaire immédiatement.
