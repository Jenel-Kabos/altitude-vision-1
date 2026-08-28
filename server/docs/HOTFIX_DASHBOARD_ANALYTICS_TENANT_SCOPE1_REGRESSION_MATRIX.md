# Matrice de non-régression

| Gate | Résultat |
|---|---|
| Reproduction avant fix | 9 rouges, fuite 888 au lieu de 111 |
| Mongo ciblé hotfix | 14/14 verts |
| Contrôleur + checker ciblés | 16/16 verts |
| Backend unitaire complet | 141 suites, 1566/1566 verts avec heap 8 GiB |
| Mongo exhaustif | 101 suites, 1001/1001 verts |
| Lint backend | 0 erreur, 108 warnings préexistants |
| Architecture checker | PASS final : 471 fichiers, 1528 edges, dette inchangée, 0 cycle/unresolved/new violation |
| Frontend/mobile | Non modifiés |
| `git diff --check` | Vert ; seulement 3 warnings CRLF préexistants |

Le premier backend complet sandboxé a rencontré EPERM sur l'ouverture de port ; la première exécution autorisée avec le heap Node par défaut a fini en OOM. La relance identique avec `NODE_OPTIONS=--max-old-space-size=8192` est entièrement verte. Ces incidents d'outillage ne révèlent aucune régression applicative.
