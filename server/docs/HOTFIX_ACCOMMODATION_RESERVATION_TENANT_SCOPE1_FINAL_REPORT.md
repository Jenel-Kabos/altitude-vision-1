# HOTFIX-ACCOMMODATION-RESERVATION-TENANT-SCOPE-1 — Certification finale

## Verdict

**CERTIFIÉ VERT — réserve Mongo levée le 2026-08-25.**

La dépendance d'ordre ARCH-2L a été reproduite puis corrigée uniquement dans sa fixture/test : `RentalManagement.property_1` était matérialisé par une suite antérieure alors que la fixture insérait deux dossiers pour le même bien. Le premier Mongo exhaustif post-fix passe 102/102 suites et 1026/1026 tests. Les gates AccommodationReservation ont été rejoués : tenant 25/25, lifecycle/finance 14/14, backend 141/141 suites et 1566/1566 tests, checker 7/7, architecture PASS, lint 0 erreur. Le code du hotfix AccommodationReservation n'a pas changé pendant cette levée de réserve.

## Verdict historique avant fermeture du flake

Le hotfix lui-même est démontré fonctionnel et sans régression connue : isolation tenant, PlatformOperator, ownership, side effects et backend complet sont verts. La certification stricte n'est néanmoins pas permise car le run Mongo exhaustif officiel termine avec 3 échecs sur 1026 tests. Ces échecs sont classés `FLAKE/ORDER-DEPENDENT HORS SCOPE` dans une fixture ARCH-2L ; son rerun isolé est 6/6. Le mandat exige explicitement un Mongo exhaustif vert, donc l'anomalie ne peut pas être masquée.

> Pre-patch runtime red archive was not available. The initial vulnerability was established statically by the horizontal tenant-scope audit; post-fix runtime adversarial isolation and global backend non-regression are demonstrated. Global Mongo non-regression is not fully green because of one unrelated order-dependent suite.

## Réponses obligatoires 1–105

1–5. HEAD `a04055f62952c782b92aeef2f100824a17a5f645`, branche `main`, worktree initial fortement dirty et préservé. Patch présent dans tenantContext middleware, routes, controller et service AccommodationReservation.

6–20. Oui, confirm/cancel/check-in/check-out/no-show sont scoped. A→A et B→B = 200 ; A→B et B→A = 404, zéro mutation/effet. Staff sans tenant = 403 confirmé.

21–30. PlatformOperator global = A+B autorisés ; scoped A/B isolés. Proprietaire concerné par cancel et ownership intact (own 200, tiers 403). Pre-patch static proof = HZ-01 : route→findById→role-only canManage→mutation/facture. Archive rouge runtime = NON ; absence documentée ; aucune fausse archive.

31–47. Runtime post-patch prouvé par 25 tests. Confirm refusé : zéro facture/FinancialDocument/Payment/Allocation/Ledger/lock/notification. Les quatre autres refus : zéro effet correspondant. Les cinq chemins same-tenant conservent leur transition historique.

48–53. Lifecycle/finance 14/14 ; Mongo ciblé final 25/25.

54–58. Backend complet non-Mongo : 141 suites, 1566 tests, 0 échec. Le premier lancement n'était pas un run métier (EPERM sandbox) ; le run autorisé est vert.

59–65. Mongo exhaustif : 102 suites, 1026 tests ; 1 suite/3 tests en échec, 101 suites/1023 tests verts. Rerun isolé : 6/6. Classification : flake/order-dependence hors scope ARCH-2L liée à l'index unique `RentalManagement.property`, pas au hotfix. Conclusion : gate exhaustif non totalement vert.

66–77. Checker 7/7 ; architecture PASS : service→controller 2, controller→controller 1, route→model 12, cycles 0, stale connu 0 (dangling metric 3), unresolved 0, violations 0. Lint 0 erreur/108 warnings. Diff-check vert hors trois CRLF connus.

78–91. Frontend, mobile, schéma, migration et production non modifiés. Aucun commit/push/deploy. Aucun autre P0 touché, aucune nouvelle règle métier ; lifecycle, finance, availability et politique tenant hors bug inchangés.

92–105. Preuve statique initiale suffisante pour établir le finding sans inventer le rouge. Preuves runtime et side effects suffisantes pour le patch. Gates globaux insuffisants pour la certification stricte à cause du Mongo exhaustif. Aucune voie cross-tenant connue sur les cinq mutations. Réserve backend levée ; réserve Mongo non levée. L'absence du rouge historique n'est plus le blocker : elle est compensée honnêtement. Sévérité finale du finding : P0 corrigé, certification globale en attente. Prochain P0 recommandé : calendrier/blocages Accommodation (sensitive write), sans l'exécuter. Verdict final : **GO SOUS RÉSERVE — NON CERTIFIÉ VERT**.

## Actions interdites respectées

Aucun changement de code production pendant la certification, aucune mutation production, aucun email/webhook/Cloudinary réel, aucun commit, push ou déploiement.
