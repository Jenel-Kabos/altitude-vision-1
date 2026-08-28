# HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1 — RAPPORT FINAL

## 1. Résumé

Après audit exhaustif, **le bug décrit n'est pas reproductible sur le HEAD actuel** (`a04055f62952c782b92aeef2f100824a17a5f645`). Le champ "Chambres" est déjà présent, correctement conditionné par la source de vérité canonique (`getPropertyVisibleFields`/`NO_BEDROOMS_TYPES` dans `publicationValidation.js`), déjà testé par un test existant (`AddRentalPropertyScreen.test.jsx`), et déjà payload-complet jusqu'au backend. **Aucune modification de code de production n'a été effectuée** — conformément à la règle finale du mandat ("réutiliser l'existant", "pas de duplication"), puisque l'existant fait déjà exactement ce qui est demandé. Un fichier de test supplémentaire a été ajouté pour combler les scénarios du mandat §20 non encore couverts explicitement (compteur +/-, jamais négatif, persistance entre étapes, valeur dans le payload, type Villa).

## 2. Réponses aux 40 questions du mandat (§28)

1. **Où se trouve le Step 3 réel ?** `altimmo-app/src/screens/Publication/AddRentalPropertyScreen.jsx`, bloc `{step === 'features' && (...)}`, lignes 157-174 — atteint via `TabNavigator` → `PublicationStack` → `ChoixTypeAnnonceScreen` → `AddRentalPropertyScreen` (seul chemin de création en location).
2. **`bedrooms` existait-il déjà dans le state ?** Oui — `initialForm.bedrooms = 0` (ligne 31), déjà présent avant ce mandat.
3. **Dans le payload ?** Oui — `buildRentalPropertyPayload` → `buildBasePropertyPayload` → `chambres: toNumber(form.bedrooms, 0)` (`publicationPayloads.js:44`).
4. **Dans le backend ?** Oui — `Property.bedrooms` (`server/models/Property.js:121`), alimenté par `propertyPublicationInputService.js:95` (`bedrooms: chambres || 0`, mappage `chambres`→`bedrooms` déjà existant et correct).
5. **Pourquoi le champ n'était-il pas visible (d'après le mandat) ?** **NON CONFIRMÉ** — non reproductible sur ce HEAD. Hypothèse la plus probable : capture d'écran issue d'un build EAS installé antérieur à la refonte du 26/07/2026 (commit `84c93c0`, "Update reform web/mobile") qui a introduit ce rendu conditionnel correct ; ou confusion avec l'écran legacy `PublierBienScreen.jsx`, désormais réservé à la modification (jamais à la création).
6. **Bug spécifique location ?** Non applicable — non reproduit ni en location ni en vente.
7. **Ou partagé vente/location ?** Les deux écrans (`AddRentalPropertyScreen.jsx`, `AddSalePropertyScreen.jsx`) sont strictement synchronisés sur ce point (même condition, même ordre, même composant).
8. **Quel composant compteur est utilisé ?** `Counter` (`src/components/publication/Counter.jsx`) — le même que pour Salles de bain/Salon/Cuisine/Caution.
9. **Nouveau composant créé ?** Non.
10. **Pourquoi ?** Non nécessaire — le composant existant convient déjà exactement à l'usage.
11. **Quelle valeur initiale ?** `0` (contrat déjà existant, `initialForm.bedrooms = 0`), non modifiée.
12. **Le compteur peut-il devenir négatif ?** Non — `Counter` applique `Math.max(min, current - 1)` avec `min = 0` par défaut, prouvé par test (`AddRentalPropertyBedroomsCounter.test.jsx`).
13. **Location + Appartement visible ?** Oui, prouvé (test préexistant).
14. **Location + Maison visible ?** Oui, prouvé (nouveau test).
15. **Location + Villa visible ?** Oui, prouvé (nouveau test).
16. **Location + Parcelle masqué ?** Oui, prouvé (`getPropertyVisibleFields('Parcelle').bedrooms === false`, testé dans `publicationValidation.test.js` et par analogie directe avec le test Terrain existant, même liste `NO_BEDROOMS_TYPES`).
17. **Location + Terrain masqué ?** Oui, prouvé (test préexistant).
18. **Vente inchangée ?** Oui, prouvé — `AddSalePropertyScreen.test.jsx`, 7/7 tests rejoués sans modification, tous verts.
19. **`NO_BEDROOMS_TYPES` réutilisé ?** Oui — c'est la seule et unique source consultée par les deux écrans, confirmé par recherche exhaustive.
20. **Une nouvelle liste de types créée ?** Non.
21. **Payload contient bedrooms ?** Oui (sous le nom `chambres`, mappé côté backend vers `bedrooms` — nommage déjà existant, non modifié).
22. **Valeur conservée entre étapes ?** Oui, prouvé (nouveau test, aller-retour Step 3 → Step 4 → Step 3).
23. **Récapitulatif correct ?** Non applicable — le récapitulatif n'affiche aujourd'hui aucun compteur (Chambres/SDB/Salon/Cuisine), pour aucun des deux parcours ; ce n'est pas une régression de ce mandat, documenté dans `_FLOW.md`, non modifié conformément au mandat §14.
24. **Backend modifié ?** Non.
25. **Pourquoi ?** Aucune incompatibilité prouvée — `Property.bedrooms` existe déjà, accepté pour vente et location, mappage `chambres`→`bedrooms` déjà fonctionnel.
26. **Règle métier modifiée ?** Non.
27. **Tenant modifié ?** Non.
28. **RBAC modifié ?** Non.
29. **Tests ciblés ?** Oui — `AddRentalPropertyScreen.test.jsx` (2/2), `AddSalePropertyScreen.test.jsx` (7/7), `AddRentalPropertyBedroomsCounter.test.jsx` nouveau (4/4).
30. **Tests mobile complets ?** Oui — 49 suites / 426 tests, tous verts.
31. **Lint ?** 0 erreur (warnings préexistants inchangés).
32. **Typecheck ?** 0 erreur (`tsc --noEmit` silencieux).
33. **Expo export ?** Non exécuté (aucune modification de code justifiant un export de production ; le build ne serait pas différent de la dernière version publiée).
34. **Expo Doctor ?** 20/21 checks passés — le seul échec est une dérive de versions patch du SDK Expo, préexistante, sans rapport avec ce mandat (aucune dépendance modifiée).
35. **Device réel ?** **NON CONFIRMÉ** — aucun appareil disponible dans cet environnement.
36. **`git diff --check` ?** Propre.
37. **Commit ?** Non.
38. **Push ?** Non.
39. **Deploy ?** Non.
40. **Verdict ?** Voir §4.

