# VALIDATION-HOTEL-DUPLICATE-NAME-GUARD-MONGO-FINAL-1 — Rapport final

## Verdict

**VERDICT A — FULL MONGO CERTIFIED GREEN.**

Le hotfix anti-doublon hôtel est certifié sur le gate Mongo canonique : **131 suites sur 131** et **1 310 tests sur 1 310** passent, sans échec ni test ignoré. Jest termine avec le code `0`, puis le replica set est arrêté proprement. Aucun code fonctionnel, modèle, index, service, contrôleur ou frontend n'a été modifié pendant cette validation.

## Baseline et protocole

- Branche : `main`.
- HEAD initial : `ad7f360c323085a4b6cd72a9a3aa422e58e96982`.
- Worktree initial : hotfix préexistant non commité conservé intégralement ; neuf fichiers suivis modifiés et trois fichiers non suivis, listés dans le rapport du hotfix.
- `git diff --check` initial : vert.
- Commande canonique : `npm run test:mongo`, depuis `server/`.
- Runner résolu : `node scripts/run-mongo-tests.js`, un `MongoMemoryReplSet` WiredTiger, Jest `--runInBand --detectOpenHandles --verbose --testPathPatterns=\.(mongo|replica)\.integration\.test\.js$`.
- Début du full run : `2026-08-29T20:04:57.240Z`.
- Aucun stash, reset, commit, push ou déploiement.

## Assainissement de l'environnement

Avant validation, un ancien Jest réellement orphelin a été identifié : parent npm PID `66371`, enfant Jest PID `66384`, commande ciblant trois suites accommodation tenant-scope, démarrée le 25 août et inactive depuis environ 3 jours et 23 heures. Les deux PID, et eux seuls, ont reçu `SIGTERM`. L'absence subséquente de ces processus a été contrôlée.

Metro Expo (PID `82792`) et Remotion Studio (PID `82368`, avec son processus esbuild) étaient actifs mais appartenaient à l'utilisateur et ont été préservés. Après nettoyage, aucun Jest, `mongod` ou mongodb-memory-server résiduel n'était actif.

État machine avant le full run : 16 CPU, charge `2.21 / 3.02 / 4.50`, environ 9,1 Gio de pages libres, 114 Gio disponibles sur disque. Aucune saturation courante n'a été démontrée. L'ancien run avait en revanche été exécuté dans un environnement contaminé par un Jest orphelin ; le full propre et les runs isolés rapides confirment un facteur environnemental, sans prouver une cause unique plus précise.

## Tests ciblés et anciennes suites timeout

Le test Mongo directement lié au hotfix, `mobileAccommodationPublicationService.mongo.integration.test.js`, passe à **29/29** en **33,668 s**. Il couvre les variantes de création, le renommage, l'approbation, la concurrence, l'isolation tenant et la création de l'index unique partiel.

| Suite | Relation hotfix | Run isolé 1 | Run isolé 2 si nécessaire | Full run | Conclusion |
|---|---|---:|---:|---:|---|
| `rentalPaymentMultiEcheanceAllocation.mongo.integration.test.js` | Hors scope, paiements locatifs | 8/8, 19,688 s | Non nécessaire | Vert | Ancien timeout non reproductible |
| `gestionLocativePaiements.mongo.integration.test.js` | Hors scope, gestion locative | 7/7, 18,468 s | Non nécessaire | Vert | Ancien timeout non reproductible |
| `hotfixUsersCount1.mongo.integration.test.js` | Hors scope, comptage utilisateurs | 7/7, 17,915 s | Non nécessaire | Vert | Ancien timeout non reproductible |
| `securityClosureP1WavePropertyAssetTransitionAuthority.mongo.integration.test.js` | Hors scope, autorité asset/property | 3/3, 18,792 s | Non nécessaire | Vert | Ancien timeout non reproductible |
| `tenantDataRegularizationExec1.mongo.integration.test.js` | Hors scope, régularisation tenant | 7/7, 19,535 s | Non nécessaire | Vert | Ancien timeout non reproductible |
| `rentalAssetOnboardingOptions.mongo.integration.test.js` | Hors scope, onboarding locatif | 2/2, 12,832 s | Non nécessaire | Vert | Ancien timeout non reproductible |

Contrôle supplémentaire de l'ancien échec non-timeout : `tenantCert3Final.adversarial.mongo.integration.test.js` passe à **12/12** en **22,106 s**, puis dans le full run.

## Matrice de certification

| Gate | Résultat |
|---|---|
| Duplicate Mongo ciblé | Vert — 29/29 |
| Create duplicate | Vert |
| Rename duplicate | Vert |
| Approval duplicate | Vert |
| Concurrent duplicate | Vert |
| Tenant isolation | Vert |
| Unique partial index | Vert |
| Suites timeout isolées | Vert — 6/6 suites, 34/34 tests |
| Full Mongo canonical | Vert — 131/131 suites, 1 310/1 310 tests |
| `git diff --check` | Vert |

## Preuve du full run canonique

```text
Test Suites: 131 passed, 131 total
Tests:       1310 passed, 1310 total
Snapshots:   0 total
Time:        1973.489 s, estimated 2186 s
Ran all test suites matching \.(mongo|replica)\.integration\.test\.js$.
[mongo-global] jest-exit=0 durationMs=1979845
[mongo-global] replica-set=stopped
```

