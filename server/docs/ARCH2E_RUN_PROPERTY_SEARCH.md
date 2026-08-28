# ARCH-2E — `runPropertySearch`

- Définition : `controllers/propertyController.js`, lignes ~421–508.
- Importateur externe : `controllers/altimmoSearchController.js`; appel interne : `getAllProperties`.
- Raison : réutiliser exactement la query Vente/Location/Tous entre `/properties` et `/altimmo/search` sans duplication.
- Inputs : `{ query, isAdmin }`; output : Promise `{ properties, total }`.
- DB : deux queries Property via `APIFeatures`; lecture Accommodation conditionnelle pour filtrer les hébergements publiés.
- Public predicate : `availability=Disponible`, `statusAdmin=Validée`, `isPublished=true`, `pole=Altimmo`.
- Vente/location : filtres normalisés par `propertyFilterService`; aucun filtre public supplémentaire par type.
- Hébergement mixte : post-filtre `Accommodation.publicationStatus=publie` après pagination ; total potentiellement surestimé, limitation documentée existante.
- Tenant/ownership/PlatformOperator/IAM : aucun filtre direct ; `isAdmin` ouvre la vue staff et est calculé différemment par les deux callers (`Admin` seul dans Altimmo search, `STAFF_IMMO` dans getAllProperties).
- Side effect : log uniquement ; aucune écriture/provider.

ARCH-2C4 l'a différée car ce helper contient un prédicat de publication public critique, deux collections, pagination/APIFeatures et une divergence volontaire de contexte staff. Cette raison reste valide, renforcée par les incidents récents `statusAdmin/isPublished`.

La cible conceptuelle appropriée serait un **query service Property Search** explicite, pas une façade. Risque d'extraction : moyen-élevé. Les tests `altimmoSearch.mongo.integration` et `propertyApprovedVisibilityEndToEnd.mongo.integration` sont pertinents mais insuffisants seuls : il faudrait une matrice exhaustive public/staff, alias filtres, pagination mixte et prédicats de visibilité. Ne pas traiter maintenant.
