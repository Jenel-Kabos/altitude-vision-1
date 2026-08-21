# HOTFIX-MOB-ADD-PROPERTY-1 — État initial

Date : 2026-08-21. Branche `main`.

## 1. Baseline Git

```
git status --short → 77 entrées (travail non commité d'INBOX-PRO-2 + changements externes déjà documentés dans les sprints précédents), rien de surprenant
git branch --show-current → main
git rev-parse HEAD → 15506a7 (inchangé depuis INBOX-PRO-2)
git diff --check → exit 0
```

## 2. Écran identifié

`altimmo-app/src/screens/Publication/AddSalePropertyScreen.jsx` — formulaire "Ajout d'un bien en vente" (6 étapes, dernière = "Vérification et publication"). Service partagé : `altimmo-app/src/services/publicationPayloads.js` (construction du payload/FormData, probablement partagé avec `AddRentalPropertyScreen.jsx`/`AddAccommodationScreen.jsx`).

## 3. Sources de vérité des types de biens (inventaire exhaustif, `grep 'Entrepôt'`)

| Fichier | Rôle | Contient déjà "Parcelle" ? |
|---|---|---|
| `server/models/Property.js` (`type.enum`) | **Source de vérité backend réelle** — bloque toute création avec une valeur hors liste | Non |
| `server/constants/propertyFilterConstants.js` (`PROPERTY_TYPES`) | Miroir explicitement testé en parité avec `Property.js` (`propertyFilterConstants.test.js`) — filtres de recherche | Non |
| `server/models/Proprietaire.js` (`bienSchema.type.enum`) | Legacy `biensPropres[]` (fiches propriétaire pré-Property, non lié à la création mobile) | Non |
| `client/lib/constants/propertyTypes.js` | Web, affichage/formulaire | Non |
| `client/lib/utils/propertyFormConfig.js` (`isLand`) | Web, dérive les champs affichés (`isLand === 'Terrain'`) | Non (logique à étendre) |
| `altimmo-app/src/constants/propertyTypes.js` (`PROPERTY_TYPES`) | **Mobile, source de vérité de l'écran cible** | Non |
| `altimmo-app/src/utils/publicationValidation.js` (`NO_BEDROOMS_TYPES`/`NO_BATHROOMS_TYPES`) | Mobile, dérive quels champs sont requis selon le type | Non (Terrain seul) |
| `server/utils/valuationConstants.js` | Liste DISTINCTE (estimation de valeur), contient déjà `"Parcelle agricole"` — **pas le même référentiel**, non concerné |

**Conclusion** : "Parcelle" n'existe nulle part dans le référentiel `Property.type`. Ce n'est pas un simple oubli d'affichage mobile — le backend rejetterait la création si le frontend l'envoyait sans la correction du schéma. "Terrain" et "Parcelle" doivent coexister comme deux valeurs distinctes (le mandat liste "Parcelle" à ajouter À CÔTÉ des 9 types existants, jamais en remplacement de "Terrain").

## 4. Plan

1. Ajouter `'Parcelle'` à `Property.js` (enum + message d'erreur), `propertyFilterConstants.js`, `Proprietaire.js` (cohérence), `client/lib/constants/propertyTypes.js`, `propertyFormConfig.js` (traiter comme un terrain — pas de chambres/salles de bain), `altimmo-app/src/constants/propertyTypes.js`, `publicationValidation.js` (mêmes règles que Terrain).
2. Auditer `AddSalePropertyScreen.jsx`/`publicationPayloads.js` pour la construction du FormData, reproduire précisément la cause de "Unsupported FormDataPart implementation" AVANT correction.
3. Comparer avec un autre écran mobile qui upload déjà des images avec succès (candidat : `AddAccommodationScreen.jsx`/`HotelEstablishmentScreen.jsx`).
4. Corriger uniquement le(s) champ(s) fautif(s), sans changer la librairie réseau.
5. Tests + gates + rapport.
