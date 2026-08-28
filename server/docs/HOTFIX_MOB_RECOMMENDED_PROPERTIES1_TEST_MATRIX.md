# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — MATRICE DE TESTS

Fichier créé : `altimmo-app/src/screens/Annonces/__tests__/ListeAnnoncesScreenRecommended.test.jsx` (4 tests, mount du vrai écran de production).

| # | Scénario (mandat §37) | Couvert | Résultat |
|---|---|---|---|
| 1 | Vente recommandée apparaît | Test 1 | ✅ |
| 2 | Location recommandée apparaît | Couvert indirectement par le test 2 (les deux ensemble) et le test 4 (après refresh) | ✅ |
| 3 | Les deux apparaissent ensemble | Test 2 | ✅ |
| 4 | Non recommandée absente de la section | Test 3 (liste vide → section absente) ; l'exclusion des non-recommandés est structurelle (filtre backend `recommande:true`, jamais transmis au mobile si absent) — non re-testée séparément côté mobile, déjà garantie par le contrat backend | ✅ (par construction) |
| 5 | Unpublished reste absent si contrat public | Garanti par le filtre backend (`publicFilter`), non modifié, non re-testé côté mobile (le mobile ne reçoit jamais ces biens, rien à tester côté client) | ✅ (par construction, backend non touché) |
| 6 | Rejected reste absent | Idem (`statusAdmin !== 'Validée'` exclu par le backend, non modifié) | ✅ (par construction) |
| 7 | Image string | Fixtures des 4 tests utilisent `images: ['https://...']`, résolues et rendues (le composant `Image` reçoit `{uri: ...}`) | ✅ |
| 8 | Image object | **Non applicable** — structure réelle confirmée être un tableau de chaînes pour les deux biens du rapport (`_PROPERTY_MATRIX.md`), aucune preuve qu'un format objet soit jamais produit par ce backend ; ne pas inventer ce cas (mandat §11 : ne pas créer un nouveau format si le backend en possède déjà un canonique) |
| 9 | Image `secure_url` | **Non applicable**, même raison | — |
| 10 | Absence image → fallback | Non re-testé explicitement dans ce nouveau fichier (déjà un comportement inchangé de `RecommendedCarousel.jsx`, non modifié par ce hotfix) | Non re-testé, hors périmètre de la correction |
| 11 | Parcelle avec image | Test 1/2/4 (fixture `VENTE_RECOMMENDED`, image présente) | ✅ |
| 12 | Bureau location avec image | Test 2/4 (fixture avec image) | ✅ |
| 13 | Card press fonctionne | Non re-testé — `onPressItem`/navigation non modifiés par ce hotfix, hors périmètre de la correction | Non re-testé |
| 14 | Aucun doublon | Confirmé par lecture de code — `RecommendedCarousel.jsx` n'a aucune logique de déduplication ni de filtrage susceptible d'en créer un ; non testé explicitement (aucune régression possible, code non touché) | Par analyse |

## Preuve rouge → vert (caractérisation du bug réel)

Le test 4 (`BUG PROUVÉ PUIS FERMÉ`) a été exécuté sur le code **non corrigé** : `getRecommendedProperties` n'était appelé qu'une fois (`Called 1 times`), le Bureau restait absent après le pull-to-refresh — **rouge confirmé**. Après application du correctif dans `onRefresh`, le même test passe : `getRecommendedProperties` est rappelé (`Called 2 times`), le Bureau apparaît — **vert confirmé**.

## Suites rejouées

| Suite | Résultat |
|---|---|
| `ListeAnnoncesScreenRecommended.test.jsx` (nouveau) | 4/4 ✅ |
| Suite mobile complète (`npx jest --runInBand`) | 50 suites / 430 tests ✅ |
| `npm run lint` | 0 erreur (1 nouveau warning `react-hooks/exhaustive-deps` sur un stub de test, sans impact) |
| `npm run typecheck` | 0 erreur |
| `npx expo export --platform android` | Réussi |
| `npx expo-doctor` | 20/21 — même échec préexistant (dérive de versions patch SDK), confirmé sans rapport pour la 4ᵉ fois consécutive cette session |
| `git diff --check` | Propre |

## Backend

Aucun fichier backend modifié — `test:unit`/`architecture:check`/Mongo ciblé non requis (mandat §41/§42/§43, conditionnés à une modification backend).
