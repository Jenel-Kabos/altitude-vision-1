# HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 — Matrice des requêtes

## Surface A — `/dashboard/sales` (liste)

| | |
|---|---|
| Composant | `ManagePropertiesPage` (`client/lib/pages/dashboard/ManagePropertiesPage.jsx`), `section="vente"` |
| Service frontend | `getAllProperties({ portfolio: true })` (`client/lib/services/propertyService.js`) |
| Endpoint | `GET /api/properties/portfolio` |
| Controller | `propertyPortfolioController.list` |
| Service backend | `propertyPortfolioService.getPropertyPortfolio` |
| Query Mongo | `Property.find({ ...PROPERTY_PUBLICATION_FILTER, ...ownerScope })` où `PROPERTY_PUBLICATION_FILTER = { pole:'Altimmo', status:{$in:['vente','location']}, statusAdmin:'Validée', isPublished:true, availability:'Disponible' }` |
| Filtre frontend supplémentaire | `properties.filter(p => p.status === 'vente')` (défensif, déjà prouvé fiable par HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1) |
| `status` requis | `vente` ou `location` (`$in`) |
| `statusAdmin` requis | `Validée` |
| `isPublished` requis | **`true`** |
| tenant requis | Scope propriétaire (`ownerScope`), résolu par `expandScopeWithUnaffiliatedUsersIfSoleTenant` en amont dans `propertyPortfolioController.list` |
| `pole` requis | `Altimmo` |
| Le document réel passe ? | **NON** |
| Raison exacte | `isPublished=false` — le document échoue le seul critère `isPublished:true` du filtre, alors que tous les autres critères (`status`, `statusAdmin`, `availability`, `pole`, scope owner) sont satisfaits |

## Surface A — `/dashboard/sales` (KPI + Patrimoine, prouvant la divergence rapportée)

| Bloc | Endpoint | Filtre Mongo | Le document réel passe ? |
|---|---|---|---|
| KPI (Total/Actifs/Brouillons/Publiés/Vendus/Visites/Offres/Chiffre/Commissions) | `GET /api/dashboard-analytics/sales` | `propertyFilter = {status:'vente', ...ownerScope}` — **aucun filtre `statusAdmin`/`isPublished`/`availability`/`pole`** sur `total`/`active`/`drafts` ; seul le sous-champ `published` applique `{statusAdmin:'Validée', isPublished:true, availability:'Disponible', pole:'Altimmo'}` via un `$cond` interne | **OUI pour total/active/drafts (d'où Valeur totale=80M, Total biens=1, Actifs=1, Brouillons=1) — NON pour `published` (0)** |
| Patrimoine (`PropertyPortfolioDashboard`) | `GET /api/property-asset/portfolio/dashboard?status=vente` | `propertyAssetPortfolioService.getPortfolioDashboard({status:'vente', ownerId})` → `Property.find({status:'vente', ...ownerFilter})` — **même absence de filtre publication** (ce widget agrège le patrimoine géré, publié ou non, par contrat — voir HOTFIX_PROPERTY_SALE_RENT_SEPARATION1) | **OUI** (explique "Valeur totale 80M / Total biens 1 / Valeur par type Parcelle 80M") |

**C'est exactement cette divergence de filtre entre KPI/Patrimoine (aucun filtre publication) et liste/catalogue (filtre publication strict) qui produit l'incohérence visuelle rapportée — un comportement déjà voulu et documenté (KPI = vue de gestion incluant les brouillons ; liste/catalogue = vue publique stricte), pas un bug de requête.**

## Surface B — `/dashboard/properties`

| | |
|---|---|
| Composant | `ManagePropertiesPage`, `readOnly`, **aucun `section`** |
| Service frontend | `getAllProperties({ portfolio: true })` — **identique à la Surface A** |
| Endpoint | `GET /api/properties/portfolio` — **le même endpoint que Sales list**, sans filtre `status` supplémentaire côté frontend |
| Query Mongo | Identique à Surface A |
| Le document réel passe ? | **NON**, pour exactement la même raison (`isPublished=false`) |
| "Biens éligibles" | Confirmé par lecture de code : ce KPI frontend (`portfolioKpis`, ligne 507-512 de `ManagePropertiesPage.jsx`) est dérivé de `filteredProperties.length` — la MÊME liste que la grille de cartes, jamais une source différente. "Tous les biens" est donc, par construction, le catalogue interne du **portefeuille publiable et dédupliqué** (documenté dès HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1), pas un inventaire brut de tous les documents `Property` existants — comportement métier volontaire, pas une régression |

## Surface C — Home > Nos Dernières Annonces > Altimmo

| | |
|---|---|
| Composant | `HomePage.jsx` (`hp-annonces` section, filtré par pôle actif) |
| Service frontend | `getLatestPropertiesByPoles(['Altimmo'], 5)` (`client/lib/services/propertyService.js`) |
| Endpoint | `GET /api/properties/latest?pole=Altimmo&limit=5` |
| Middleware | `propertyController.getLatestProperties` (fixe `limit=5`, `sort=-createdAt`) → `propertyController.getAllProperties` |
| Query Mongo | `runPropertySearch({query, isAdmin:false})` → `baseFilter = {availability:'Disponible', statusAdmin:'Validée', isPublished:true, pole:'Altimmo'}` (requête publique, `optionalAuth`, non-admin) |
| Filtres frontend | Aucun filtre de publication supplémentaire — uniquement l'affichage |
| "Voir tout" | `Link to={activePoleData.route}` → route publique catalogue (`/properties` ou équivalent, même `runPropertySearch` non-admin) — **jamais** `/dashboard/properties` |
| Le document réel passe ? | **NON** |
| Raison exacte | Identique — `isPublished=false` échoue `baseFilter.isPublished:true` |

## Conclusion de la matrice

Les trois surfaces appliquent un prédicat de publication **cohérent entre elles** (`statusAdmin:'Validée'` + `isPublished:true` + `availability:'Disponible'` + `pole:'Altimmo'`, à des endroits différents du code mais avec des valeurs identiques — voir recherche de duplication ci-dessous) et **rejettent toutes les trois le document réel pour la même raison exacte** : `isPublished=false`. Aucune des trois n'a de bug de requête propre — la divergence visible dans les captures est entièrement expliquée par le contraste entre les KPI/Patrimoine (qui n'appliquent délibérément aucun filtre de publication, par contrat) et les listes/catalogue (qui l'appliquent strictement, par contrat).
