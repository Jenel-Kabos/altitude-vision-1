# UX-ACCOMMODATION-SEARCH-BAR-1 — Comportement actuel (figé avant correction)

Référence de test : `client/lib/__tests__/ManageAccommodationsPage.test.jsx` (pré-existant, 9 tests, tous verts avant modification — voir `_TEST_MATRIX.md` pour la preuve d'exécution).

## Contrat fonctionnel figé (doit rester vrai après la refonte visuelle)

1. Au montage, `getAccommodationsAdmin` est appelé avec `{status:'publie', independentOnly:true, validatedOnly:true, activeOnly:true, ...}`.
2. Taper dans le champ recherche (`aria-label="Rechercher un hébergement"`) met à jour `filters.search` et déclenche `getAccommodationsAdmin({..., search: <valeur>})` après un debounce de 300ms.
3. Changer le select Ville (`aria-label="Ville"`) déclenche `getAccommodationsAdmin({..., city: <valeur>})` immédiatement (pas de debounce).
4. Changer le select Disponibilité (`aria-label="Disponibilité"`) déclenche `getAccommodationsAdmin({..., availability: <valeur>})`.
5. Changer le select Tri (`aria-label="Trier par"`) déclenche `getAccommodationsAdmin({..., sort: <valeur>})`.
6. Aucun contrôle de modération (`Valider|Rejeter|Suspendre`) n'est jamais affiché sur cette page.
7. État de chargement : squelette de 8 cartes (`role="status" aria-label="Chargement des hébergements"`).
8. État vide : message "Aucun hébergement validé" + phrase "apparaîtront ici après leur validation…" + bouton "Ajouter un hébergement" si `canCreate`.
9. État d'erreur : `role="alert"` + bouton "Réessayer" qui relance `load()`.
10. Bouton "Ajouter un hébergement" ouvre la modale `AccommodationPropertyForm` (création) — comportement et endpoint **inchangés par ce mandat**.
11. Bouton "Modifier" ouvre la même modale en mode édition.
12. Bouton "Archiver" ouvre une confirmation puis appelle `deactivateAccommodation(id)`.
13. Les liens d'action (Voir/Réservations/Calendrier/Finances) pointent vers `/dashboard/hebergements/:id[?view=...]`.

## Mesures visuelles actuelles (avant correction)

- Toolbar : `p-4 sm:p-6`, champs à `py-3` (recherche + 4 filtres empilés en dessous de `lg` = 1024px).
- Hauteur totale de la toolbar sur mobile/tablette : recherche (1 ligne) + 4 champs (4 lignes) + bouton (1 ligne) = **6 blocs empilés en pleine largeur**, contre 2 blocs (recherche + bouton) chez Sales/Rentals.
- Aucun panneau repliable, aucun badge de comptage, aucun chip de filtre actif.
