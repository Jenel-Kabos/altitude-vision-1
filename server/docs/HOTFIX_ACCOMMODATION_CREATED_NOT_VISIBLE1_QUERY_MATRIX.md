# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Matrice des requêtes

| Élément UI | Endpoint | Requête Mongo effective | Champ décisif | Résultat pour un `brouillon` fraîchement créé |
|---|---|---|---|---|
| KPI "Hébergements" (total) | `GET /api/dashboard/analytics/accommodations` | Agrégation `$match: independent` (aucun filtre `publicationStatus`) | — | **Compté** (`total: 1`) |
| KPI "Publiés" | `GET /api/dashboard/analytics/accommodations` | Même agrégation, `published: $sum(publicationStatus==='publie')` | `publicationStatus` | **Non compté** (`published: 0`) |
| Liste principale "Hébergements" | `GET /api/accommodations/admin/list?status=publie&validatedOnly=true&activeOnly=true&independentOnly=true` | `Accommodation.find({publicationStatus:'publie', accommodationType:{$ne:'hotel'}, hotel:null, active:{$ne:false}})` + population avec `match: {statusAdmin:'Validée'}` | `publicationStatus` | **Absent** (attendu `'publie'`, reçu `'brouillon'`) |
| "Modération Hébergements" | `GET /api/accommodations/status/pending` | `Accommodation.find({publicationStatus:'soumis', tenant})` | `publicationStatus` | **Absent** (attendu `'soumis'`, reçu `'brouillon'`) |
| "Mes hébergements" (`/mes-hebergements`, non lié à la sidebar staff) | `GET /api/accommodations/mine` | `Accommodation.find({createdBy: req.user.id})` (aucun filtre de statut) | — | **Présent**, seule surface où le brouillon apparaît avant ce hotfix |

## Divergence exacte confirmée

Toutes les requêtes ci-dessus sont **individuellement correctes** pour ce qu'elles mesurent — aucune n'a de bug de filtre, de nom de champ divergent, ni de régression tenant. La divergence est en amont : la **valeur initiale** de `publicationStatus` (`'brouillon'`, valeur par défaut du schéma, jamais changée par `createFull`) ne satisfait aucun des filtres utilisés par les deux surfaces reliées à la sidebar staff (liste principale et modération), alors que le message d'état vide de la liste principale promet explicitement une apparition dans la modération.
