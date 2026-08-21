# MONGO-EXHAUSTIVE-LAST-FAILURE-1 — Rapport final

## Verdict

**GO SOUS RÉSERVES — runner courant vert, ancien exit 1 non expliqué car non reproduit.**

## Réponses obligatoires

1. `npm run test:mongo`, soit `node scripts/run-mongo-tests.js` avec Jest `--runInBand --detectOpenHandles --verbose` et filtre Mongo/replica.
2. Aucune dans le run capturé ; l'ancienne suite fautive est NON CONFIRMÉE.
3. NON CONFIRMÉ.
4. NON CONFIRMÉE.
5. NON CONFIRMÉ.
6. Sans objet : aucun test fautif identifié.
7. Sans objet.
8. NON CONFIRMÉ.
9. Aucune contamination de documents observée dans le run vert.
10. Aucune contamination d'index observée ; Litige est vert avec son index partiel.
11. NON CONFIRMÉE pour l'ancien run ; aucune manifestation actuelle.
12. NON CONFIRMÉ pour l'ancien run.
13. NON CONFIRMÉ pour l'ancien run.
14. Non dans le run capturé.
15. Non fatal dans le run capturé.
16. NON CONFIRMÉ.
17. NON CONFIRMÉ.
18. Aucune correction supplémentaire : aucune cause nouvelle prouvée.
19. Non.
20. Non.
21. L'absence de modification est le seul choix respectant le blast radius sans bug reproductible.
22. Oui : index/attribution verts, puis full runner vert.
23. Oui : répétitions ciblées vertes.
24. Oui : 13 suites et 133 tests PAY/Financial verts.
25. Oui : 95/95 suites et 939/939 tests, exit 0.
26. Un full run vert ; deux séquences ciblées consécutives vertes.
27. 126/126 suites, 1 449/1 449 tests verts.
28. Vert, 0 erreur et 106 avertissements préexistants.
29. Vert.
30. Oui, la réserve externe liée au runner exhaustif est levée.
31. Oui, sa seule réserve globale résiduelle était ce runner et ses gates ciblés restent verts.
32. Oui, l'index réel et le full runner sont verts.
33. Non dans le run capturé ; la cause de l'ancien exit 1 reste inconnue.
34. Trois documents de cette mission et mises à jour de rapports uniquement ; aucun code/harness.
35. Aucun add/commit/push/deploy/reset/clean.
36. GO SOUS RÉSERVES pour cette mission d'identification, car l'ancien exit 1 n'est pas expliqué ; état courant du runner certifié vert sur un full run.

## Runs

- Avant : ancien exit 1, sortie tronquée, cause NON CONFIRMÉE.
- Après/capturé : exit 0, 95/95 suites, 939/939 tests, 1 133,546 s.
- Run 2 ciblé : exit 0, 5/5 suites, 56/56 tests.
- Run 3 ciblé : exit 0, 5/5 suites, 56/56 tests.

## Gates complémentaires

- PAY-6.1 + Financial Core + F2.1/F2.2/F2.3 + providers : 13/13 suites, 133/133 tests.
- Unités serveur : 126/126 suites, 1 449/1 449 tests.
- Lint : 0 erreur, 106 avertissements.
- `git diff --check` : vert.

Les logs complets restent temporaires sous `/tmp` et ne sont pas versionnés.

## Concurrence du worktree

Pendant les longs runs, des modifications externes sont apparues dans `client/`, `altimmo-app/` et le module Inbox Pro serveur (`InternalMail`, Zoho IMAP et documents associés). Elles ne proviennent pas de cette mission, n'ont pas été modifiées ni annulées, et n'affectent pas le HEAD, resté `15506a7b113742ad266cc5977ff06164b6c04994`.
