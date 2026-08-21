# HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1 — Matrice de visibilité

| État Property | Sales | Tous les biens* | Public | Home |
|---|---:|---:|---:|---:|
| vente Validée + publiée + disponible | oui | oui | oui | oui, dans la limite 5 |
| vente En attente | non | non | non | non |
| vente Rejetée | non | non | non | non |
| brouillon (`isPublished=false`) | non | non | non | non |
| location publiée | non | oui | oui | éventuellement |
| vente retirée/vendue | selon stats métier, pas publiée | non | non | non |
| hébergement Property seul | non | non | non | non |
| hébergement spécialisé publié | non | oui | via son contrat spécialisé | éventuellement |

\* « Tous les biens » = portefeuille éligible publié, pas base documentaire exhaustive.

Prédicat public Property classique : `pole === "Altimmo" && statusAdmin === "Validée" && isPublished === true && availability === "Disponible"`, avec `status` vente/location pour le portefeuille classique. `Parcelle` et `Terrain` sont deux valeurs acceptées sans whitelist supplémentaire dans ces projections.
