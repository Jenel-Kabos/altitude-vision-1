# HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1 — FLUX ET CAUSE RACINE

## Traçage complet UI → payload → backend

1. **State initial** (`AddRentalPropertyScreen.jsx:28-35`) : `bedrooms: 0` présent dès `initialForm` — le champ existait déjà, confirmé.
2. **Sélection du type** (étape `info`) → `onSelectType` appelle `sanitizePropertyFieldsForType(prev, type)` (source canonique) qui **remet `bedrooms` à 0 si le type est dans `NO_BEDROOMS_TYPES`**, ne touche pas `bedrooms` sinon.
3. **Étape `features`** (étape 3/6, "Caractéristiques") : `visibleFields = getPropertyVisibleFields(form.type)` (calculé via `useMemo`, dépendance `form.type`) → `{visibleFields.bedrooms && <Counter label="Chambres" .../>}`.
4. **Compteur** : `Counter` — même composant partagé que `Salles de bain`/`Salon`/`Cuisine`/`Caution` (`src/components/publication`), pas un composant dédié créé pour ce mandat.
5. **Navigation Step 3 → Step 4 → retour** : le state `form` vit dans le composant parent (`useState`), jamais réinitialisé entre étapes — `bedrooms` survit à toute navigation avant/arrière dans le wizard.
6. **Soumission** (`handlePublish`) : `buildRentalPropertyPayload(form, uploaded)` → `buildBasePropertyPayload` → `chambres: toNumber(form.bedrooms, 0)`, jamais filtré par `stripEmpty` (0 n'est ni `null`/`undefined`/`''`).
7. **Backend** (`propertyMobileController.js` → `buildMobilePropertyData` → `propertyPublicationInputService.js:66,95`) : `chambres` (payload mobile) → `bedrooms: chambres || 0` (Mongoose `Property.bedrooms`).
8. **Récapitulatif** (étape `summary`) : `AddRentalPropertyScreen.jsx:202-212` — n'affiche actuellement **aucune** ligne "Chambres" (ni "Salles de bain"/"Salon"/"Cuisine" d'ailleurs — seuls Type/Titre/Ville/Surface/Loyer/Caution/Photos y figurent). Ce n'est pas un oubli introduit par ce mandat : c'est le contrat actuel du composant de récapitulatif, confirmé identique pour `AddSalePropertyScreen.jsx`. Conformément au mandat §14 ("ne pas l'ajouter automatiquement sauf si cela découle naturellement du même composant"), **aucun ajout n'est fait ici** — ce n'est pas la régression signalée (le mandat porte sur l'étape 3, pas sur le récapitulatif).

## Cause racine — résultat de l'investigation

**Le bug décrit N'EST PAS REPRODUCTIBLE sur le HEAD actuel (`a04055f...`).** Le code de `AddRentalPropertyScreen.jsx` affiche déjà "Chambres" pour tout type non listé dans `NO_BEDROOMS_TYPES`, dans le même bloc et avec le même composant que "Salles de bain"/"Salon"/"Cuisine", exactement comme demandé par le mandat. Un test automatisé préexistant (`AddRentalPropertyScreen.test.jsx`, non modifié par ce hotfix) le prouve déjà : il vérifie explicitement `expect(screen.getByText('Chambres')).toBeTruthy()` pour un type "Appartement" en location, et `expect(screen.queryByText('Chambres')).toBeNull()` après bascule vers "Terrain" — **ce test est vert sur le HEAD actuel** (rejoué cette session, voir `_TEST_MATRIX.md`).

### Cause A à F (mandat §6) — évaluation

- **A. UI oubliée dans Step 3** — Non, le rendu conditionnel est présent (ligne 160).
- **B. Condition `listingType === 'vente'`** — Non trouvée ; `AddRentalPropertyScreen.jsx` ne contient aucune branche liée à `vente`, la condition est uniquement `visibleFields.bedrooms` (dérivée du `type` de bien, pas de l'offre vente/location).
- **C. `bedrooms` caché par une logique `isLand` trop large** — Non ; `NO_BEDROOMS_TYPES` ne contient que 5 types (`Terrain`, `Parcelle`, `Entrepôt`, `Bureau`, `Commerce`), tous les types résidentiels testés (`Appartement`, `Appartement meublé`, `Maison`, `Villa`, `Studio`) en sont exclus.
- **D. Duplication entre formulaire vente et location** — Les deux écrans sont bien deux fichiers séparés (pas un écran unique conditionnel), mais **strictement synchronisés** : même logique, même ordre, même composant, aucune divergence trouvée entre `AddSalePropertyScreen.jsx:158` et `AddRentalPropertyScreen.jsx:160`.
- **E. Ancien refactor ayant supprimé le rendu** — Non trouvé sur ce fichier ; l'historique (`git log`) montre que ce fichier a été introduit/révisé par les commits "Update refonte formulaire d'ajout des biens sur mobile" (`512de01`) et "Update reform web/mobile" (`84c93c0`, 2026-07-26), qui **ont already introduit** ce rendu conditionnel correct.
- **F. Autre cause réelle — la plus probable** : l'écran de création réel (`AddRentalPropertyScreen.jsx`) a déjà été corrigé par la refonte du 2026-07-26, mais **la capture d'écran du mandat provient très probablement d'une version installée antérieure à cette refonte** (build EAS non mis à jour sur l'appareil de test), ou d'une confusion avec l'écran legacy `PublierBienScreen.jsx` — **désormais réservé à la modification d'un bien existant**, jamais à sa création (confirmé par grep exhaustif des appels de navigation, `_ETAT_INITIAL.md`). **NON CONFIRMÉ** : impossible de vérifier la version de build réellement installée sur l'appareil ayant produit la capture, aucun device disponible dans cet environnement.

## Bug réel identifié en cours d'audit — distinct, mineur

Le récapitulatif (étape 6/6) n'affiche aujourd'hui ni "Chambres", ni "Salles de bain", ni "Salon", ni "Cuisine" pour aucun des deux parcours (vente/location) — **contrat déjà existant, pas une régression de ce mandat**, documenté mais non modifié conformément au mandat §14.
