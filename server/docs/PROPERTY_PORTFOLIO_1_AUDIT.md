# PROPERTY-PORTFOLIO-1 — Audit initial

## Architecture observée avant correction

`/dashboard/properties` rend `ManagePropertiesPage` en lecture seule. La page appelle `getAllProperties({ dashboardClassification: true })`, soit `GET /api/properties?dashboardClassification=1`.

Cette route appelle `runPropertySearch({ isAdmin: true })` pour les rôles staff immobilier. Le mode staff retire volontairement les filtres `statusAdmin`, `isPublished`, `availability` et `pole` afin que l'ancien consommateur Gestion locative puisse sélectionner un Property interne ou non publié. Le paramètre `dashboardClassification` ne filtre rien : il ajoute seulement une classification issue des relations Property → Accommodation → Hotel.

La page « Tous les biens » est donc aujourd'hui une vue directe de **toute la collection Property**, puis un classement frontend. Elle n'est pas une projection des portefeuilles spécialisés.

## APIs des modules spécialisés

| Domaine | Page | API | Modèle source | Filtre réel de la page |
|---|---|---|---|---|
| Tous les biens | `/dashboard/properties` | `GET /api/properties?dashboardClassification=1` | Property | aucun filtre de publication pour le staff |
| Ventes | `/dashboard/sales` | même API Property, filtre frontend `status=vente` | Property + SaleManagement pour l'édition | aucun filtre de publication pour le staff |
| Locations | `/dashboard/rentals` | même API Property, filtre frontend `status=location` | Property + RentalManagement | aucun filtre de publication pour le staff |
| Hébergements | `/dashboard/hebergements` | `GET /api/accommodations/admin/list` | Accommodation + Property | `publie`, indépendant, actif, Property validée |
| Établissements | `/dashboard/etablissements` | `GET /api/hotels/portfolio` | Hotel + Property | Hotel publié/actif + Property validée/disponible |

## Cause exacte de l'incohérence

1. `GET /api/properties` a un double usage incompatible : catalogue public filtré et référentiel staff non filtré destiné notamment à GL.
2. « Tous les biens » utilise le mode staff non filtré.
3. Les cartes Hotel/Accommodation visibles sont en réalité leurs Property d'ancrage, même si le satellite est non publié, désactivé, suspendu, rejeté ou absent.
4. `dashboardClassification` classe ces ancres mais ne vérifie jamais l'éligibilité du module propriétaire.
5. Hébergements et Établissements imposent leurs propres gates serveur, d'où « Aucun … validé » face à une ancre toujours visible dans Tous les biens.
6. Le widget `PropertyPortfolioDashboard` monté sur Tous les biens agrège toute la collection Property; ses compteurs ne partagent donc pas le dataset de la liste.

Il ne s'agit pas d'un retard de synchronisation : l'architecture consulte deux ensembles logiques différents.

## Champs réellement responsables

- Property : `status` (`vente|location|hebergement`), `statusAdmin`, `isPublished`, `internalManagedOnly`, `availability`, `pole`, `owner`.
- Accommodation : `property`, `hotel`, `accommodationType`, `publicationStatus`, `active`.
- Hotel : `property`, `publicationStatus`, `status`, `active`, `manager`.
- RentalManagement : `property`, `managementActivated`, états opérationnels. Il ne constitue pas une annonce et ne doit pas être une source du portfolio.

Il n'existe pas de `listingType` canonique sur ces modèles. La nature Property est portée par `status`; les cycles spécialisés utilisent `publicationStatus`.

## Matrice des sources de vérité retenues

| Domaine | Source | Condition d'existence | Condition d'éligibilité spécialisée | Condition Tous les biens |
|---|---|---|---|---|
| Vente | Property (`status=vente`) | Property existant | `pole=Altimmo`, `statusAdmin=Validée`, `isPublished=true`, `availability=Disponible` | identique |
| Location | Property (`status=location`) | Property existant | mêmes gates Property; RentalManagement n'ajoute aucun droit de publication | identique |
| Hébergement | Accommodation indépendante + Property | relations présentes, sans Hotel | `publicationStatus=publie`, `active!=false`, Property validée/disponible | identique via `isPubliclyVisible` |
| Hôtel | Hotel + Property | relations présentes | `publicationStatus=publie`, `status=actif`, `active!=false`, Property validée/disponible | identique via le service portefeuille hôtelier |

## Services existants évalués

- `propertyAssetPortfolioService` est un cockpit patrimonial Property/GL et effectue des calculs par bien; ce n'est pas un catalogue multi-source.
- `moderationClassificationService` sait classer les relations, mais ne décide pas de la publication.
- `accommodationService.isPubliclyVisible` est la règle canonique réutilisable pour Accommodation.
- `hotelService.listValidatedHotelPortfolio` est la règle canonique du portefeuille Hôtel.
- `runPropertySearch` doit rester compatible avec le sélecteur GL; le restreindre casserait GL-PROPERTY-FLOW-1.

Un service d'agrégation dédié est donc nécessaire. Il devra calculer une projection en mémoire, sans collection ni copie persistée.

## Classification structurelle des données historiques

Sans connexion à une base réelle et sans suppression :

- A — Property vente/location répondant aux gates : cohérent;
- B — Property hébergement avec satellite non éligible : source spécialisée non publiée;
- C — Property hébergement sans Accommodation ou relation Hotel orpheline : source absente;
- D — plusieurs sources spécialisées pour la même ancre : doublon probable à dédupliquer;
- E — Property d'ancrage Hotel/Accommodation : représentation legacy légitime, jamais une entrée autonome;
- F — statut/type/relations incompatibles : incohérence à signaler sans crash.

La classification des documents réels nécessiterait un dry-run séparé explicitement autorisé avec URI fournie; aucun `.env` ne sera utilisé implicitement.

## Décision

Créer une route staff dédiée et une projection centrale calculée depuis les quatre sources. Ne pas modifier le comportement de `GET /api/properties`, utilisé par le public, GL et d'autres flux historiques. La page Tous les biens et ses variantes Vente/Location consommeront la projection. Aucun listener, aucune synchronisation et aucune nouvelle collection.
