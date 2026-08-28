# SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 — Baseline

1. HEAD initial : `a04055f62952c782b92aeef2f100824a17a5f645` — identique au HEAD communiqué par SECURITY-FINAL-CLOSURE-AUDIT-1.
2. Branche : `main`.
3. Worktree : 701 entrées `git status --short` (7 documents `SECURITY_FINAL_CLOSURE_AUDIT1_*` de plus qu'au début de la campagne, aucun code touché par ce mandat précédent).
4. `git diff --check` : 4 avertissements CRLF pré-existants uniquement (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js`), identiques à toutes les baselines précédentes.

## Architecture initiale

- Files : 473 — Edges : 1569 — cycles : 0 — unresolved : 0 — new violations : 0 — **PASS**.
- Legacy debt inchangée : service→controller 2, controller→controller 1, route→model 12/11, controller→model (progressif) 199.

## Rappel des 2 blockers à fermer (source de vérité : `SECURITY_FINAL_CLOSURE_AUDIT1_BLOCKERS.md`)

- **FCA1-01** : `POST /api/contrats` (`contratController.create`) — aucune vérification tenant sur la `Property` cible (`req.body.bien`) avant création du bail + échéancier de paiement.
- **FCA1-02** : `GET /api/real-estate-applications/reservations/:id` et `POST /api/real-estate-applications/reservations/:id/cancel` (`realEstateApplicationController.getReservation`/`cancelReservation`) — aucun appel à `assertApplicationTenantAccessIfStaff`, contrairement aux endpoints sœurs `Application` du même fichier.

Périmètre strict de ce mandat : uniquement ces deux endpoints. Hors scope : HZ-08, HZ-09, errorMiddleware, P2/P3, frontend, mobile, migrations, warnings lint, toute autre route.
