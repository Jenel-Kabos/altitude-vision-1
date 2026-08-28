# Matrice runtime finale

Preuve : vrais endpoints Express, JWT, Mongo réel. `Mutation=non` signifie statut et historique inchangés.

| Actor | Target Reservation | Action | HTTP | Mutation | Side effects | Result |
|---|---|---|---:|---|---|---|
| Admin A | A | confirm | 200 | oui | historiques | PASS |
| Admin A | B | confirm | 404 | non | zéro | PASS |
| Admin B | B | confirm | 200 | oui | historiques | PASS |
| Admin B | A | confirm | 404 | non | zéro | PASS |
| Admin A | A | cancel | 200 | oui | historiques | PASS |
| Admin A | B | cancel | 404 | non | zéro | PASS |
| Admin B | B | cancel | 200 | oui | historiques | PASS |
| Admin B | A | cancel | 404 | non | zéro | PASS |
| Admin A | A | check-in | 200 | oui | historiques | PASS |
| Admin A | B | check-in | 404 | non | zéro | PASS |
| Admin B | B | check-in | 200 | oui | historiques | PASS |
| Admin B | A | check-in | 404 | non | zéro | PASS |
| Admin A | A | check-out | 200 | oui | historiques | PASS |
| Admin A | B | check-out | 404 | non | zéro | PASS |
| Admin B | B | check-out | 200 | oui | historiques | PASS |
| Admin B | A | check-out | 404 | non | zéro | PASS |
| Admin A | A | no-show | 200 | oui | historiques | PASS |
| Admin A | B | no-show | 404 | non | zéro | PASS |
| Admin B | B | no-show | 200 | oui | historiques | PASS |
| Admin B | A | no-show | 404 | non | zéro | PASS |

Staff Admin sans tenant : 403 avant lecture/mutation. Proprietaire : sa réservation annulable sans tenant ; réservation d'un tiers refusée 403. Suite finale : 25/25.

