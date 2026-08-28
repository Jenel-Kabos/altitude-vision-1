# UX-ACCOMMODATION-SEARCH-BAR-1 — Décision UX

## Disposition retenue

**Ligne principale** (toujours visible) : `[ Recherche (flex-1) ] [ Filtres ] [ Ajouter un hébergement ]`, `flex-col sm:flex-row` — bascule dès `sm` (640px), comme `ManagePropertiesPage.jsx` (Sales/Rentals utilise déjà `sm:flex-row`, contre `lg:flex-row` auparavant sur Hébergements — alignement direct sur le point de rupture de la référence demandée).

**Mobile** (< 640px) : recherche pleine largeur seule sur sa ligne, puis `[ Filtres ] [ Ajouter ]` côte à côte sur la ligne suivante (`flex-1` chacun) — exactement le mock du mandat §8.

**Ligne des chips** (visible seulement si ≥1 filtre restrictif actif OU tri ≠ défaut) : chips `Type ×`, `Ville ×`, `Disponibilité ×` (un chip par filtre réellement non-défaut), suivis d'un bouton texte "Réinitialiser".

**Panneau filtres avancés** (visible seulement si `filtresOpen === true`, replié par défaut) : Type, Ville, Disponibilité, Trier par — en ligne compacte (`flex-wrap`, `py-2.5` au lieu de `py-3`), sous un séparateur (`border-t`).

## Pourquoi ce découpage précis

- **Recherche hors du panneau replié** : c'est le champ le plus utilisé, il doit rester accessible en un clic, cohérent avec Sales/Rentals où c'est le seul champ visible.
- **Tri non représenté en chip** : un tri n'exclut aucun résultat (contrairement à Type/Ville/Disponibilité) — le représenter comme un chip "supprimable" aurait suggéré à tort qu'il filtre des résultats. Il reste compté dans la condition d'affichage de "Réinitialiser" (`isFiltered`) mais n'apparaît pas comme chip individuel — décision assumée, documentée ici plutôt que laissée implicite.
- **"Réinitialiser" ne touche jamais la recherche texte** : la recherche vit hors du panneau "Filtres" (comme chez Sales/Rentals) ; réinitialiser les filtres avancés ne doit pas effacer un texte que l'utilisateur est en train de taper — comportement dérivé proprement de la séparation déjà existante entre `filters.search` et le reste de l'état `filters`, sans dupliquer la source de vérité.
- **Badge de comptage intégré au texte du bouton** (`Filtres (2)`) plutôt qu'un badge séparé : dérivable proprement de `activeFilterEntries.length` (déjà nécessaire pour les chips), zéro état dupliqué, et exactement le format donné en exemple par le mandat (§6).

## Choix de classes CSS — contrainte dark mode (cf. `_AUDIT.md` §11)

Toutes les classes nouvellement introduites sont choisies dans l'ensemble déjà couvert par le retrofit générique de `dashboard.css` (`bg-white`, `bg-gray-50`, `text-gray-700`, `text-gray-400`, `border-gray-100`, `border-gray-200`), ou reprennent un accent déjà présent ailleurs dans ce même fichier sans remap dédié (`text-blue-600`/`hover:text-blue-800`, déjà utilisé par l'eyebrow du header à la ligne 154 du fichier d'origine, donc déjà accepté visuellement en mode sombre par précédent direct). Aucune nouvelle couleur non couverte n'est introduite.

## Pourquoi pas de drawer/modal pour les filtres avancés

Aucun composant drawer/accordéon partagé n'existe dans le projet (cf. `_AUDIT.md` §9). Le seul pattern de repli déjà présent dans ce fichier est le rendu conditionnel JSX (`{condition && (...)}`, utilisé pour la modale Créer/Modifier). Le panneau de filtres réutilise cet idiome exact — aucune nouvelle dépendance UI, conforme au mandat §8/§15.

## Pourquoi pas de fusion avec `DashboardUI.jsx`

Voir `_AUDIT.md` §9 : Sales/Rentals (la référence demandée) n'utilise pas cette famille de composants — l'utiliser ici créerait une **nouvelle** incohérence visuelle plutôt que d'en résoudre une.

## Ce qui reste strictement inchangé

- Les 4 dimensions de filtre (Type, Ville, Disponibilité, Tri) et leurs valeurs possibles.
- Les paramètres exacts envoyés à `getAccommodationsAdmin`.
- Le debounce de la recherche (300ms) et l'absence de debounce sur les autres filtres.
- Le bouton "Ajouter un hébergement", son composant modal, son endpoint.
- Toute logique de pagination, chargement, erreur, archivage.
