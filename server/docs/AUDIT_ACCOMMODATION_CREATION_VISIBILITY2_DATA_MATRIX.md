# AUDIT-ACCOMMODATION-CREATION-VISIBILITY-2 — Matrice de données

## État créé et visibilité

| Créateur / parcours | Complétude | Documents | État initial | Property | Tenant | Liste Hébergements | Modération | KPI hébergements | Dashboard général |
|---|---|---|---|---|---|---|---|---|---|
| Admin dashboard | readiness OK | Property + Accommodation; RatePlan optionnel | `soumis`, `active=true` | `status=hebergement`, `statusAdmin=En attente`, owner fourni ou Admin | Property absent; Accommodation dépend de `actingUser.platformTenant`, contexte non installé par la route | Non (`publie` + Property `Validée` requis) | Non dans un contexte tenant si tenant `null`; sinon oui comme `soumis` | Exclu si tenant `null`; sinon total +1 | Property brute +1 |
| Admin dashboard | readiness KO | mêmes documents | `brouillon`, `active=true` | mêmes valeurs | même défaut | Non | Non (`soumis` requis) | Exclu si tenant `null`; sinon total/draft +1 | Property brute +1 |
| Propriétaire mobile complet | complet selon service mobile | composition complète | `soumis` | Property support | contexte du service mobile | Non avant validation/publication | Oui si scope cohérent | selon tenant | Property brute +1 |

Le cas propriétaire est supporté par `mobileAccommodationPublicationRoute.mongo.integration.test.js`; la route simple `POST /accommodations` crée seulement un profil autour d'un Property existant et n'est pas le flux observé.

## Champs demandés

| Champ conceptuel | Champ réel / valeur |
|---|---|
| `status` | uniquement sur Property : `hebergement` |
| `publicationStatus` | Accommodation : `brouillon` par défaut, puis `soumis` si readiness OK; `publie` après validation |
| `moderationStatus` | **champ inexistant** |
| `isApproved` | **champ inexistant** |
| `isPublished` | Property possède ce champ (valeur par défaut du modèle; non forcée par cette création); la liste accommodation se fonde ici sur `statusAdmin`, pas `isPublished` |
| `isActive` | champ conceptuel inexistant; Accommodation utilise `active`, défaut `true` |
| `draft/submitted/validated` | encodés par `publicationStatus = brouillon/soumis/publie` |
| owner | `req.body.owner` valide, sinon `req.user.id`, porté par Property; Accommodation porte `createdBy` |
| pole | Property : payload ou `Altimmo` |
| relation | `Accommodation.property` requis et unique → relation 1:1 vers Property; pas de discriminator ni collection commune |

## Readiness

| Source | Conditions |
|---|---|
| `evaluateReadiness` | type, `capacity.maxAdults > 0`, check-in, check-out, `bedrooms` numérique (0 accepté), `bathrooms > 0` |
| validation formulaire | type, adultes > 0, au moins une image à la création |
| écart | le formulaire n'exige pas `bathrooms > 0`; le backend accepte donc un HTTP 201 en laissant le document en brouillon |

La validation staff finale est encore plus stricte (`computeCompletionScore`) : informations, photos, tarif, équipements, règles et services doivent atteindre la complétude attendue.

## Comparaison des nombres observés

| Surface | Source | Filtres | Observé communiqué | Interprétation |
|---|---|---|---:|---|
| Dashboard général | collection `properties` | aucun | 4 | inventaire Mongo brut global |
| Tous les biens | projection Property/Accommodation/Hotel | publication/validation/visibilité + scope + déduplication | 2 | portefeuille éligible, pas inventaire brut |
| Hébergements (liste) | collection `accommodations` + populate Property | tenant + `publie` + indépendant + actif + Property `Validée` | 0 | aucun document ne passe tous les gates |
| Hébergements (KPI) | agrégation `accommodations` | tenant + indépendant | 0 | cohérent avec une Accommodation créée sans tenant canonique |

## Tests ciblés exécutés

Commande : quatre suites Mongo ciblées (`accommodationCreatedVisibility`, `accommodationAdminListsTenantScope`, `dashboardAnalyticsTenantScope`, `propertyPortfolio`). Résultat : **4/4 suites, 42/42 tests verts**.

Ce résultat confirme les règles isolées. Il expose une lacune : `accommodationCreatedVisibility` appelle directement le service avec une Property fixture déjà `Validée` et sans tenant de liste; il ne reproduit ni le payload réel `En attente`, ni le middleware tenant absent de `POST /admin`.

