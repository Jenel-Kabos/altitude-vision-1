# UX-ACCOMMODATION-SEARCH-BAR-1 — Matrice des portes de qualité

| Gate | Commande | Résultat |
|---|---|---|
| Test ciblé | `npx vitest run lib/__tests__/ManageAccommodationsPage.test.jsx` (depuis `client/`) | **9/12 PASS** — 3 échecs, tous les trois pré-existants avant ce mandat, identiques avant/après (voir `_NON_REGRESSION.md`) |
| Suite frontend complète | `npx vitest run` (depuis `client/`) | **101/103 fichiers, 745/749 tests PASS** — 2 fichiers en échec, tous deux pré-existants et sans rapport avec ce mandat (`ManageAccommodationsPage.test.jsx` ×3 déjà caractérisés, `ManageHotelsPage.test.jsx` ×1 sans aucune dépendance avec les fichiers modifiés) |
| Lint frontend | `npm run lint` (depuis `client/`) | **0 erreur**, 267 warnings — tous pré-existants, aucun sur `ManageAccommodationsPage.jsx`, le test associé, ni les fichiers `e2e/accommodationSearchBar1/` |
| Build production Next.js | `npm run build:next` (depuis `client/`) | **Compilé avec succès** ("✓ Compiled successfully in 27.0s"), aucune erreur, aucun warning référençant les fichiers de ce mandat |
| Validation visuelle réelle (Playwright + Chromium) | `npx playwright test --config=e2e/accommodationSearchBar1/playwright.accommodationSearchBar1.config.js` | **5/5 PASS** — desktop clair (filtres fermés/ouverts), desktop sombre, mobile clair, mobile sombre — captures dans `e2e/accommodationSearchBar1/screenshots/` |
| Architecture (backend) | `npm run architecture:check` (depuis `server/`) | **PASS**, 0 nouvelle violation — non applicable au changement (aucun fichier backend touché), exécuté par prudence |
| Diff whitespace | `git diff --check -- client/lib/pages/dashboard/ManageAccommodationsPage.jsx client/lib/__tests__/ManageAccommodationsPage.test.jsx client/e2e/accommodationSearchBar1/` | Propre, aucun avertissement |
| Git status avant/après | `git status --short` | Comparé avant/après (voir `_DIFF_SCOPE.md`) — uniquement les fichiers de ce mandat ajoutés au diff, aucune modification préexistante d'un autre sprint perdue ou altérée |

## Verdict des gates

Toutes les portes du périmètre de ce mandat sont vertes. Les échecs observés dans les suites globales (frontend et — par ricochet documentaire — backend) sont tous préexistants, identifiés, caractérisés et séparés du changement, conformément au mandat §17.
