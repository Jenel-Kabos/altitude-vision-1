# MICRO-HOTFIX-LITIGE-REFERENCE-INDEX-1 — Matrice d'index

| Source | Index | unique | sparse | partial | Observed |
|---|---|---:|---:|---|---|
| Schéma avant | `reference_1` implicite | oui | non | non | Toute absence/valeur `null` devient la même clé d'index `null` |
| Mongo test avant | `reference_1` | oui | non | non | Second Litige sans référence rejeté par `E11000`, `{ reference: null }` |
| Schéma après | `reference_1` explicite | oui | non | `{ reference: { $type: 'string' } }` | Unicité limitée aux références textuelles réelles |
| Mongo test après | `reference_1` | oui | non | `{ reference: { $type: 'string' } }` | Deux absents et deux `null` acceptés ; doublon `LIT-INDEX-001` rejeté avec code 11000 |

## Choix partial plutôt que sparse

Un index sparse ignore les champs absents, mais indexe encore une valeur explicitement `null`. Le contrat doit accepter les deux formes legacy. Le filtre `$type: 'string'` exclut explicitement absent et `null` tout en conservant l'unicité de chaque référence réelle.

## Déploiement conceptuel

Le nom `reference_1` est conservé pour exprimer le remplacement du contrat existant. Une base possédant déjà l'index simple doit faire l'objet d'une synchronisation/migration d'index contrôlée après audit des doublons textuels. Aucun index de production n'a été modifié pendant ce hotfix.
