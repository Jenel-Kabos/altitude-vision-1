# HOTFIX-DASHBOARD-ANALYTICS-TENANT-SCOPE-1 — État initial

Audit réalisé le 2026-08-25, avant correction, sur `main` au HEAD `a04055f62952c782b92aeef2f100824a17a5f645`. Le worktree était déjà fortement modifié ; tous les changements étrangers au hotfix ont été conservés.

## Baseline architecture

| Mesure | Valeur |
|---|---:|
| Fichiers analysés | 471 |
| Edges | 1527 |
| service→controller | 2 |
| controller→controller | 1 |
| route→model | 12 dans 11 routes |
| controller→model | 192 |
| cycles | 0 |
| unresolved imports | 0 |
| dangling imports connus | 3 |
| nouvelles violations | 0 |

Le checker initial est PASS. Les deux edges service→controller certifiés par ARCH-2M et `runPropertySearch` n'ont pas été modifiés.

## État runtime rouge

Le routeur était monté mais enchaînait seulement `auth.protect` puis le contrôleur. `protect` rechargeait le User Mongo sans résoudre ni enrichir le contexte tenant. Les sentinelles Tenant A = 111 et Tenant B = 777 donnaient 888 à Admin A sur sales, rentals, accommodations et hotels. Une sélection explicite du tenant B par Admin A était ignorée et répondait 200 ; un Admin sans tenant répondait aussi 200. Le finding ARCH-2M est donc confirmé intégralement, y compris sur les agrégats financiers.

La reproduction rouge initiale comptait 9 échecs et 4 succès de contrôles périphériques. Aucun environnement ni document de production n'a été muté.
