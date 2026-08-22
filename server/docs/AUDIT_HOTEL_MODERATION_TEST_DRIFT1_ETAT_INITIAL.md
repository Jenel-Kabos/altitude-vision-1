# AUDIT-HOTEL-MODERATION-TEST-DRIFT-1 — État initial

Date : 2026-08-22. Branche `main`. `HEAD` = `51f581edd130b496eb00a732424af8eb3a2ddb1d` (inchangé depuis HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1). `git diff --check` exit 0. `git status --short` : 13 lignes, dont la même modification externe préexistante de `client/lib/pages/dashboard/HotelModerationPage.jsx` déjà signalée (et non créée) par le hotfix précédent, plus les fichiers introduits par ce dernier (Property/Sales/Rentals — hors périmètre de cet audit, non re-touchés ici).

## Fichiers exacts identifiés

- `client/lib/pages/dashboard/HotelModerationPage.jsx` — composant modifié (préexistant, non commité).
- `client/lib/__tests__/HotelModerationPage.test.jsx` — test en échec.
- Dépendances directes, vérifiées **non modifiées** (`git status`/`git diff --stat` vides pour chacune) :
  - `client/lib/services/hotelService.js` (`getPendingHotels`, `reviewHotel`)
  - `client/lib/constants/hotel.js` (`HOTEL_SERVICES`, `HOTEL_RATE_TYPES`)
  - `client/lib/utils/publicationError.js`
  - `client/lib/components/dashboard/DashboardUI.jsx` (`DashboardCard`, `DashboardPage`, `DashboardPageHeader`, `DashboardState`, `DashboardToolbar` — déjà utilisés ailleurs, ex. `PropertyModerationPage.jsx`)
  - `client/app/dashboard/moderation/hotellerie/page.jsx` (route wrapper, aucun garde de rôle explicite ici — l'accès est déjà conditionné en amont par le layout dashboard/la navigation, inchangé)

## Reproduction de l'échec (avant toute modification)

```
npx vitest run lib/__tests__/HotelModerationPage.test.jsx
```

Résultat : **2 tests sur 2 échouent.**

1. `compare la proposition en rappelant que la version publiée reste active`
   → `expect(await screen.findByText('Modification sensible proposée')).toBeInTheDocument()` **timeout** — le texte n'apparaît nulle part dans le DOM rendu initialement (il n'existe désormais que dans la modale de détail, jamais affiché avant un clic).
2. `valide la proposition uniquement depuis Modération Hôtellerie`
   → `fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))` **timeout** — aucun bouton "Valider" n'existe dans le DOM initial ; le DOM rendu au moment du timeout montre une carte avec un bouton "Voir les détails" (Eye icon) mais pas de bouton d'action de modération direct.

Le dump DOM capturé au timeout confirme la nouvelle structure : `<h2>Nom publié</h2>`, adresse, catégorie, "0 catégories de chambres", puis `<button>… Voir les détails</button>` — aucune trace de "Valider"/"Rejeter"/"Modification sensible proposée" à ce stade, cohérent avec un flux liste-carte → clic → modale.

## Diff préexistant de HotelModerationPage.jsx — commentaire d'intention (source primaire)

Le fichier porte lui-même, dans son en-tête, l'explication de la modification :

```
// HOTFIX-MODERATION-HOTEL-UI-1 — alignement visuel avec
// PropertyModerationPage.jsx / AccommodationModerationPage.jsx : stats en
// cartes dégradées, filtre en pilules, grille de DashboardCard compactes +
// modal de détail pour l'action de modération (au lieu du formulaire de
// rejet inline dans chaque carte).
```

Ce commentaire, présent dans le code lui-même (pas une hypothèse de cet audit), déclare explicitement un alignement UX délibéré et cohérent avec deux autres pages de modération du même dashboard, plutôt qu'une modification accidentelle.
