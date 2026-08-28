# HZ-05 — Matrice des requêtes

| Endpoint | Avant | Problème | Après | Count / populate / pagination |
|---|---|---|---|---|
| `/admin/list` | `query={}`, puis filtres hotel/status/search | portée globale et total global | base `{tenant:req.platformTenant}` si scoped, puis AND des filtres | `countDocuments` reçoit exactement la même query ; populate hotel/category, tri descendant, skip/limit et shape inchangés |
| `/status/pending` | `find({status:'pending'})` | pending global | `find({status:'pending', tenant:req.platformTenant})` si scoped | pas de compteur/pagination historiques ; populate et tri ascendant inchangés |

Pour le PlatformOperator global, l'absence canonique de `req.platformTenant` maintient la requête globale. Le filtre est appliqué dans Mongo et non après lecture en mémoire. Aucun paramètre client ne peut remplacer le scope serveur.
