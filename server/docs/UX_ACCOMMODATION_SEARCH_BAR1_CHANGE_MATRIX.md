# UX-ACCOMMODATION-SEARCH-BAR-1 — Matrice avant/après

| Aspect | Avant | Après |
|---|---|---|
| Disposition principale | Recherche + Type + Ville + Disponibilité + Tri + Ajouter, empilés `flex-col lg:flex-row` (bascule à 1024px) | `[Recherche] [Filtres] [Ajouter]`, `flex-col sm:flex-row` (bascule à 640px, aligné sur Sales/Rentals) |
| Champs Type/Ville/Disponibilité/Tri | Toujours visibles, `py-3`, empilés pleine largeur sous 1024px | Repliés par défaut dans un panneau (`#accommodations-filters-panel`), `py-2.5`, `flex-wrap` compact, ouverts via le bouton "Filtres" |
| Bouton Filtres | N'existait pas | Nouveau — `aria-expanded`, `aria-controls`, libellé `Filtres` ou `Filtres (N)` selon le nombre de filtres actifs |
| Filtres actifs | Aucune représentation visuelle dédiée | Chips (Type/Ville/Disponibilité) avec bouton "×" de suppression individuelle |
| Réinitialisation | Aucun bouton dédié (fallait vider chaque champ un par un) | Bouton "Réinitialiser" (visible si ≥1 filtre non-défaut, y compris le tri), remet Type/Ville/Disponibilité/Tri aux valeurs par défaut sans toucher la recherche |
| Mobile (<640px) | 6 blocs empilés pleine largeur (recherche, 4 filtres, bouton) | 2 lignes : recherche pleine largeur, puis `[Filtres][Ajouter]` côte à côte |
| Bouton Ajouter | Texte "Ajouter un hébergement" toujours, `lg:w-auto` | Texte adaptatif : "Ajouter un hébergement" (`sm:`) / "Ajouter" (mobile), `flex-1 sm:flex-none` |
| Paramètres API envoyés | `status, type, city, availability, search, sort, page, limit, independentOnly, validatedOnly, activeOnly` | **Strictement identiques** |
| Debounce recherche | 300ms | **Inchangé** |
| Endpoint/logique Ajouter, Modifier, Archiver | `POST /accommodations/admin`, modale `AccommodationPropertyForm`, `deactivateAccommodation` | **Strictement inchangés** |
| RBAC / tenant / modération / publication | Non concernés par la toolbar | **Non modifiés** |

## Nouvel état React (additif, aucun état existant supprimé)

| État | Avant | Après |
|---|---|---|
| `filters` | `{type, city, availability, sort, search}` | **Inchangé** (même forme, même valeurs par défaut, désormais nommées `DEFAULT_FILTERS`) |
| `filtersOpen` | N'existait pas | Nouveau, `useState(false)` |
| `activeFilterEntries` | N'existait pas | Nouveau, dérivé (`useMemo`) de `filters` — jamais un état séparé stocké |
| `isFiltered` | N'existait pas | Nouveau, dérivé (calcul simple, pas de `useState`) |
