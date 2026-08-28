# Matrice de priorité actuelle

| Finding | Live | Severity | Exploitability | Impact | Fix Complexity | Regression Risk | Priority |
|---|---|---|---|---|---|---|---|
| HZ-05 HotelReservation lists | oui, 2 GET | P0 | PROVEN_STATIC, simple GET | PII invité + séjour + prix/montants + total global | moyenne | élevée : Hotel scope, owner/guest et PO à préserver | 1 |
| HZ-07 Property lists/modération | oui, 3 GET | P0 | PROVEN_STATIC, simple GET | annonces privées + PII owner + count global | moyenne | élevée : listing public/staff et modération globale légitime à caractériser | 2 |
| HZ-06 Hotel lists | oui, 3 GET | P0 | PROVEN_STATIC, simple GET | inventaire hôtel/property privé | moyenne | élevée : manager/assignments et modération | 3 |
| HZ-08 attribution legacy | pattern vivant | P2 | dépend des données historiques | variable, potentiellement transversal | élevée + data regularization | très élevée | 4 |
| HZ-09 resolver drift | pattern vivant | P2 | indirecte/future | omission future transversale | élevée | moyenne | 5 |

Les trois P0 sont read-only, cross-tenant et montés. HZ-05 passe en premier car son blast radius couvre toutes les réservations hôtelières et expose directement identité, coordonnées, séjour et montants. HZ-07 est deuxième grâce à la PII owner et aux annonces non publiées. HZ-06 reste P0 mais sa donnée est principalement de l'inventaire privé.
