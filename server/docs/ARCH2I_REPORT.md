# ARCH-2I — Rapport final

## Verdict

**ARCH-2I — AUDIT CERTIFIÉ. ROUTE→MODEL CLEANUP SHOULD STOP HERE.**

La seule dette applicative vivante restante, Estimation, n'est pas un quick win. Les edges Projet et Realisation appartiennent à des routes non montées ; Projet est en plus non chargeable faute de modèle. Les neuf autres edges sont des frontières de sécurité protégées. La priorité bascule vers une caractérisation read-only du reporting immobilier service→controller.

## Protected security edges

Les 9 edges de `ARCH2I_KEEP_MATRIX.md` existent toujours, n'ont pas dérivé et n'ont pas été réauditées/refactorées.

## Réponses obligatoires

1. **Quel est HEAD ?** `a04055f62952c782b92aeef2f100824a17a5f645`.
2. **Quelle branche ?** `main`.
3. **Worktree initial ?** Sale avec de nombreux changements préexistants, tous préservés.
4. **route→model réel ?** 12 edges sur 11 routes.
5. **Bien à 12 ?** Oui.
6. **service→controller ?** 4.
7. **controller→controller ?** 1.
8. **cycles ?** 0.
9. **stale ?** 0.
10. **new violations ?** 0.
11. **Deux dettes restantes ?** Estimation→Estimation et Realisation→Realisation selon ARCH-2G ; HEAD reclassifie la seconde route morte.
12. **Edge legacy ?** projetsRoutes→Projet.
13. **Trois edges encore présentes ?** Oui statiquement.
14. **Routes files ?** `estimationRoutes.js`, `realisationsRoutes.js`, `projetsRoutes.js`.
15. **Models ?** Estimation, Realisation, Projet ; le fichier Projet est absent.
16. **Endpoints ?** Estimation POST/GET `/`; Realisation 5 CRUD ; Projet 4 CRUD.
17. **Usages A ?** Deux handlers, quatre appels Mongoose fonctionnels.
18. **Candidate B ?** Cinq handlers/usages CRUD.
19. **Legacy ?** Quatre handlers/usages CRUD.
20. **A read-only ?** Non.
21. **B read-only ?** Non dans le code, mais inactive.
22. **Legacy read-only ?** Non dans le code, mais inactive.
23. **Mutations ?** Estimation create/updateMany ; CRUD Realisation/Projet dans routes mortes.
24. **Side effects ?** Estimation DB, Cloudinary, email, notification, logs ; legacy DB théorique seulement.
25. **A touche auth ?** Oui, optionalAuth et staffOnly.
26. **Tenant ?** Non.
27. **Ownership ?** Non.
28. **PlatformOperator ?** Non.
29. **B touche auth ?** Non, aucun middleware et route non montée.
30. **Tenant ?** Non.
31. **Ownership ?** Non.
32. **PlatformOperator ?** Non.
33. **Legacy frontière sécurité ?** Non active ; absence d'auth dangereuse si restauration.
34. **Classification A valide ?** Oui, dette applicative vivante.
35. **Classification B valide ?** Non comme dette runtime ; c'est une `DEAD_ROUTE`.
36. **Pourquoi ?** Aucun montage, consumer ou test ; le code CRUD n'est pas exposé.
37. **Route legacy montée ?** Non.
38. **Endpoint legacy accessible ?** Non.
39. **Consumers backend ?** Aucun.
40. **Consumers frontend ?** Aucun attribuable à cette route ; les flux Altcom utilisent une autre API.
41. **Consumers mobile ?** Aucun.
42. **Tests legacy ?** Aucun.
43. **Import legacy utilisé ?** Oui dans le fichier, mais le module cible manque et le routeur n'est jamais chargé.
44. **Edge legacy code vivant ?** Non.
45. **Code mort ?** Oui, route morte.
46. **Faux positif ?** Non, l'import statique existe réellement.
47. **Security boundary ?** Non.
48. **Application debt ?** Non vivante ; dette de lifecycle/dead code.
49. **Classification finale legacy ?** `DEAD_ROUTE`.
50. **Preuve ?** Aucun `require/app.use`, modèle absent, aucun consumer/test.
51. **A touche Finance ?** Non.
52. **B ?** Non.
53. **Legacy ?** Non.
54. **Hôtel ?** Non pour les trois.
55. **Property ?** Estimation/valuation oui ; les autres non confirmés métier.
56. **Gestion locative ?** Non.
57. **Documents ?** Uploads Estimation oui ; aucun PDF dans l'edge inline.
58. **Messaging ?** Non.
59. **Notifications ?** Estimation oui.
60. **Socket.IO ?** Non.
61. **Cloudinary ?** Estimation oui.
62. **CRM ?** Estimation a une finalité commerciale, sans appel CRM direct.
63. **Blast radius le plus faible ?** Projet/Realisation au runtime car non montés.
64. **Meilleure cohésion ?** Realisation CRUD, mais sur route morte.
65. **Meilleure testabilité ?** Estimation dispose du plus de preuves existantes, mais sa caractérisation complète reste difficile.
66. **Plus faible security risk ?** Les routes mortes au runtime ; Estimation reste MEDIUM.
67. **Plus faible business risk ?** Retrait futur Projet après audit historique ; aucun refactor applicatif recommandé.
68. **Service canonique A ?** Des services de normalisation/valuation existent, pas d'owner submission+inbox canonique.
69. **Pour B ?** Non.
70. **Pour legacy ?** Non.
71. **Nouvelle abstraction nécessaire ?** Oui pour Estimation ; inutile pour du dead code.
72. **Serait-elle étroite ?** Deux owners ciblés seraient nécessaires, pas une façade unique.
73. **Risque God Service ?** Élevé si tout Estimation est regroupé.
74. **Tests A ?** Multipart/honeypot, upload privé, normalisation, create, providers, pagination, mark-viewed, auth et erreurs.
75. **B ?** Montage actuel, décision données, puis CRUD/auth complet seulement si restauration.
76. **Legacy ?** Preuves non-montage/module absent ; tests CRUD uniquement après décision de reconstruction.
77. **Mongo ciblé A ?** Oui.
78. **B ?** Oui seulement si restaurée ; inventaire read-only des données avant retrait.
79. **Tenant tests ?** Non pour A actuel ; requis si B/legacy sont redessinées tenant-scoped.
80. **Ownership tests ?** Même réponse.
81. **PlatformOperator tests ?** Non actuellement ; requis seulement si nouveau contrat le prévoit.
82. **Gain A ?** 12→11.
83. **Gain B ?** 12→11.
84. **Gain legacy ?** 12→11.
85. **Meilleur ratio gain/risque ?** Aucun candidat d'extraction route→model.
86. **Pourquoi ?** A est transverse/high-risk ; B et legacy doivent être retirées ou redessinées, pas encapsulées.
87. **Encore réduire route→model ?** Non comme campagne mécanique.
88. **Pourquoi ?** Le compteur restant mélange guards légitimes, dette complexe et dead code.
89. **9 security edges restent ?** Oui.
90. **Une a dérivé ?** Non selon imports/baseline HEAD.
91. **Formaliser comme exceptions ?** Oui, ultérieurement après validation formelle.
92. **4 service→controller plus prioritaires ?** Oui, comme dette active read-only à traiter progressivement.
93. **Pourquoi ?** Elles inversent une frontière active et peuvent être découpées par domaine sans effets provider.
94. **runPropertySearch plus prioritaire ?** Non que le premier reporting ciblé.
95. **Pourquoi ?** Prédicats publics, deux collections, pagination et contextes staff divergents augmentent le risque.
96. **Chantier suivant ?** ARCH-2J — Immobilier Report Query Boundary Assessment/Characterization.
97. **Scope exact ?** `immobilierReport.js → dashboardAnalyticsController.js`, preuves owner/KPI uniquement.
98. **Objectif quantitatif ?** Préparer une extraction service→controller 4→3 ; route→model reste 12.
99. **Code production modifié ?** Non.
100. **Baseline modifiée ?** Non.
101. **Tests métier modifiés ?** Non.
102. **Frontend modifié ?** Non par ARCH-2I.
103. **Mobile modifié ?** Non par ARCH-2I.
104. **Mongo muté ?** Non.
105. **Commit ?** NON.
106. **Push ?** NON.
107. **Deploy ?** NON.
108. **architecture:check PASS ?** Oui : 4/1/12, cycles 0, violations 0.
109. **git diff --check ?** Exit 0 ; trois avertissements CRLF préexistants uniquement.
110. **Verdict final ?** ARCH-2I — AUDIT CERTIFIÉ ; arrêt du nettoyage route→model.

## Décision

Prochaine priorité : caractériser la query immobilière du reporting avant toute extraction. Aucun ARCH-2J n'a été exécuté.
