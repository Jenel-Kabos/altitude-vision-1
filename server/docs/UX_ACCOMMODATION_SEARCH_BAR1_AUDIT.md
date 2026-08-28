# UX-ACCOMMODATION-SEARCH-BAR-1 — Audit (avant toute modification)

## 1. Composant/page responsable de `/dashboard/hebergements`

`client/app/dashboard/hebergements/page.jsx` → `client/lib/pages/dashboard/ManageAccommodationsPage.jsx` (362 lignes, seul fichier de production concerné par ce mandat).

## 2. Composants de recherche/filtres utilisés

Aucun composant partagé dédié — tout est inline dans `ManageAccommodationsPage.jsx` : un `<input>` de recherche, un `<select>` type, un `<input>` ville, un `<select>` disponibilité, un `<select>` tri, tous stylés via une constante locale `inputClass`.

## 3. États React associés

```js
const [filters, setFilters] = useState({ type: "tous", city: "", availability: "tous", sort: "recent", search: "" });
const [page, setPage] = useState(1);
```
Une seule source de vérité (`filters`), mutée exclusivement via `setFilter(key, value)` qui met aussi `page` à 1. Aucun état dupliqué constaté.

## 4. Appels API déclenchés

`getAccommodationsAdmin(params)` (`client/lib/services/accommodationService.js:64`) → `GET /api/accommodations/admin/list`. Params envoyés :
```js
{ status: 'publie', type, city: city||undefined, availability: availability==='tous'?undefined:availability,
  search: search||undefined, sort, page, limit: 20, independentOnly: true, validatedOnly: true, activeOnly: true }
```

## 5. Logique de filtrage actuelle

**Entièrement backend** — `listAccommodationsForAdmin` (`server/services/accommodationService.js:491`) construit la requête Mongo (`publicationStatus`, `accommodationType`, `hotel`, `active`, population avec `match` sur `title`/`address.city`/`availability`/`statusAdmin`). Le frontend n'effectue **aucun filtrage côté client** — `data.accommodations` est affiché tel quel.

## 6. Debounce éventuel

Oui, **uniquement sur la recherche texte** : `useEffect(() => { setTimeout(() => {setPage(1); load();}, 300) }, [filters.search])`. Les autres filtres (`type`, `city`, `availability`, `sort`) déclenchent `load()` immédiatement via un `useEffect` séparé sans debounce (changement de `<select>`/`<input>` ville non debouncé, un `onChange` de select est un événement discret, pas un flux de frappe — cohérent).

## 7. Pagination éventuelle

Oui — pagination serveur (`page`, `limit: PAGE_SIZE=20`), rendue via des boutons numérotés (identique visuellement au pattern de `ManagePropertiesPage.jsx`, mais celle-ci est client-side sur `ManagePropertiesPage`).

## 8. Comportement responsive actuel

Toolbar : `flex flex-col lg:flex-row` — sur desktop (`lg:` = 1024px+), recherche + 4 filtres + bouton sur une seule ligne flex-wrap ; en dessous de `lg`, **tout s'empile verticalement en pleine largeur** (recherche, puis 4 champs à `py-3`, puis bouton) — d'où la hauteur excessive constatée, y compris sur desktop entre `sm` et `lg` (le point de rupture `lg` est plus haut que celui utilisé par `ManagePropertiesPage.jsx`, qui bascule dès `sm`).

## 9. Composants partagés potentiellement réutilisables

- `client/lib/components/dashboard/DashboardUI.jsx` exporte `DashboardToolbar`, `DashboardBadge`, etc. — **utilisés par `AccommodationModerationPage.jsx`** (page sœur) mais **PAS par `ManageAccommodationsPage.jsx` ni par `ManagePropertiesPage.jsx`** (Sales/Rentals), qui partagent au contraire leur propre famille visuelle auto-contenue (fond dégradé `from-blue-50 via-cyan-50 to-indigo-50`, carte `bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100`, boutons dégradés). **Conclusion : ne pas introduire `DashboardUI.jsx` ici** — la cohérence demandée par le mandat est avec Sales/Rentals, qui n'utilise pas cette famille de composants.
- Aucun composant "chip", "drawer", "panneau de filtres repliable" partagé n'existe dans le projet. Le seul pattern de repli/dépli déjà présent dans ce fichier lui-même est le rendu conditionnel `{(creating || editing) && (...)}` (modale) — un idiome déjà établi, réutilisable pour un panneau de filtres sans nouvelle dépendance.

