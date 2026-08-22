# HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 — Matrice des requêtes

| Surface | Source | Avant | Après | Champ transactionnel |
|---|---|---|---|---|
| Sales list | `GET /api/properties/portfolio` (`propertyPortfolioService.getPropertyPortfolio`) | `PROPERTY_PUBLICATION_FILTER` (`status:{$in:['vente','location']}`, `statusAdmin:'Validée'`, `isPublished:true`, `availability:'Disponible'`, `pole:'Altimmo'`) + filtre frontend `p.status==='vente'` | **Inchangé** — déjà correct (item tagué avec son vrai `status`, filtre frontend fiable) | `status` (déjà appliqué au niveau item) |
| Sales stats (KPI Publiés/Brouillons/Vendus/Visites/Offres/Chiffre/Commissions) | `GET /api/dashboard-analytics/sales` (`dashboardAnalyticsController.sales()`) | `propertyFilter = { status: 'vente', ... }` | **Inchangé** — déjà correct | `status: 'vente'` |
| Sales — widget Patrimoine (Valeur totale/Total biens/Valeur par type/Vacants/Occupés/Coût entretien/Alertes) | `GET /api/property-asset/portfolio/dashboard` (`propertyAssetPortfolioService.getPortfolioDashboard`) | `filter = ownerId ? {owner} : {}` — **aucun filtre transactionnel, tous statuts confondus** | `filter = {...(ownerId?{owner}:{}), ...(status?{status}:{})}`, `status='vente'` transmis depuis `ManagePropertiesPage` (`section==='vente'`) | `status` (nouveau paramètre optionnel, whitelist `['vente','location']` côté serveur) |
| Rentals list | `GET /api/properties/portfolio` (même endpoint que Sales list) | Idem Sales list, filtre frontend `p.status==='location'` | **Inchangé** — déjà correct | `status` |
| Rentals stats (KPI Disponibles/Occupés/Contrats/Loyers/Pénalités/Maintenance/Préavis) | `GET /api/dashboard-analytics/rentals` (`dashboardAnalyticsController.rentals()`) | Aucune requête sur `Property.status` — sourcé de `RentalManagement`/`Contrat`/`Paiement`/`RentalMaintenanceTicket` | **Inchangé** — déjà correct par construction (aucune métrique Property à filtrer) | N/A (autre modèle) |
| Rentals — widget Patrimoine (mêmes champs que Sales) | `GET /api/property-asset/portfolio/dashboard` (même endpoint que Sales) | Idem Sales — bug identique, mêmes valeurs affichées des deux côtés | `status='location'` transmis depuis `ManagePropertiesPage` (`section==='location'`) | `status` |

## Rétrocompatibilité explicite

`GET /api/property-asset/portfolio/dashboard` sans `?status=` conserve exactement son comportement historique (patrimoine global, tous statuts confondus) — vérifié par test dédié et par l'appelant serveur existant `services/reporting/domains/patrimoineReport.js` (`getPortfolioDashboard({})`, jamais de `status`, non modifié).

## Hors périmètre — confirmé non touché

- Catalogue public (`GET /api/properties`) et Home (`GET /api/properties/latest`) : aucune requête modifiée, continuent de mélanger vente/location/hébergement selon leur contrat existant (mandat §49-50).
- `/dashboard/properties` (readOnly, `section=null`) : le widget Patrimoine ne s'y monte pas (`!readOnly` faux), comportement inchangé — confirmé par test dédié.
