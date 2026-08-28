# UX-ACCOMMODATION-SEARCH-BAR-1 — Matrice de tests

## Fichier : `client/lib/__tests__/ManageAccommodationsPage.test.jsx`

| Test | Statut avant ce mandat | Statut après ce mandat | Nature |
|---|---|---|---|
| "la liste des biens est l'unique vue principale…" | PASS | PASS | Inchangé |
| "expose la recherche et les filtres métier sans filtre de modération" | PASS | **Adapté puis PASS** | Ajout d'un clic sur "Filtres" avant d'interagir avec Ville/Disponibilité/Tri (désormais repliés) — le contrat fonctionnel vérifié (paramètres envoyés à l'API) est strictement identique |
| "affiche un skeleton structuré pendant le chargement" | **FAIL (pré-existant)** | **FAIL (identique, non touché)** | Hors périmètre — voir `_NON_REGRESSION.md` |
| "affiche l'état vide et l'action autorisée" | PASS | PASS | Inchangé |
| "affiche une erreur accessible et permet de réessayer" | **FAIL (pré-existant)** | **FAIL (identique, non touché)** | Hors périmètre |
| "déplace les vues opérationnelles vers la route détail préfiltrée" | **FAIL (pré-existant)** | **FAIL (identique, non touché)** | Hors périmètre |
| "permet la modification avec le formulaire existant" | PASS | PASS | Inchangé |
| "archive sans supprimer l'historique après confirmation" | PASS | PASS | Inchangé |

## Nouveaux tests ajoutés (describe "UX-ACCOMMODATION-SEARCH-BAR-1 — toolbar compacte")

| Test | Vérifie |
|---|---|
| "les filtres avancés sont repliés par défaut et le bouton Filtres les ouvre/ferme" | Panneau absent du DOM par défaut, `aria-expanded="false"`, apparition/disparition au clic, `aria-expanded="true"`, `aria-controls` pointant vers le panneau réel |
| "le bouton Filtres affiche le nombre de filtres actifs" | Libellé exact `Filtres (1)` puis `Filtres (2)` selon le nombre de filtres non-défaut |
| "affiche un chip par filtre actif et permet de le retirer individuellement" | Chip visible pour un filtre actif, clic sur son bouton "Retirer le filtre …" relance l'API avec la valeur par défaut, chip disparaît |
| "Réinitialiser n'apparaît que si un filtre non par défaut est actif, et remet tout aux valeurs par défaut sans effacer la recherche" | Bouton absent par défaut, apparaît si tri ≠ défaut même sans chip, clic relance l'API avec toutes les valeurs par défaut **sauf la recherche**, qui reste inchangée |

## Preuve de non-duplication d'état

Tous les nouveaux tests interrogent exclusivement le DOM rendu et les appels à `getAccommodationsAdmin` (le seul point d'observation externe) — aucune assertion sur un état interne dupliqué, car aucun état dupliqué n'a été introduit (`activeFilterEntries` est dérivé de `filters` via `useMemo`, jamais stocké séparément).

## Exécution

`npx vitest run lib/__tests__/ManageAccommodationsPage.test.jsx` (depuis `client/`) → 9 PASS / 3 FAIL (préexistants, identiques avant/après). Suite complète : `npx vitest run` → 101/103 fichiers PASS, 745/749 tests PASS ; les 2 fichiers en échec (`ManageAccommodationsPage.test.jsx` pour 3 tests déjà expliqués, `ManageHotelsPage.test.jsx` pour 1 test sans aucun rapport avec ce mandat) sont détaillés dans `_NON_REGRESSION.md` et `_GATE_MATRIX.md`.
