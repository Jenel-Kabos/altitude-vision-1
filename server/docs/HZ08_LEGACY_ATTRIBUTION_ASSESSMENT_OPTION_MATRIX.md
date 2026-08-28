# HZ-08 — Options

| Option | Décision | Risque | Motif |
|---|---|---:|---|
| A — KEEP AS-IS | Rejetée comme état final | MEDIUM | compatibilité préservée mais dette/autorité ambiguë durable |
| B — REMOVE DEAD WRITE PATH | Non applicable globalement | HIGH | chemins LIVE et consommateurs web/mobile ; aucun dead path universel |
| C — TENANT-SCOPE legacy path | Possible seulement par ressource | HIGH | garde stricte uniforme casserait le legacy légitime |
| D — CANONICALIZE | Cible long terme | HIGH | service existant, mais B/D/F exigent données/relations/décisions humaines |
| E — DEPRECATE gradually | Recommandée après régularisation | MEDIUM | permet métriques, fermeture des writes unresolved puis reads |
| F — DEFER | **RETENUE** | LOW immédiat / MEDIUM résiduel | P2, pas de P0/P1 confirmé, programme de régularisation déjà préparé mais apply non autorisé/bloqué |

Déclencheurs de reprise : validation humaine des B, réparation des D, politique explicite des F, revalidation du manifeste A, gate Mongo global vert et autorisation séparée d'appliquer. Ensuite, remplacer la tolérance route par route, avec tests owner/RBAC/PO.

