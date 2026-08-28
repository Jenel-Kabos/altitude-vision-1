# HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1 — MATRICE DE TESTS

Aucune modification de code de production — cette matrice combine les tests **déjà existants** (`AddRentalPropertyScreen.test.jsx`, `AddSalePropertyScreen.test.jsx`, `publicationValidation.test.js`, `publicationPayloads.test.js`) et le nouveau fichier de caractérisation ajouté par ce mandat (`AddRentalPropertyBedroomsCounter.test.jsx`) pour couvrir explicitement les 14 scénarios du mandat §20.

| # | Scénario (mandat §20) | Couvert par | Résultat |
|---|---|---|---|
| 1 | Location + Appartement → Chambres visible | `AddRentalPropertyScreen.test.jsx` (préexistant) | ✅ Vert |
| 2 | Location + Maison → visible | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau, via les tests compteur/persistance/payload) | ✅ Vert |
| 3 | Location + Villa → visible | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau, test dédié) | ✅ Vert |
| 4 | Location + Parcelle → hidden | `publicationValidation.test.js` (préexistant, teste `getPropertyVisibleFields('Parcelle')`) + `AddRentalPropertyScreen.test.jsx` (Terrain, même liste) | ✅ Vert |
| 5 | Location + Terrain → hidden | `AddRentalPropertyScreen.test.jsx` (préexistant, test dédié) | ✅ Vert |
| 6 | Vente + Maison → comportement inchangé | `AddSalePropertyScreen.test.jsx` (préexistant, 7 tests, rejoués cette session) | ✅ Vert |
| 7 | Compteur + fonctionne | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau) | ✅ Vert |
| 8 | Compteur - fonctionne | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau) | ✅ Vert |
| 9 | Jamais négatif | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau — décrémente sous 0, vérifie `queryByText('-1')` absent) | ✅ Vert |
| 10 | Valeur stockée dans form state | Implicite dans tous les tests ci-dessus (le compteur affiché reflète `form.bedrooms`) | ✅ Vert |
| 11 | Valeur présente dans payload submit | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau — `creerAnnonce` appelé avec `chambres: 4`) | ✅ Vert |
| 12 | Navigation Step 3 → Step 4 conserve la valeur | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau) | ✅ Vert |
| 13 | Retour Step 4 → Step 3 conserve la valeur | `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau, même test que #12) | ✅ Vert |
| 14 | Récapitulatif cohérent si déjà prévu | **Non applicable** — le récapitulatif (étape 6/6) n'affiche aujourd'hui aucun des 4 compteurs (Chambres/Salles de bain/Salon/Cuisine), pour aucun des deux parcours ; ce n'est pas le contrat actuel, donc rien à corriger ici (mandat §14) | Documenté, `_FLOW.md` |

## Suites exécutées cette session

| Suite | Résultat |
|---|---|
| `AddRentalPropertyScreen.test.jsx` (préexistant) | 2/2 ✅ |
| `AddSalePropertyScreen.test.jsx` (préexistant) | 7/7 ✅ |
| `AddRentalPropertyBedroomsCounter.test.jsx` (nouveau) | 4/4 ✅ |
| Suite mobile complète (`npx jest --runInBand`) | 49 suites / 426 tests ✅ (0 échec) |
| `npm run lint` (altimmo-app) | 0 erreur, warnings préexistants uniquement (dont 1 warning `import/first` identique sur le nouveau fichier et sur le fichier préexistant sœur — pattern du projet, pas une régression) |
| `npm run typecheck` (altimmo-app) | 0 erreur |
| `npx expo-doctor` | 20/21 — 1 échec préexistant (dérive de versions patch SDK, sans rapport avec ce mandat, aucune dépendance touchée) |
| `git diff --check` (fichiers de ce mandat) | Propre |

## Device réel

**NON CONFIRMÉ** — aucun appareil Android disponible dans cet environnement. Aucune modification de code de production n'ayant été nécessaire, le risque d'une divergence entre la preuve automatisée (jsdom/React Native Testing Library) et le rendu réel est jugé faible, mais reste non vérifié physiquement.
