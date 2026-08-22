# HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 — État initial

Date : 2026-08-21. Branche `main`. `HEAD` = `51f581edd130b496eb00a732424af8eb3a2ddb1d` au démarrage. `git status --short` montrait une seule ligne préexistante, sans rapport avec ce hotfix : `client/lib/pages/dashboard/HotelModerationPage.jsx` (390 insertions/81 suppressions, travail externe en cours non commité — laissé strictement intact tout au long de ce sprint). `git diff --check` exit 0.

**Écart de process assumé** : ce document est rédigé après le début de l'audit/correctif plutôt qu'avant la première modification, comme l'exigeait le mandat. L'audit lui-même a bien précédé toute écriture de code (voir séquence ci-dessous) ; seule la rédaction de ce fichier a été retardée. Signalé honnêtement plutôt que masqué.

## 1. Rapports du hotfix précédent (lus intégralement avant travail)

- `HOTFIX_PROPERTY_PUBLICATION_VISIBILITY1_REPORT.md` : confirme le bien réel `PARCELLE A VENDRE` (`_id` masqué `6a887b…e4ec`), `status=vente` (canonique, aucun `listingType`), `statusAdmin=Validée`, corrige `isPublished` (false→true à la validation Admin) et le KPI Sales "Publiés". **Ne pas revenir dessus sans régression prouvée — confirmé non régressé (voir §Gates).**
- `HOTFIX_PROPERTY_PUBLICATION_VISIBILITY1_QUERY_MATRIX.md` : documente déjà que le "dashboard Patrimoine" (`GET /api/property-asset/portfolio/dashboard`) est "une projection différente : il agrège tous les actifs accessibles" — explication déjà notée pour la valeur 80 000 000/Parcelle, mais son montage identique sur Sales ET Rentals n'avait pas été identifié comme un bug dans ce sprint précédent (hors périmètre de ce rapport-là).
- `HOTFIX_PROPERTY_PUBLICATION_VISIBILITY1_VISIBILITY_MATRIX.md` : matrice de visibilité publique, non affectée par ce hotfix (aucun champ de publication touché ici).

## 2. Champ canonique Vente/Location — preuve

`server/models/Property.js` : `status: { type: String, enum: ['vente', 'location', 'hebergement'], ... }` (vérifié par lecture directe, cohérent avec le hotfix précédent). Aucun champ `listingType`/`transactionType`/`offerType` séparé n'existe sur `Property` — `status` EST le champ canonique. `statusAdmin` (`En attente`/`Validée`/`Rejetée`) et `isPublished` (booléen) sont des axes orthogonaux (modération / publication), jamais confondus avec `status` dans le code audité.

## 3. Traçage /dashboard/sales et /dashboard/rentals

Les deux routes (`client/app/dashboard/sales/page.jsx`, `client/app/dashboard/rentals/page.jsx`) rendent le **même composant** `ManagePropertiesPage` (`client/lib/pages/dashboard/ManagePropertiesPage.jsx`) avec `section="vente"` / `section="location"` respectivement (endpoint/composant partagé, confirmé — cause D du mandat en jeu).

