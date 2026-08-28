# ARCH-2H — Rapport final

## Verdict

**CERTIFIÉ VERT.** L'unique edge `devisRoutes → Devis` a été remplacée par une frontière applicative étroite, sans dérive métier, HTTP ou sécurité. La cible 13→12 est atteinte.

## Réponses obligatoires

1. **Edge au départ ?** Oui, confirmée par le checker et l'import direct.
2. **Où était l'import ?** `routes/devisRoutes.js`, ligne 5 avant extraction.
3. **Endpoints ?** POST `/`, GET `/`, PATCH `/:id` sous `/api/devis`.
4. **Combien d'usages ?** Trois.
5. **Opérations Mongoose ?** `create`, `find`, `populate`, `sort`, `findById`, `save`.
6. **Lecture ?** Oui, liste et recherche par id.
7. **Écriture ?** Oui, création et mise à jour.
8. **Responsabilité réelle ?** Persistance/query et mutation applicatives.
9. **Classification ARCH-2G correcte ?** Oui.
10. **Guard sécurité impliqué ?** Non dans l'accès modèle ; les middlewares restent en route.
11. **Tenant impliqué ?** Non, aucun scope tenant dans ce flux.
12. **Ownership impliqué ?** Non.
13. **PlatformOperator impliqué ?** Non.
14. **IAM impliqué ?** Seulement l'auth/RBAC existant, inchangé en route.
15. **Finance impliquée ?** Non.
16. **Documents impliqués ?** Non.
17. **Email impliqué ?** Oui après POST, inchangé et hors service extrait.
18. **Notifications impliquées ?** Oui après POST, inchangées et hors service extrait.
19. **Side effects ?** DB, notification staff, email et logs existants.
20. **Transactions Mongo ?** Aucune dans ce flux.
21. **Tests existants avant ?** Couverture projet générale ; pas de suite route Devis dédiée identifiée.
22. **Tests ajoutés ?** 10 caractérisations route et 2 intégrations Mongo.
23. **Verts avant extraction ?** Oui, 2 suites et 12/12 tests.
24. **Abstraction existante ?** Aucune abstraction Devis canonique adaptée.
25. **Réutilisée ?** Non applicable.
26. **Abstraction créée ?** `services/devisApplicationService.js`.
27. **Pourquoi cet owner ?** L'edge couvre lecture et mutation, sans HTTP ni métier élargi.
28. **Read-only ou application service ?** Application service étroit.
29. **Reçoit-il req ?** Non.
30. **Reçoit-il res ?** Non.
31. **Reçoit-il next ?** Non.
32. **Pourquoi ?** Pour garder HTTP et middleware à la frontière route.
33. **Query/mutation identique ?** Oui, appels et affectations conservés.
34. **Filtres identiques ?** Oui ; aucun filtre n'a été ajouté ou retiré.
35. **Status Devis identique ?** Oui, affectation conditionnelle inchangée.
36. **Calculs identiques ?** Oui ; aucun calcul n'existait ou n'a été ajouté.
37. **Side effects identiques ?** Oui, ordre DB→notification→email conservé.
38. **Errors identiques ?** Oui, mêmes branches 400/404/500 et best-effort providers.
39. **Status HTTP identiques ?** Oui.
40. **Body JSON identique ?** Oui.
41. **Headers identiques ?** Oui, aucun header explicite modifié.
42. **Règle métier ajoutée ?** NON.
43. **Règle métier supprimée ?** NON.
44. **Permission modifiée ?** NON.
45. **Tenant modifié ?** NON.
46. **Ownership modifié ?** NON.
47. **Finance modifiée ?** NON.
48. **Document/PDF modifié ?** NON.
49. **Email modifié ?** NON.
50. **La route importe encore Devis ?** NON.
51. **Baseline edge supprimée ?** Oui, uniquement cette entrée.
52. **route→model avant ?** 13.
53. **Après ?** 12.
54. **13→12 atteint ?** Oui.
55. **service→controller reste 4 ?** Oui.
56. **controller→controller reste 1 ?** Oui.
57. **runPropertySearch intact ?** Oui, edge et symbole présents.
58. **9 security edges intactes ?** Oui, baseline et checker le prouvent.
59. **Legacy edge intacte ?** Oui.
60. **Autres application debts intactes ?** Oui.
61. **Cycles = 0 ?** Oui.
62. **Stale = 0 ?** Oui.
63. **New violations = 0 ?** Oui.
64. **Tests ciblés ?** 2 suites, 12/12 verts avant et après.
65. **Mongo ciblé ?** Oui, 2 scénarios réels verts.
66. **Tenant test ?** Non applicable : Devis n'est pas tenant-scoped dans le contrat actuel.
67. **Auth test ?** Oui : anonyme 401, Client 403, staff autorisé.
68. **Backend complet ?** Oui : unité complète 141 suites, 1 566 tests verts avec heap 8 Go après OOM outillage initial.
69. **Mongo exhaustif ?** Oui : 99 suites, 981 tests verts, replica set arrêté proprement.
70. **Checker tests ?** Oui : 1 suite, 7/7 verts.
71. **architecture:check ?** PASS, 469 fichiers et 1 524 edges.
72. **Lint ?** Vert, 0 erreur ; 108 warnings préexistants.
73. **git diff --check ?** Exit 0 ; trois warnings CRLF préexistants documentés.
74. **Frontend modifié ?** NON par ARCH-2H ; changements tiers préexistants préservés.
75. **Mobile modifié ?** NON par ARCH-2H ; changements tiers préexistants préservés.
76. **Production modifiée ?** NON.
77. **Commit ?** NON.
78. **Push ?** NON.
79. **Deploy ?** NON.
80. **Anomalie métier découverte ?** Non.
81. **Laissée hors scope ?** Non applicable ; aucune anomalie découverte.
82. **Prochaine dette recommandée ?** Audit de caractérisation de l'edge Estimation, candidate ARCH-2G mais plus risquée ; aucune extraction automatique.
83. **Continuer route→model ?** Seulement après une décision dédiée : protéger les 9 guards et clarifier l'edge legacy.
84. **Verdict ?** ARCH-2H — CERTIFIÉ VERT.

## Gates consolidés

| Gate | Résultat |
|---|---|
| Caractérisation avant/après | 12/12 verts |
| Backend unité complet | 141 suites, 1 566 tests verts |
| Mongo exhaustif | 99 suites, 981 tests verts |
| Checker | 7/7 verts |
| Architecture | PASS, cible 13→12 |
| Lint | 0 erreur, 108 warnings préexistants |
| Diff check | exit 0, warnings CRLF préexistants uniquement |

Aucun commit, push, déploiement, email réel, paiement réel ou mutation de production n'a été effectué.