## 3. Fichiers créés/modifiés

**Code de production** : **aucun** — le comportement attendu par le mandat existe déjà intégralement.

**Tests (1 fichier créé)** :
- `altimmo-app/src/screens/Publication/__tests__/AddRentalPropertyBedroomsCounter.test.jsx` — 4 tests comblant les scénarios du mandat §20 non encore couverts par les tests préexistants.

**Documentation (5 fichiers créés dans `server/docs/`)** :
`HOTFIX_MOB_ADD_PROPERTY_BEDROOMS1_ETAT_INITIAL.md`, `_FLOW.md`, `_TYPE_MATRIX.md`, `_TEST_MATRIX.md`, `_REPORT.md` (ce fichier).

## 4. Verdict

**CERTIFIÉ VERT SOUS RÉSERVE DEVICE.**

Tous les critères du mandat §29 sont remplis : cause racine investiguée et documentée (bug non reproductible sur le HEAD actuel, cause la plus probable identifiée quoique non confirmable sans accès au build ayant produit la capture) ; "Chambres" visible pour tous les types résidentiels concernés en location (Appartement, Appartement meublé, Maison, Villa, Studio) ; types sans chambres restent masqués (Terrain, Parcelle, Bureau, Commerce, Entrepôt) ; aucune duplication de règle, `NO_BEDROOMS_TYPES`/`getPropertyVisibleFields` réutilisés tels quels ; compteur fonctionnel (incrément/décrément/jamais négatif prouvés) ; valeur persistée en state et entre étapes ; payload correct et vérifié jusqu'au champ envoyé à `creerAnnonce` ; vente non régressée (7/7 tests) ; Parcelle/Terrain non régressés ; aucune règle métier/tenant/RBAC modifiée ; suite de tests mobile complète verte (49/426) ; lint et typecheck verts ; gate Expo vert à l'exception d'un échec préexistant sans rapport ; `git diff --check` vert.

Le seul point non "CERTIFIÉ VERT" sans réserve : la vérification sur un appareil Android réel n'a pas pu être effectuée (aucun device disponible), et l'origine exacte de la capture d'écran ayant motivé ce mandat n'a pas pu être confirmée (build antérieur probable, non vérifiable depuis cet environnement).

**Recommandation** : avant de considérer ce sujet définitivement clos, vérifier sur l'appareil ayant servi à la capture d'écran que l'application installée est bien à jour avec la dernière build EAS (postérieure au 26/07/2026) — si le champ reste absent après mise à jour de l'app installée, cela indiquerait une cause non détectée par cet audit statique et justifierait une réouverture avec capture de logs device (comme pour `HOTFIX-MOB-PROPERTY-PUBLISH-FAILURE-2`, dont la capture de logs n'avait jamais abouti).

## 5. STOP

Conformément au mandat, ce travail s'arrête ici — audit → cause racine → (aucune correction de production nécessaire) → tests → rapport.

**En attente de validation de l'utilisateur — en particulier confirmation que l'app installée sur l'appareil ayant produit la capture d'écran est à jour — avant tout commit.**
