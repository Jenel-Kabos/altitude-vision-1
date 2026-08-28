# UX-ACCOMMODATION-SEARCH-BAR-1 — Non-régression

## Contrats fonctionnels vérifiés inchangés

Voir `_CURRENT_BEHAVIOR.md` pour la liste des 13 comportements figés — tous re-vérifiés verts après la refonte (à l'exception des 3 déjà rouges avant toute modification, voir ci-dessous), y compris :
- Paramètres exacts envoyés à `getAccommodationsAdmin` (search/city/availability/sort/type inchangés).
- Debounce recherche 300ms, absence de debounce sur les autres filtres.
- Aucun contrôle de modération jamais affiché.
- Bouton "Ajouter un hébergement" → même modale, même endpoint (`POST /accommodations/admin`, non touché).
- Bouton "Modifier" → même modale en édition.
- Bouton "Archiver" → même `deactivateAccommodation`.
- Liens Voir/Réservations/Calendrier/Finances → mêmes routes.
- États chargement/erreur/vide → mêmes messages, mêmes déclenchements.

## Échecs pré-existants, identifiés et séparés du changement (mandat §17)

### 1. `ManageAccommodationsPage.test.jsx` — 3 tests (déjà rouges avant toute modification de ce mandat)

Confirmé par exécution de la suite **avant** toute modification (voir `_AUDIT.md`/`_CURRENT_BEHAVIOR.md`) :

| Test | Cause racine identifiée |
|---|---|
| "affiche un skeleton structuré pendant le chargement" | Le mock `getAccommodationsAdmin.mockReturnValue(new Promise(() => {}))` produit un premier montage sans données existantes → le composant rend la branche `isFirstLoad` (spinner plein écran, ligne 127 du fichier d'origine), qui n'a pas `role="status"`. Le squelette avec `role="status"` (ligne 215) n'apparaît que lors d'un rechargement *après* un premier succès. Décalage test/composant pré-existant. |
| "affiche une erreur accessible et permet de réessayer" | Le bloc d'erreur du composant (branche `error`) n'a jamais eu d'attribut `role="alert"` — vérifié par `grep` sur le fichier avant toute modification. Le test attend un rôle qui n'existe pas dans le balisage. |
| "déplace les vues opérationnelles vers la route détail préfiltrée" | Le mock `vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }))` ne transmet ni `title` ni aucune autre prop au `<a>` rendu — hors `children`/`href`. Les liens d'action de `PropertyManagementCard` (Voir/Réservations/…) sont des icônes sans texte dont le **seul** nom accessible provient de l'attribut `title`, jamais transmis par ce mock incomplet. |

**Aucun de ces trois défauts ne concerne la zone de recherche/filtres** — ils portent sur l'état de premier chargement, le balisage d'erreur, et un mock de test partagé (`next/link`) affectant les actions de carte. Non corrigés dans ce mandat (hors périmètre explicite : "fichiers frontend strictement nécessaires à /dashboard/hebergements" désigne la toolbar, pas ces trois zones distinctes).

### 2. `ManageHotelsPage.test.jsx` — 1 test (sans aucun rapport)

"archive via le cycle de vie hôtelier et retire ensuite la carte" échoue (`deactivateHotel` jamais appelé) — fichier et composant entièrement différents (`ManageHotelsPage.jsx`, gestion hôtelière), aucune dépendance avec `ManageAccommodationsPage.jsx` ni avec les fichiers modifiés par ce mandat. Confirmé pré-existant (le fichier n'a pas été touché par ce mandat).

## Vérifications spécifiques demandées par le mandat §16

- **Les hébergements publiés continuent d'apparaître** : confirmé par le test "la liste des biens est l'unique vue principale…" (PASS, inchangé) et par la capture `desktop-light-filters-closed.png`.
- **Les filtres retournent les mêmes résultats qu'avant** : mêmes paramètres API exacts (voir `_TEST_MATRIX.md`), aucune requête modifiée.
- **Ajouter un hébergement fonctionne toujours** : bouton, modale et endpoint strictement inchangés — seul son emplacement dans la toolbar a changé.
- **La navigation reste correcte** : liens Voir/Réservations/Calendrier/Finances inchangés (test PASS pour ce qui n'est pas déjà en échec pré-existant côté `title`/mock `next/link`).
- **HZ-04 n'est pas affecté** : aucun fichier backend touché par ce mandat (confirmé par `git status` — seuls des fichiers `client/` et `server/docs/` sont modifiés/créés).
- **HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 n'est pas affecté** : `server/services/accommodationService.js` (modifié par ce hotfix précédent) n'est touché par aucun fichier de ce mandat.
- **Aucune logique de modération n'est modifiée** : `publicationStatus`, `reviewDecision`, `AccommodationModerationPage.jsx` non touchés.
