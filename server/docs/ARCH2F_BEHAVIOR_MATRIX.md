# ARCH-2F — Matrice de parité comportementale

| Scenario | Before | After | Parity |
|---|---|---|---|
| DB vide | Les cinq KPI valent `0`, HTTP 200 | Identique, y compris sur Mongo réel | Oui |
| Données partielles | Chaque compteur alimente sa clé ; ordre stable | Identique | Oui |
| Propriétés présentes | `Altimmo = Property.countDocuments()` sans filtre | Identique | Oui |
| Événements présents | `MilaEvents = Event.countDocuments()` sans filtre | Identique | Oui |
| Utilisateurs présents | `Users = User.countDocuments()` sans filtre | Identique | Oui |
| Propriétaires effectifs | `Owners = getUserKpiSummary().proprietaires` | Identique | Oui |
| Portfolio publié + brouillon | Seul `{ isPublished: true }` alimente `Altcom` | Identique, prouvé sur Mongo réel | Oui |
| Une lecture rejette | HTTP 500, message et `error.message` historiques | Identique | Oui |
| Authentification/roles | `protect`, puis `restrictTo(...STAFF_ALL)` | Identique et resté dans la route | Oui |

