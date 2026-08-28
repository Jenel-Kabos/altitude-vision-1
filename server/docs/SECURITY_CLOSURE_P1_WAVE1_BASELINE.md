# SECURITY-CLOSURE-P1-WAVE-1 — Baseline

- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`
- Branche : `main`
- Worktree : 655 lignes (`git status --short`) — croissance attendue depuis la fin de `SECURITY-CLOSURE-P0-WAVE-1` (630 → 655 : les 15 documents `SECURITY_CLOSURE_P0_WAVE1_*` + 4 tests permanents créés par ce sprint précédent).
- `git diff --check` : 4 avertissements CRLF pré-existants et inchangés (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js`).
- Architecture initiale : 473 fichiers, 1544 edges, `controller→controller`=1, `service→controller`=2, `route→model`=12/11, `controller→model`=194, 0 cycle, 0 nouvelle violation, PASS — identique à la baseline finale de `SECURITY-CLOSURE-P0-WAVE-1`.
- Les hotfixs précédents (HZ-01→07, HF-FINAL-01, RBAC-FINAL-01, Message Read Authority, les 5 P0 de la vague précédente) sont toujours présents dans le worktree, non commités — confirmé, rien n'a été perdu.

## Rappel du changement de stratégie

Ce sprint ferme le backlog P1 figé (voir `_SOURCE_FINDINGS.md`) en une vague contrôlée, sans nouvel audit horizontal, sans gates lourds entre les lots.
