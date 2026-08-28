# HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé.
- `git status --short` : uniquement le travail parallèle déjà documenté dans les hotfix précédents (`ARCH2*`) et mes propres hotfix non commités (`SECURITY-1`, `SECURITY-2`). Aucun fichier lié à la publication mobile n'était déjà modifié.
- `git diff --check` : propre.

## Grep exhaustif dans `altimmo-app/`

| Terme | Résultat |
|---|---|
| `NO_BEDROOMS_TYPES` / `isLand` / `NO_BATHROOMS_TYPES` | `src/utils/publicationValidation.js` — source de vérité unique |
| `bedrooms` | `initialForm` (état), `Counter` (rendu), `publicationPayloads.js` (payload), `Property.js` côté backend (schéma) |
| `Chambres` | Rendu conditionnel dans `AddRentalPropertyScreen.jsx` (ligne 160) et `AddSalePropertyScreen.jsx` (ligne 158) |
| `Salles de bain` / `bathrooms` | Même pattern, même fichiers, condition `visibleFields.bathrooms` |
| `Salon` / `livingRooms`, `Cuisine` / `kitchens` | Toujours rendus (aucun type ne les masque) |

## Fichiers identifiés (audit direct, pas supposé)

- `src/utils/publicationValidation.js` — **source de vérité canonique** : `NO_BEDROOMS_TYPES = ['Terrain', 'Parcelle', 'Entrepôt', 'Bureau', 'Commerce']`, `NO_BATHROOMS_TYPES = ['Terrain', 'Parcelle']`, exposées via `getPropertyVisibleFields(type)` et consommées par `sanitizePropertyFieldsForType(form, type)`.
- `src/screens/Publication/AddRentalPropertyScreen.jsx` (229 lignes) — écran réel de l'étape "Ajouter un bien en location" (`rentalPropertySchema.steps = ['info','location','features','price','photos','summary']`, 6 étapes, `features` = étape 3/6 — correspond exactement à la capture du mandat).
- `src/screens/Publication/AddSalePropertyScreen.jsx` (211 lignes) — équivalent vente, même structure.
- `src/screens/Publication/PublierBienScreen.jsx` (1732 lignes) — **écran legacy**, encore présent mais **utilisé uniquement pour la MODIFICATION d'un bien existant** (`MesAnnoncesScreen.jsx:234`, `navigation.navigate('PublierBien', { editProperty: item })`), plus jamais pour la création. Confirmé par grep exhaustif de tous les appels `navigate('PublierBien'...)`/`navigate('AddRentalProperty'...)` dans `src/` : aucun appel de création ne cible `PublierBien`.
- `src/services/publicationPayloads.js` — `buildRentalPropertyPayload`/`buildSalePropertyPayload` → `buildBasePropertyPayload`, champ `chambres: toNumber(form.bedrooms, 0)`.
- `src/screens/Publication/__tests__/AddRentalPropertyScreen.test.jsx` — **test déjà existant** couvrant explicitement ce scénario.
- Backend : `server/models/Property.js:121` (`bedrooms: { type: Number, default: 0 }`), `server/services/propertyPublicationInputService.js:66,95` (`chambres` du payload mobile mappé vers `bedrooms: chambres || 0`).

## Chaîne de navigation réelle (confirmée)

`TabNavigator` → `PublicationStack` → `ChoixTypeAnnonceScreen` → (`categorie: 'location'`) → `AddRentalPropertyScreen`. C'est le seul chemin de **création** d'un bien en location dans l'app.

## Constat immédiat, avant toute conclusion

Une lecture directe de `AddRentalPropertyScreen.jsx` (ligne 160) montre déjà :
```jsx
{visibleFields.bedrooms && <Counter label="Chambres" value={form.bedrooms} onChange={(v) => setField('bedrooms', v)} />}
```
placé **avant** `Salles de bain`/`Salon`/`Cuisine`, exactement l'ordre recommandé par le mandat (§10). Ce constat oriente directement l'investigation de la cause racine (`HOTFIX_MOB_ADD_PROPERTY_BEDROOMS1_FLOW.md`) plutôt que de supposer le bug reproductible sans vérification.
