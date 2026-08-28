# SECURITY-CLOSURE-P0-WAVE-1 — Matrice finale des portes

| Porte | Résultat | Statut |
|---|---|---|
| P0-A rouge→vert | 6/13 échoués (garde retiré) → 13/13 PASS | ✅ |
| P0-B+C rouge→vert | 8/9 échoués (garde retiré) → 9/9 PASS (après correction de l'attribution tenant canonique) | ✅ |
| P0-D rouge→vert | 3/6 échoués (garde retiré) → 6/6 PASS | ✅ |
| P0-E rouge→vert | 6/7 échoués (garde retiré) → 7/7 PASS | ✅ |
| Security cluster (14 suites, nouvelles + HZ-01→07 + HF-FINAL-01 + RBAC-FINAL-01 + Message Read Authority) | 208/208 tests | ✅ PASS |
| Backend complet | 141 suites / 1579 tests — 2 flakes isolés (`hotelRoutes.test.js`, `housekeepingMaintenanceRoutes.test.js`) confirmés non-régressions par ré-exécution isolée (39/39 et 31/31 PASS) puis suite complète propre | ✅ PASS |
| **Mongo exhaustif** | **116 suites / 1212 tests, 100 % PASS** — 1 flake de timeout isolé (`dataReset1.mongo.integration.test.js`, 2397s sous charge vs 24s en isolation) confirmé non-régression, ré-exécution complète propre | ✅ PASS |
| Architecture | 473 fichiers / 1544 edges / `controller→controller`=1 (inchangé) / `route→model`=12/11 (inchangé) / 0 cycle / **0 nouvelle violation** | ✅ PASS |
| Lint | 0 erreur, 108 avertissements (identique à la baseline, après correction de 3 avertissements introduits par un test) | ✅ PASS |
| diff-check | 4 avertissements CRLF pré-existants inchangés | ✅ PASS |
| HEAD git | `a04055f62952c782b92aeef2f100824a17a5f645` inchangé | ✅ PASS |
| Tests temporaires supprimés | Aucun test temporaire créé dans ce sprint (contrairement au re-audit précédent — tous les tests de ce sprint sont permanents par nature) | ✅ CONFIRMÉ |
| Frontend/mobile/schema/migration | Aucun changement | ✅ CONFIRMÉ |
| Commit/push/deploy | Aucun | ✅ CONFIRMÉ |

## Régressions découvertes et corrigées PENDANT ce sprint (transparence totale)

1. **Architecture (P0-D)** : premier essai créait un edge `routes/rentalLeaseLifecycleRoutes.js → models/Contrat.js` non baselisé (ARCH-LAYER-003). Corrigé en déplaçant le garde `router.param` dans le contrôleur (`ctrl.assertContratTenantAccessParam`), edge `controller→model` non tracké comme violation.
2. **Test unitaire préexistant (`rentalDossiersRoutes.test.js`, P0-B)** : `Contrat.find` non mocké pour ce cas précis provoquait un 500 quand `Property.find` renvoyait un tableau vide. Corrigé par un court-circuit (`if (propertyIds.length === 0) return [];`) dans `scopedContratIdsForTenant` — optimisation légitime, pas un contournement du test.
3. **Test d'intégration préexistant (`rentalPaymentMultiEcheanceAllocation.mongo.integration.test.js`, P0-C)** : le garde de route `requireTenantScopeForStaffOrPlatformOperator` (fail-closed, pensé pour les LISTES) bloquait à tort un Contrat legacy légitimement non attribué (sans `Property` liée). Corrigé en retirant ce garde de `/encaisser-multiple` et en réutilisant directement `assertResourceTenantOrUnattributed` avec la même tolérance « non attribué » que le `router.param('id')` du même fichier — pas un fail-closed générique, une autorité sur une ressource précise.
4. **Lint** : 3 avertissements `no-unused-vars` introduits par le test P0-B/C, corrigés par préfixe `_`.

Chacune de ces corrections a été re-vérifiée par ré-exécution des suites concernées avant de poursuivre.
