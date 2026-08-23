# HOTFIX-DASHBOARD-DARK-MODE-UI-1 — Matrice composants

| Composant/famille | Rôle | Risque sombre | Traitement |
|---|---|---|---|
| `AdminDashboard` | shell/navigation | faible côté sidebar, fort côté contenu | conserver structure/RBAC, renforcer CSS |
| `DashboardUI` | primitives partagées | tokens incomplets | conserver API, enrichir tokens |
| `VisitesPage` | rendez-vous | P0 | styles inline vers tokens |
| `DevisPage` | devis locatif | P0 | couche centrale |
| `EstimationsPage` | cockpit estimation | P0 | couche centrale + composants experts |
| `ValuationAdministration` | références marché | P1 | héritage tokens slate/white |
| `EstimationExpertTabs` | dossier expert | P1 | héritage tokens et formulaires |
| `ValuationPhaseBDashboard` | KPIs/cockpit | P1 | héritage tokens et surfaces |
| `ManagePropertiesPage` | portefeuille | P1 | primitives partagées |
| `ManageAccommodationsPage` | hébergements | changement externe | préserver, validation uniquement |
| `ManageHotelsPage` | hôtels | changement externe | préserver, validation uniquement |
| Modération | cards/modales | P1 | couche centrale, aucun workflow modifié |
| Inbox / `SafeHtmlEmailViewer` | email | sécurité critique | conteneur seulement, sandbox inchangé |
