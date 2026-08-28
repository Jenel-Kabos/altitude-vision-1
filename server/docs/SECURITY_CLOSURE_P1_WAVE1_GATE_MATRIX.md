# SECURITY-CLOSURE-P1-WAVE-1 — Matrice finale des portes

| Porte | Résultat | Statut |
|---|---|---|
| P1-A rouge→vert | 2/3 échoués → 3/3 PASS | ✅ |
| P1-J rouge→vert | 6/6 échoués → 6/6 PASS | ✅ |
| P1-B rouge→vert | 6/7 échoués → 7/7 PASS | ✅ |
| P1-C rouge→vert | 7/8 échoués → 8/8 PASS | ✅ |
| P1-D rouge→vert | 5/6 échoués → 6/6 PASS | ✅ |
| P1-E rouge→vert | 1/2 échoué → 2/2 PASS | ✅ |
| P1-F rouge→vert | 2/5 échoués → 5/5 PASS | ✅ |
| P1-G rouge→vert | 1/3 échoué → 3/3 PASS | ✅ |
| P1-H rouge→vert | 3/4 échoués → 4/4 PASS | ✅ |
| P1-I rouge→vert | 4/7 échoués → 7/7 PASS (après correction d'une régression découverte en cours de route) | ✅ |
| Security cluster (18 suites : 10 nouvelles P1 + 4 P0 + HF-FINAL-01 + RBAC-FINAL-01 + Message Read Authority + IM-1R préexistant) | 138/138 tests | ✅ PASS |
| Backend complet | 141 suites / 1579 tests — 5 régressions unitaires découvertes et corrigées en cours de route (voir ci-dessous), puis 100 % propre | ✅ PASS |
| **Mongo exhaustif** | **126 suites / 1263 tests, 100 % PASS** — 1 régression découverte et corrigée en cours de route (`transactionCancellationReleasesReservation`), puis 100 % propre | ✅ PASS |
| Architecture | 473 fichiers / 1569 edges / `controller→controller`=1 (inchangé) / `route→model`=12/11 (inchangé) / 0 cycle / **0 nouvelle violation** | ✅ PASS |
| Lint | 0 erreur, 108 avertissements (identique à la baseline, après correction de 2 avertissements introduits par des tests) | ✅ PASS |
| diff-check | 4 avertissements CRLF pré-existants inchangés | ✅ PASS |
| HEAD git | `a04055f62952c782b92aeef2f100824a17a5f645` inchangé | ✅ PASS |
| Tests temporaires supprimés | Aucun test temporaire créé (tous les tests de ce sprint sont permanents) | ✅ CONFIRMÉ |
| Frontend/mobile/schema/migration | Aucun changement | ✅ CONFIRMÉ |
| Commit/push/deploy | Aucun | ✅ CONFIRMÉ |

## Régressions découvertes et corrigées PENDANT ce sprint (transparence totale, §47)

1. **Backend unitaire (5 fichiers)** — `rentalDossiersRoutes.test.js` (listDossiers, court-circuit manquant sur `scopedLocataireIdsForTenant` quand `propertyIds` est vide — même classe de bug que la P0-Wave), `visiteRoutes.test.js` (timeout : nouveau garde de route sans mock de résolution tenant + une assertion `toHaveBeenCalledWith()` qui encodait littéralement l'ancien comportement non filtré comme effet de bord, mise à jour pour vérifier son intention réelle : absence de filtre par source mobile/web, pas absence de tout argument), `transactionFinalizationGuard.test.js` (mock `Transaction.findById` manquant + `req.get` absent dans un appel direct au contrôleur, code rendu défensif avec `req.get?.(...)`), `salePropertyRoutes.test.js`/`rentalPropertyRoutes.test.js` (mocks de résolution tenant manquants, timeout).
2. **Mongo exhaustif (1 fichier)** — `transactionCancellationReleasesReservation.mongo.integration.test.js` : la première version du correctif P1-I appliquait un garde de route fail-closed (`requireTenantScopeForStaffOrPlatformOperator`) sur les endpoints `:id`, bloquant à tort un staff sans aucun tenant agissant sur une Transaction dont la Property est elle-même non attribuée (legacy) — exactement la même leçon que P0-C/`encaisserMultiple`. Corrigé en retirant ce garde des endpoints `:id` et en résolvant le tenant EN LIGNE dans le contrôleur (tolérant), gardant le fail-closed uniquement sur les listes.
3. **Lint (2 avertissements)** — variables `b` non utilisées dans 2 nouveaux tests, renommées `_b`.

Chacune de ces corrections a été re-vérifiée par ré-exécution des suites concernées avant de poursuivre. Aucune n'a affaibli la sécurité des 10 correctifs — chacune a soit corrigé une régression involontaire introduite par le correctif, soit complété un mock de test légitimement rendu nécessaire par l'ajout d'une vérification d'autorité réelle.
