# ARCH-2D2 — Contrat comportemental

| Scenario | Before | Expected after | Sensitive dimension |
|---|---|---|---|
| Payload complet | Mapping exact des champs Property | Identique | Payload |
| Champs absents | honoraires `null`, frais `0`, compteurs `0`, tableaux vides, caution `2` | Identique | Defaults |
| Rue/catégorie | rue trimée, catégorie en minuscules | Identique | Normalisation |
| Coordonnées `0` | fallbacks Brazzaville historiques | Identique | Comportement falsy historique |
| Honoraires négatifs ou frais invalides | Error statusCode 400, message historique | Identique | Errors |
| Photos vides | Error 400 `Au moins une photo requise` | Identique | Validation/order |
| Arrondissement vide | Error 400 `Arrondissement requis` | Identique | Validation/order |

Le contrat a été exécuté contre l'export controller avant modification : 2 suites, 8/8 tests verts. Inputs : `(body, ownerId)`. Output : objet simple ou exception synchrone. Aucun side effect, DB, tenant, ownership, IAM, HTTP direct ou provider.
