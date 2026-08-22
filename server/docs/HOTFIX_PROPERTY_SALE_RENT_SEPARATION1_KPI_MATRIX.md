# HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 — Matrice des KPI

| KPI | Source modèle | Sales filter | Rentals filter |
|---|---|---|---|
| Biens actifs / Brouillons / Publiés / Vendus | `Property` (`dashboard-analytics/sales`) | `status:'vente'` | N/A (n'existe pas côté Rentals) |
| Visites programmées | `Visite` (lié via `Property._id` déjà filtré vente) | `property:{$in: ids vente}` | N/A |
| Offres en attente / Chiffre des ventes / Commissions | `Transaction` (`transactionType:'vente'`) | `transactionType:'vente'` + `property:{$in: ids vente}` | N/A |
| Disponibles / Occupés / Préavis | `RentalManagement` | N/A | `managementActivated:true` + scope owner (aucune référence à `Property.status` — `RentalManagement` n'existe que pour des biens en gestion locative) |
| Contrats actifs / Contrats à échéance | `Contrat` | N/A | `type:'location'` |
| Loyers encaissés / Loyers impayés / Pénalités | `Paiement` (via `Contrat` du scope) | N/A | Indirect via `contractsInScope` (`Contrat.type:'location'`) |
| Maintenance (tickets ouverts) | `RentalMaintenanceTicket` | N/A | scope owner uniquement, pas de filtre `status` (modèle dédié location) |
| **Valeur totale** | `Property` (`property-asset/portfolio/dashboard`) | **`status:'vente'`** (nouveau) | **`status:'location'`** (nouveau) |
| **Total biens** | idem | **`status:'vente'`** (nouveau) | **`status:'location'`** (nouveau) |
| **Valeur par type** | idem (`type` du bien, ex. Parcelle/Maison — axe orthogonal à `status`) | **`status:'vente'`** (nouveau) | **`status:'location'`** (nouveau) |
| Biens vacants / occupés (widget Patrimoine) | idem (`deriveAssetCycle`) | **`status:'vente'`** (nouveau, cascade du même filtre) | **`status:'location'`** (nouveau, cascade du même filtre) |
| Coût d'entretien total / Alertes critiques/attention | idem | **`status:'vente'`** (nouveau, cascade) | **`status:'location'`** (nouveau, cascade) |

## Principe respecté (mandat §16/§40)

Aucun filtre `Property.status` n'a été forcé sur les KPI dont la source réelle est `Contrat`/`Paiement`/`RentalManagement`/`RentalMaintenanceTicket`/`Transaction`/`Visite` — ces modèles ont chacun leur propre discriminant métier déjà correct (`type:'location'`, `transactionType:'vente'`, ou simplement leur existence conditionnée à un bien en gestion locative). Seul le widget Patrimoine, qui interroge `Property` directement sans aucun discriminant préexistant, a reçu le nouveau filtre `status`.
