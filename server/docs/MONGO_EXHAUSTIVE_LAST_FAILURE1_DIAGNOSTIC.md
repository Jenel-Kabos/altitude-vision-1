# MONGO-EXHAUSTIVE-LAST-FAILURE-1 — Diagnostic

## Capture complète

Commande exacte : `npm run test:mongo`, avec stdout/stderr redirigés vers `/tmp/mongo-exhaustive-run1.log` et exit code vers `/tmp/mongo-exhaustive-run1.exit`.

Résultat : exit 0, 95/95 suites et 939/939 tests, durée Jest 1 133,546 s. Le log ne contient aucune section `FAIL` ni `Summary of all failing tests`. L'unique `E11000` textuel est un rollback Financial attendu et testé, pas un échec Jest.

## Classification

L'ancien exit 1 non capturé n'a pas été reproduit. Il est donc impossible de le classer honnêtement comme assertion, hook, worker, open handle, timeout, index, contamination ou erreur Mongo. Sa cause reste **NON CONFIRMÉE**.

Le run vert prouve toutefois pour l'état courant :

- aucun worker parallèle (`--runInBand`) ;
- aucun crash worker ;
- aucun échec d'assertion ;
- aucun échec before/after hook ;
- aucun open handle fatal malgré `--detectOpenHandles` ;
- aucun conflit Litige ;
- aucun échec Conversations ou PAY-6.1.

## Stabilité proportionnée au coût

Le full run a duré près de 19 minutes. Conformément à la clause de coût, deux répétitions de la séquence historiquement sensible ont été exécutées à la place de deux autres full runs :

| Run | Suites | Tests | Exit | Durée |
|---|---:|---:|---:|---:|
| Full capturé | 95/95 | 939/939 | 0 | 1 133,546 s |
| Séquence ciblée 2 | 5/5 | 56/56 | 0 | 48,842 s |
| Séquence ciblée 3 | 5/5 | 56/56 | 0 | 46,279 s |

Séquence ciblée : index Litige, attribution legacy, Platform Admin unread, routes Conversations et staff inbox tenant.

## Conclusion

**FLAKINESS ANTÉRIEURE NON REPRODUITE.** Aucun fichier de production ni harness n'a été modifié dans cette mission, car aucune cause nouvelle n'a été démontrée. Le système courant dispose néanmoins d'un full run exhaustif réellement vert et de deux répétitions ciblées vertes.