Cette page monte **trois surfaces distinctes**, documentées séparément (aucune ne partage le même endpoint qu'une autre) :

| Surface | Composant | Endpoint | Filtre transactionnel appliqué avant correctif |
|---|---|---|---|
| Liste des biens | `ManagePropertiesPage` (état `filteredProperties`) | `GET /api/properties/portfolio` | Backend : aucun (retourne vente+location+hébergement publiés) ; **Frontend** : `properties.filter(p => p.status === statusFilter)` — correct, voir §4 |
| KPI métier (Publiés/Brouillons/Vendus… ou Disponibles/Contrats…) | `DashboardKpis` alimenté par `analytics.kpis` | `GET /api/dashboard-analytics/sales` ou `/rentals` | Backend : `sales()` filtre `status:'vente'` ; `rentals()` ne touche pas `Property` du tout (RentalManagement/Contrat/Paiement) — **correct des deux côtés**, voir §4 |
| Widget "Patrimoine" (Valeur totale / Total biens / Valeur par type / Biens vacants/occupés…) | `PropertyPortfolioDashboard` | `GET /api/property-asset/portfolio/dashboard` | **Backend : AUCUN filtre transactionnel — `filter = ownerId ? {owner} : {}`.** Monté à l'identique sur Sales ET Rentals (`isStaffDocs(user) && !readOnly`, ne lit jamais `section`). **C'est la cause exacte du bug.** |

## 4. Preuve que les deux autres surfaces étaient déjà correctes

- **Liste** : `GET /api/properties/portfolio` (`propertyPortfolioService.getPropertyPortfolio`) applique déjà `PROPERTY_PUBLICATION_FILTER` (`status: {$in:['vente','location']}`, `statusAdmin:'Validée'`, `isPublished:true`, `availability:'Disponible'`, `pole:'Altimmo'`) et tague chaque item avec son vrai `status`. Le filtre frontend `p.status === statusFilter` (ligne 99-100 de `ManagePropertiesPage.jsx`) filtre donc un champ réel et fiable, pas une valeur devinée. Un test de caractérisation (`ManagePropertiesPage.test.jsx`, préexistant) confirme déjà "Toutes les annonces" affiche le bon `href` par famille (`dashboardClassification.family`). **Aucune preuve de bug ici — non modifié**, conformément à "corriger seulement après preuve" (mandat §10).
- **KPI métier** (`dashboard-analytics/sales|rentals`) : `sales()` filtre explicitement `status:'vente'` (`server/controllers/dashboardAnalyticsController.js:30`) ; `rentals()` ne référence jamais `Property.status` — ses métriques (disponibles/occupés/contrats actifs/loyers…) proviennent exclusivement de `RentalManagement`/`Contrat`/`Paiement`/`RentalMaintenanceTicket`, jamais de `Property` directement, donc structurellement sans risque de compter une vente. **Aucune preuve de bug ici — non modifié**, conformément au mandat §16 ("ne force pas le filtre Property sur des métriques qui ont une autre source").

## 5. Cause racine prouvée — Widget Patrimoine

`server/services/propertyAssetPortfolioService.js`, fonction `getPortfolioDashboard({ ownerId })` :
```js
const filter = ownerId ? { owner: ownerId } : {};
const properties = await Property.find(filter)...
```
Pour un compte staff (`isStaff` dans `propertyAssetController.getPortfolioDashboard`), `filter = {}` — **absolument tous les `Property`, tous statuts confondus** (vente, location, hébergement). Le composant `PropertyPortfolioDashboard.jsx` est monté sans transmettre `section` :
```jsx
{isStaffDocs(user) && !readOnly && <PropertyPortfolioDashboard />}
```
identique sur `/dashboard/sales` et `/dashboard/rentals` — d'où les captures observées (Valeur totale = Total biens = Valeur par type identiques des deux côtés pour le même bien `PARCELLE A VENDRE`, `status=vente`).

### Classification (mandat §10)

**Cause A (Rentals n'applique aucun filtre vente/location) combinée à D (endpoint/composant partagé sans discriminant)** — le widget Patrimoine, par construction (patrimoine global multi-domaine), n'a jamais reçu de discriminant transactionnel, et son montage sur deux pages spécialisées sans transmettre l'univers métier de la page a produit le mélange observé. Le type physique (`Parcelle`) n'est en aucun cas impliqué dans la cause — confirmé par lecture du code : aucune branche `if (type === ...)` n'existe dans ce chemin.

## 6. Bien réel — PARCELLE A VENDRE

| Champ | Valeur |
|---|---|
| `_id` | masqué (identique au hotfix précédent) |
| `type` | `Parcelle` |
| `status` (canonique) | `vente` |
| `statusAdmin` | `Validée` |
| `isPublished` | `true` (après le hotfix précédent, en local) |
| `price` | `80 000 000` |
| `pole` | `Altimmo` |

Condition Rentals qui l'acceptait à tort : **aucune condition du tout** — `getPortfolioDashboard({})` sans filtre `status` incluait ce document au même titre que n'importe quel autre bien, indépendamment de `status`.

## 7. Plan

1. `propertyAssetPortfolioService.getPortfolioDashboard` : ajouter un paramètre optionnel `status` (filtre Mongo natif, appliqué avant toute agrégation — mandat §52), rétrocompatible (comportement historique inchangé si absent, ex. `patrimoineReport.js` qui appelle `getPortfolioDashboard({})` sans `status`).
2. `propertyAssetController.getPortfolioDashboard` : lire `req.query.status`, valider contre une liste blanche stricte `['vente','location']` (mandat §24 — jamais une valeur forgée arbitraire).
3. `propertyAssetService.js` (client) + `PropertyPortfolioDashboard.jsx` : relayer `status` en prop, sans aucun recalcul côté client.
4. `ManagePropertiesPage.jsx` : transmettre `status={section === 'vente' ? 'vente' : section === 'location' ? 'location' : undefined}` au montage du widget.
5. Tests de caractérisation (avant/après) + tests d'agrégation (80M vente / 20M location, jamais 100M des deux côtés) + non-régression publication/modération/Parcelle/tenant.
