# PAY-7.1 — Matrice idempotence Yabetoo

Clés stables : `yabetoo:transaction:<transactionId>:payer:<payerId>:v1` et `yabetoo:visite:<visiteId>:payer:<payerId>:v1`. La version est l'unique génération active de ce sprint ; aucune nouvelle génération automatique après état ambigu.

| Scénario | Première requête | Deuxième requête | Appels provider | Résultat local |
|---|---|---|---|---|
| double clic | claim atomique | retourne 202 existant | 1 au plus | même opération |
| retry réseau | opération retrouvée | retourne référence/état | aucun nouvel appel CREATE | stable |
| 10 concurrents | un claim/index gagne | neuf perdent | 1 au plus | une business key |
| timeout CREATE | `create_unknown` | bloquée | aucun nouveau CREATE | reconciliation requise |
| timeout CONFIRM | ref persistée, `confirm_unknown` | bloquée | aucun nouveau CONFIRM | inquiry autorisée |
| restart | états persistés | opération retrouvée | aucune reprise aveugle | invariant conservé |
| webhook duplicate | premier événement claimé | duplicate acquitté | N/A | un effet métier |

L'idempotence provider HTTP reste **NON CONFIRMÉE** : l'exemple SDK officiel ne documente pas le nom d'un header REST, donc aucun header n'est envoyé.
