# ARCH-2C2 — Baseline finale

| Mesure | Avant | Après | Variation |
|---|---:|---:|---:|
| Fichiers analysés | 463 | 464 | +1 serializer spécialisé |
| Arêtes internes | 1 511 | 1 513 | +2 nettes : deux controllers vers le serializer et serializer vers storage remplacent une arête controller→controller et l'ancienne dépendance directe storage du controller |
| service→controller | 6 | 6 | 0 |
| controller→controller | 9 | 8 | **−1** |
| route→model | 17 / 13 routes | 17 / 13 routes | 0 |
| controller→model progressif | 202 | 202 | 0 |
| cycles | 0 | 0 | 0 |
| baseline stale finale | 0 | 0 | 0 |
| nouvelles violations | 0 | 0 | 0 |

Après extraction et avant mise à jour, le checker a signalé exactement une entrée stale : `conversationController → messageController`. Seule cette entrée a été retirée.
