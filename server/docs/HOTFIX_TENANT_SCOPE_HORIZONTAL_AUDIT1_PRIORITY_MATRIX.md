# Matrice de priorité

| Finding | Severity | Data sensitivity | Exploitability | Blast radius | Recommended action |
|---|---|---|---|---|---|
| HZ-01 Accommodation lifecycle | P0 | finance + disponibilité + séjour | directe par ObjectId | toutes réservations | hotfix immédiat dédié |
| HZ-02 Accommodation calendar | P0 | planning, invités, montants | directe par accommodationId | tous hébergements | inclure dans characterization du même domaine |
| HZ-05 HotelReservation lists | P0 | identité/séjour/finance indirecte | simple GET | toutes réservations hôtels | hotfix suivant séparé |
| HZ-04 Accommodation lists | P0 | catalogue privé/tarifs/owners | simple GET | tous hébergements | hotfix collection scope |
| HZ-06 Hotel lists | P0 | inventaire privé | simple GET | tous hôtels | hotfix collection scope |
| HZ-07 Property lists | P0 | annonces privées/prix/owners | simple GET | toutes propriétés | hotfix collection scope |
| HZ-03 staff sans tenant | P0 | réservations | simple GET | plateforme | fail-closed dans hotfix HZ-01 |
| HZ-08 attribution legacy | P2 | variable | dépend des données | historique | design/regularization |
| HZ-09 drift inline | P2 | transversal | indirecte | futur | adoption progressive canonical resolver |

Ces findings de sécurité passent avant les deux edges service→controller, `runPropertySearch`, Estimation, routes mortes et catalogue.
