# UX-ACCOMMODATION-SEARCH-BAR-1 — Validation visuelle réelle

## Méthode

Harnais Playwright + esbuild réutilisant le patron déjà établi pour INBOX-2/HOTFIX-INBOX-SECURITY-2 dans ce même projet (`client/e2e/accommodationSearchBar1/`) : le **vrai composant de production** `ManageAccommodationsPage.jsx` est bundlé en mémoire (esbuild), monté dans un vrai moteur Chromium, avec le **vrai CSS compilé de production** (`npm run build:next` exécuté avant la validation, `.next/static/css/*.css`). Seuls les services réseau (`accommodationService`, `dashboardAnalyticsService`), le contexte auth, `next/image`, `next/link` et le composant `MapLeaflet` (carte Leaflet, hors périmètre visuel de ce test) sont stubbés — jamais le composant testé lui-même.

Fichiers : `mountAccommodations.entry.jsx`, `fixtures.js`, `accommodations-visual.spec.js`, `playwright.accommodationSearchBar1.config.js`, `screenshots/*.png`.

## Captures obtenues (5/5, toutes réellement rendues en Chromium)

| Fichier | Scénario | Résultat observé |
|---|---|---|
| `desktop-light-filters-closed.png` | 1440×900, clair, filtres fermés | Toolbar compacte sur une ligne : `[ 🔍 Rechercher un hébergement… ] [ Filtres ] [ + Ajouter un hébergement ]` — conforme au mock du mandat §3 |
| `desktop-light-filters-open.png` | 1440×900, clair, filtres ouverts (Ville="Brazzaville", Disponibilité="Maintenance") | Bouton "Filtres (2)", chips "Brazzaville ×" / "Maintenance ×", lien "Réinitialiser", panneau compact Type/Ville/Disponibilité/Tri sous séparateur |
| `desktop-dark-filters-closed.png` | 1440×900, sombre (`prefers-color-scheme: dark`) | Toolbar, champ recherche, bouton Filtres et fond de page correctement retrofit en sombre via le mécanisme générique de `dashboard.css` (aucune classe `dark:` nécessaire) |
| `mobile-light.png` | 390×844, clair | Recherche pleine largeur sur sa ligne, puis `[ Filtres ] [ Ajouter ]` côte à côte — conforme au mock mobile du mandat §8 |
| `mobile-dark.png` | 390×844, sombre | Même disposition mobile, correctement retrofit en sombre |

## Comparaison avec `/dashboard/sales`

Non re-capturée dans ce harnais (mandat §14 demande une comparaison, pas nécessairement une capture supplémentaire) — la comparaison est faite directement sur le code source dans `_AUDIT.md` §10 : même famille de carte (`bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100`), même point de rupture responsive (`sm:flex-row`), même style de bouton "Ajouter" (dégradé vert, pill). La différence residuelle assumée (présence du panneau "Filtres" et des chips côté Hébergements, absent côté Sales) est documentée et justifiée dans `_UX_DECISION.md`.

## Ce qui n'a pas été capturé, et pourquoi

- **Focus-visible clavier** : vérifié fonctionnellement par la présence de `focus:ring-2 focus:ring-blue-500` sur tous les champs (hérité, inchangé) et `aria-expanded`/`aria-controls` sur le bouton Filtres (testé par `ManageAccommodationsPage.test.jsx`), mais non capturé en image (l'état focus est instantané et peu lisible sur une capture statique sans mise en évidence supplémentaire) — vérifié par lecture de code et par test automatisé plutôt que par capture.
- **`.dark` (bascule applicative par classe)** : le mécanisme existe dans `dashboard.css` mais n'est câblé nulle part dans l'application (confirmé par `_AUDIT.md` §11) — non testable tant qu'aucun composant ne pose la classe `.dark`. Seul `prefers-color-scheme: dark` (déjà actif) a été validé, ce qui est la seule voie de dark mode réellement active aujourd'hui.
