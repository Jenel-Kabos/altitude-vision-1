# HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1 — MATRICE PAR TYPE DE BIEN

Source unique : `getPropertyVisibleFields(type)` (`src/utils/publicationValidation.js`), consommée identiquement par `AddRentalPropertyScreen.jsx` et `AddSalePropertyScreen.jsx`. Aucune liste locale n'a été créée — la même fonction est appelée dans les deux écrans.

| Type (`PROPERTY_TYPES`) | Dans `NO_BEDROOMS_TYPES` ? | Chambres — Location | Chambres — Vente | Dans `NO_BATHROOMS_TYPES` ? | Salles de bain |
|---|---|---|---|---|---|
| Appartement | Non | **Visible** | **Visible** | Non | Visible |
| Appartement meublé | Non | **Visible** | **Visible** | Non | Visible |
| Maison | Non | **Visible** | **Visible** | Non | Visible |
| Villa | Non | **Visible** | **Visible** | Non | Visible |
| Studio | Non | **Visible** | **Visible** | Non | Visible |
| Bureau | Oui | Masqué | Masqué | Non | Visible |
| Commerce | Oui | Masqué | Masqué | Non | Visible |
| Entrepôt | Oui | Masqué | Masqué | Non | Visible |
| Terrain | Oui | Masqué | Masqué | Oui | Masqué |
| Parcelle | Oui | Masqué | Masqué | Oui | Masqué |

`Salon`/`Cuisine` : jamais masqués, pour aucun type — confirmé, aucune entrée équivalente à `NO_BEDROOMS_TYPES` n'existe pour ces deux champs, cohérent avec le rendu inconditionnel observé dans les deux écrans.

## Vérification directe (lecture de code, pas supposition)

```js
const NO_BEDROOMS_TYPES  = ['Terrain', 'Parcelle', 'Entrepôt', 'Bureau', 'Commerce'];
const NO_BATHROOMS_TYPES = ['Terrain', 'Parcelle'];
```
comparé à `PROPERTY_TYPES` (`src/constants/propertyTypes.js`) : `Appartement`, `Appartement meublé`, `Maison`, `Villa`, `Terrain`, `Parcelle`, `Bureau`, `Commerce`, `Studio`, `Entrepôt` — correspondance exacte des chaînes (mêmes accents, mêmes valeurs), aucun risque de non-appariement silencieux.

## Aucune liste locale créée (mandat §3/§9/§19)

Recherche exhaustive : aucune deuxième déclaration de `NO_BEDROOMS_TYPES` ni d'équivalent (`HIDDEN_BEDROOM_TYPES`, `noBedroomsFor`, etc.) trouvée nulle part dans `altimmo-app/src/`. La seule source de vérité reste `publicationValidation.js`.
