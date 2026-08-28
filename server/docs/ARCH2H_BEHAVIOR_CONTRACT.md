# ARCH-2H — Contrat de comportement

| Scenario | Before | Expected after | Sensitive dimension |
|---|---|---|---|
| POST champ requis absent | 400, aucun effet | identique | validation/ordre |
| POST valide | create, notification, email, 201 | identique | payload/side effects |
| Email échoue | log, réponse 201 | identique | best-effort |
| Create échoue | 500, aucun provider | identique | ordre/erreur |
| GET anonyme | 401, aucune query | identique | authentication |
| GET rôle Client | 403, aucune query | identique | authorization |
| GET staff | populate, tri décroissant, 200 | identique | query/body |
| GET DB échoue | 500 | identique | erreur |
| PATCH id absent | 404, message inchangé | identique | HTTP |
| PATCH partiel | champs fournis seuls, acteur toujours affecté, save/populate, 200 | identique | mutation |

Les 10 scénarios route et 2 scénarios Mongo ont été écrits puis exécutés avant modification : 2 suites, 12/12 tests verts.