Durée Jest : **1 973,489 s** (32 min 53,489 s). Durée mesurée par le runner : **1 979,845 s** (32 min 59,845 s), arrêt du replica set inclus jusqu'au retour final du processus.

## Réponses obligatoires

1. **Branche ?** `main`.
2. **HEAD initial ?** `ad7f360c323085a4b6cd72a9a3aa422e58e96982`.
3. **Worktree initial ?** Hotfix préexistant non commité préservé : neuf fichiers suivis modifiés et trois non suivis.
4. **diff-check initial ?** Vert.
5. **Commande Mongo canonique exacte ?** `npm run test:mongo` depuis `server/`.
6. **Combien de suites avaient timeout lors du hotfix ?** Six.
7. **Lesquelles exactement ?** Les six suites de la matrice timeout ci-dessus.
8. **Combien sont directement liées au duplicate guard ?** Zéro.
9. **Processus Node actifs avant validation ?** Oui : notamment Metro Expo, Remotion/esbuild, Codex et l'ancien npm/Jest orphelin.
10. **Jest actifs ?** Oui, un Jest ancien PID `66384` avant assainissement ; aucun après.
11. **mongod actifs ?** Aucun avant le full run propre.
12. **mongodb-memory-server actifs ?** Aucun avant le full run propre.
13. **Processus orphelin détecté ?** Oui.
14. **PID, commande, âge, raison de terminaison ?** Parent npm `66371`, enfant Jest `66384`, trois suites accommodation tenant-scope, environ 3 j 23 h ; inactif, sans enfant Mongo et étranger à la validation courante, donc terminé pour supprimer la contamination.
15. **Un processus utilisateur a-t-il été tué ?** Non ; Metro et Remotion ont été préservés. Seul le couple npm/Jest prouvé orphelin a été terminé.
16. **État CPU/mémoire avant full run ?** 16 CPU, charge `2.21 / 3.02 / 4.50`, environ 9,1 Gio libres ; aucune saturation actuelle démontrée.
17. **Tests duplicate ciblés ?** Oui, suite Mongo mobile accommodation publication.
18. **Résultat exact ?** 1 suite passée, 29 tests passés, 0 échec, 33,668 s, code 0.
19. **Chaque ancienne suite timeout passe-t-elle isolément ?** Oui, les six au premier essai.
20. **Pour chaque échec isolé : reproductible ?** Sans objet : aucun échec isolé.
21. **Une suite directement liée au hotfix échoue-t-elle ?** Non.
22. **Une suite liée aux indexes échoue-t-elle ?** Non.
23. **Une suite liée à Hotel create échoue-t-elle ?** Non.
24. **Une suite liée à rename échoue-t-elle ?** Non.
25. **Une suite liée à approval échoue-t-elle ?** Non.
26. **Concurrence toujours verte ?** Oui.
27. **Tenant isolation toujours verte ?** Oui.
28. **L'index unique partiel est-il toujours correctement créé dans les tests ?** Oui, assertion ciblée verte et full Mongo vert.
29. **Open handles détectés ?** Non ; aucun avertissement d'open handle n'a été émis malgré `--detectOpenHandles`.
30. **Shared-state suspecté ?** Oui pour l'ancien environnement contaminé ; non reproduit après nettoyage.
31. **Saturation machine démontrée ?** Non.
32. **Full Mongo canonique relancé ?** Oui, une fois sur environnement nettoyé.
33. **Nombre de suites ?** 131 passées sur 131.
34. **Nombre de tests ?** 1 310 passés sur 1 310.
35. **PASS ?** 131 suites et 1 310 tests.
36. **FAIL ?** Zéro.
37. **Skipped ?** Zéro.
38. **Exit code ?** `0` pour Jest et `0` pour la commande.
39. **Durée ?** Jest 1 973,489 s ; runner 1 979,845 s.
40. **Si échec, suites exactes ?** Sans objet : aucun échec.
41. **Ces suites passent-elles isolément ?** Oui, toutes les anciennes suites problématiques contrôlées passent isolément.
42. **Régression hotfix démontrée ?** Non.
43. **Si non, pourquoi ?** Tests ciblés complets verts, six anciens timeouts non reproductibles isolément, ancien échec adversarial vert, full canonique intégral vert.
44. **Code fonctionnel modifié ?** Non.
45. **Hotel model modifié ?** Non pendant cette validation.
46. **Index modifié ?** Non pendant cette validation.
47. **Service modifié ?** Non pendant cette validation.
48. **Controller modifié ?** Non pendant cette validation.
49. **Frontend modifié ?** Non pendant cette validation.
50. **Mongo data modifiée ?** Aucune donnée persistante ou distante ; uniquement les données éphémères du replica set de test, détruites à son arrêt.
51. **Rapport créé ?** Oui, le présent fichier.
52. **git diff --check final ?** Vert.
53. **Worktree fonctionnel identique au baseline ?** Oui ; seul ce rapport de validation est ajouté au baseline, sans modification fonctionnelle.
54. **Commit ?** Non.
55. **Push ?** Non.
56. **Deploy ?** Non.
57. **HEAD final ?** `ad7f360c323085a4b6cd72a9a3aa422e58e96982`.
58. **Verdict final ?** **VERDICT A — FULL MONGO CERTIFIED GREEN.**

## Conclusion

La réserve du full Mongo est levée. Les anciens timeouts ne sont pas reproductibles sur l'environnement assaini, aucune régression du duplicate guard n'est démontrée, et le gate Mongo canonique complet est intégralement vert.
