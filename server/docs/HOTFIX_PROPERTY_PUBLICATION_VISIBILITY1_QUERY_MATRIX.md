# HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1 — Matrice des requêtes

| Surface | Endpoint | Query backend | Filtre frontend | Bien inclus avant | Bien inclus après nouvelle validation |
|---|---|---|---|---:|---:|
| Sales stats | `GET /api/dashboard-analytics/sales` | `status=vente`; ancien `published=statusAdmin Validée`, corrigé avec `isPublished=true`, disponible, Altimmo | aucun | compteur oui, à tort | oui |
| Sales list | `GET /api/properties/portfolio` | publication classique complète + scope owner | `status=vente`, recherche vide | non | oui |
| Tous les biens | même portfolio | quatre sources publiées/éligibles dédupliquées | recherche vide | non | oui |
| Catalogue public | `GET /api/properties` | Validée + `isPublished=true` + Disponible + Altimmo | filtres de recherche seulement | non | oui |
| Home latest | `GET /api/properties/latest?pole=Altimmo&limit=5` | même recherche publique, tri `-createdAt`, limite serveur 5 | aucun filtre Altimmo additionnel | non | oui si dans les cinq plus récents |

« Tous les biens » signifie dans son contrat actuel « portefeuille publiable et dédupliqué des quatre sources métier », non l'ensemble des documents brouillon/interne. Son libellé UX est large mais son exclusion des biens privés est intentionnelle.

Le dashboard Patrimoine (`GET /api/property-asset/portfolio/dashboard`) est une projection différente : il agrège tous les actifs accessibles et expliquait les 80 000 000 FCFA/Parcelle même lorsque l'annonce publique était absente.
