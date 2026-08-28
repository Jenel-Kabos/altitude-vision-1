# SECURITY-CLOSURE-P0-WAVE-1 — Baseline

- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`
- Branche : `main`
- Worktree : 630 lignes (`git status --short`) — croissance attendue depuis la baseline du re-audit (616 → 630, correspondant aux 14 documents `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_*` créés par le mandat précédent).
- `git diff --stat` : 67 fichiers modifiés au global (préexistant), inchangé dans sa composition avant toute intervention de ce sprint.
- `git diff --check` : 4 avertissements CRLF pré-existants et inchangés (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js`).
- Architecture initiale : 473 fichiers, 1535 edges, `controller→controller`=1, `service→controller`=2, 0 cycle, 0 unresolved, 0 nouvelle violation, PASS — identique à la baseline du re-audit précédent (aucun code modifié entre-temps).

## Rappel du changement de stratégie

Ce sprint ferme les 5 P0 confirmés par `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` en une vague contrôlée (RED → fix minimal → tests ciblés par lot), sans relancer un audit horizontal général et sans exécuter les gates lourds (backend complet, Mongo exhaustif) après chaque lot — seulement une fois, à la fin des 5 lots. Le worktree existant n'est pas nettoyé.

## Les 5 P0 à fermer (source : `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_DECISION.md`/`_FINDING_MATRIX.md`)

| Lot | ID | Surface |
|---|---|---|
| P0-A | RA-01 | `POST /api/messages` (`sendMessage`) |
| P0-B | RA-02 | `GET /api/paiements`, `/stats`, `/alertes` |
| P0-C | RA-03 | `POST /api/paiements/encaisser-multiple` |
| P0-D | RA-05 | `rentalLeaseLifecycleController.*` |
| P0-E | RA-09 | `adminController.js` `/api/admin/properties*` |