## 10. Implémentation correspondante dans Sales/Rentals

`client/app/dashboard/sales/page.jsx` et `.../rentals/page.jsx` rendent tous deux `ManagePropertiesPage.jsx` (fichier unique partagé, `section='vente'|'location'`). Sa toolbar (`client/lib/pages/dashboard/ManagePropertiesPage.jsx:652-668`) :
```jsx
<div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 mb-6">
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div className="relative flex-1 w-full md:max-w-md">
      <Search .../><input placeholder="Rechercher un bien…" value={searchTerm} onChange={...} />
    </div>
    {!readOnly && canAddProperty && <button>Ajouter…</button>}
  </div>
</div>
```
**Aucun filtre Type/Ville/Disponibilité/Tri** — uniquement recherche + bouton Ajouter. La recherche filtre **côté client** (`searchTerm` appliqué en mémoire sur `title`/`address.city`/`address.arrondissement`/`type`) sur la totalité des biens déjà chargés en une fois (`getAllProperties({portfolio:true})`), sans pagination serveur (pagination client sur le tableau filtré, `PROPERTIES_PER_PAGE=8`).

**Différence architecturale fondamentale** (à respecter, pas à unifier dans ce mandat) : Sales/Rentals = fetch-all + filtre client ; Hébergements = fetch paginé + filtre serveur multi-critères + debounce recherche. Le mandat demande une harmonisation **visuelle**, pas une fusion d'architecture de données — les deux resteront fonctionnellement distinctes après ce sprint.

## 11. Mécanisme de dark mode — découverte clé pour ce mandat

`client/app/dashboard/dashboard.css` contient un système de "retrofit" générique : toute page rendue sous `.dashboard-content-inner` (confirmé : `AdminDashboard.jsx:462` enveloppe bien les pages dans ce conteneur) voit certaines classes Tailwind déjà utilisées automatiquement remappées en mode sombre via `:where()` + variables CSS, sans qu'aucune classe `dark:` explicite ne soit nécessaire :
- `bg-white`, `bg-white/70…/95` → `var(--db-surface)`
- `bg-gray-50/100`, `bg-slate-50/100` → `var(--db-surface-soft)`
- `text-gray-700/800/900`, `text-slate-700/800/900` → `var(--db-text)`
- `text-gray-400/500/600`, `text-slate-400/500/600` → `var(--db-muted)`
- `border-gray-100/200/300`, `border-slate-100/200/300` → `var(--db-border)`
- `from-blue-50 via-cyan-50 to-indigo-50` (exactement le dégradé de fond de `ManageAccommodationsPage.jsx`) → fond sombre uni
- `input, textarea, select` → hauteur/couleurs harmonisées automatiquement
- Activé par **`@media (prefers-color-scheme: dark)`** (déjà actif aujourd'hui selon la préférence OS) **et** par une classe `.dark` (bascule applicative future, non encore câblée) — les deux blocs sont dupliqués à l'identique.

**Implication directe pour ce sprint** : la toolbar actuelle de `ManageAccommodationsPage.jsx` est déjà "dark-safe" uniquement parce qu'elle réutilise ces classes précises (`bg-white/70`, `border-gray-100`, `border-gray-200`, `text-gray-400/700`). **Toute nouvelle classe introduite (chips, bouton Filtres, panneau replié) doit être choisie dans cette liste déjà couverte**, sous peine de rendre un élément non remappé et donc potentiellement peu lisible en mode sombre. C'est la contrainte de conception la plus importante identifiée par cet audit.

## 12. RBAC observé (non modifié, noté pour mémoire)

`canCreate = ["Admin", "CommunityManager", "Collaborateur"].includes(user?.role)` (frontend) alors que le backend (`POST /accommodations/admin`, IAM-3) restreint désormais la création à `Admin` seul. C'est une divergence **préexistante**, sans rapport avec ce mandat UX, **non modifiée** ici (le mandat interdit explicitement de toucher RBAC).

## 13. État vide / KPI (audit uniquement, cf. mandat §12)

Confirmé déjà documenté dans `HOTFIX_ACCOMMODATION_CREATED_NOT_VISIBLE1_FLOW.md` §6 : le KPI "Hébergements" compte tous les hébergements indépendants du tenant sans filtre de statut, tandis que "Publiés" et la liste ne comptent que `publicationStatus:'publie'`. **Comportement volontaire et déjà documenté** — `total ≠ publiés/validés` par construction. Non modifié dans ce sprint.
