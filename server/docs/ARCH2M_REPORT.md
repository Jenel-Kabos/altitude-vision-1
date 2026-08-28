# ARCH-2M — Rapport final

## Verdict

**ARCH-2M — GO SOUS RÉSERVES.** La baseline et les deux edges sont certifiées, mais un **NEW BUSINESS/SECURITY FINDING** critique est démontré statiquement sur la route Dashboard Analytics. Aucun correctif n'a été tenté.

**SERVICE→CONTROLLER CLEANUP SHOULD STOP HERE.** Prochaine priorité : `HOTFIX-DASHBOARD-ANALYTICS-TENANT-SCOPE-1`.

## Facts

- HEAD `a04055f62952c782b92aeef2f100824a17a5f645`, branche `main`, worktree initial fortement sale.
- Architecture PASS : 471 fichiers, 1 527 edges, `service→controller=2`, `controller→controller=1`, `route→model=12`, cycles/stale/imports non résolus/nouvelles violations = 0.
- Les deux edges exactes sont Accommodation→`accommodations` et Hotel→`hotels`, toutes deux LIVE, read-only et sans couplage Express.
- La route `/api/dashboard-analytics` est montée et consommée ; son routeur applique `protect` seulement.
- `protect` n'injecte pas `platformTenant`. Le handler utilise pourtant ce champ pour limiter Accommodation/Hotel ; null déclenche les branches globales.
- Aucun owner canonique complet n'existe. Les owners Hotel scope/finance sont partiels et cohérents dans leur responsabilité actuelle.
- L'anomalie quittance n'a pas été reproduite dans ARCH-2L : `RESOLVED AS NON-REPRODUCIBLE / NO CURRENT BLOCKER` pour cet audit.

## Inferences

- Accommodation est le meilleur des deux candidats, mais reste HIGH : 3+ domaines, tenant, ownership et finance pour un gain 2→1.
- Hotel est CRITICAL : scope acteur/assignments, PlatformOperator, finance, mobile et contrat occupation/finance asymétrique.
- Un Admin tenant ordinaire peut potentiellement recevoir des KPI globaux cross-tenant via Dashboard Analytics. Le chemin statique est complet ; le payload adversarial réel n'a pas été exécuté.
- `runPropertySearch` n'est pas plus urgent que le finding sécurité, mais devient plus prioritaire que les deux extractions une fois ce finding traité. Les dead routes sont ensuite un cleanup lifecycle borné. Estimation reste derrière.

## Recommendations

1. Arrêter la campagne mécanique service→controller à 2.
2. Exécuter séparément `HOTFIX-DASHBOARD-ANALYTICS-TENANT-SCOPE-1`, d'abord par caractérisation adversariale, sans modifier les KPI.
3. Après fermeture du finding, prioriser un audit lifecycle Projet/Realisation ou `runPropertySearch`; ne pas rouvrir route→model.

## Non confirmé

- Une réponse HTTP cross-tenant capturée avec fixtures A/B : non exécutée dans cet audit read-only.
- Le volume et la sensibilité exacts des données de production exposables : non inspectés.
- Toute correction précise avant les tests adversariaux du hotfix : non confirmée.

## Réponses obligatoires 1–128

1. **HEAD ?** `a04055f62952c782b92aeef2f100824a17a5f645`.
2. **Branche ?** `main`.
3. **Worktree initial ?** Fortement sale, préexistant, préservé.
4. **service→controller réel ?** 2.
5. **Bien à 2 ?** Oui.
6. **controller→controller ?** 1.
7. **route→model ?** 12 sur 11 routes.
8. **cycles ?** 0.
9. **stale ?** 0.
10. **unresolved imports ?** 0.
11. **new violations ?** 0.
12. **Deux edges exactes ?** AccommodationReport→DashboardAnalyticsController `accommodations`; HotelReport→même controller `hotels`.
13. **A source ?** `services/reporting/domains/accommodationReport.js`.
14. **A target ?** `controllers/dashboardAnalyticsController.js`.
15. **A symbol ?** `accommodations`.
16. **A domain ?** Reporting/Accommodation/Property/Finance.
17. **A call sites ?** Deux fonctionnels : DomainReport et dispatch Dashboard.
18. **A runtime ?** LIVE.
19. **B source ?** `services/reporting/domains/hotelReport.js`.
20. **B target ?** `controllers/dashboardAnalyticsController.js`.
21. **B symbol ?** `hotels`.
22. **B domain ?** Reporting/Hotel/Property/Finance/IAM.
23. **B call sites ?** Deux fonctionnels : DomainReport et dispatch Dashboard.
24. **B runtime ?** LIVE.
25. **A type ?** AGGREGATION/QUERY.
26. **B type ?** SECURITY_SCOPE/AGGREGATION/QUERY.
27. **A dépend de req ?** NON.
28. **A de res ?** NON.
29. **A de next ?** NON.
30. **B dépend de req/res/next ?** NON/NON/NON.
31. **A read-only ?** Oui.
32. **B read-only ?** Oui.
33. **Mutations A ?** Aucune.
34. **Mutations B ?** Aucune.
35. **Models A ?** Accommodation, AccommodationReservation, AccommodationNightLock, FinancialDocument, PaymentAllocation, FinancialRefund ; Property via lookup.
36. **Models B ?** Hotel, Room, HotelReservation, HousekeepingTask, MaintenanceTicket, PaymentAllocation, FinancialRefund, FinancialDocument ; Property populate et HotelStaffAssignment transitif.
37. **Tenant A ?** YES, filtre fourni ; null global.
38. **Tenant B ?** YES, acteur/attribution ; Admin sans tenant global.
39. **Ownership A ?** YES, Property.owner/createdBy avant sélection.
40. **Ownership B ?** YES, manager/createdBy/Property/assignments.
41. **PlatformOperator A ?** YES, global Reporting autorisé.
42. **PlatformOperator B ?** YES, global Reporting autorisé.
43. **IAM A ?** Rôles/guards HTTP externes ; pas de capability dans la query.
44. **IAM B ?** Rôles externes, HotelStaffAssignment/listAccessibleHotels et authorization finance voisine.
45. **Finance A ?** HIGH.
46. **Finance B ?** CRITICAL sur le flux complet, HIGH dans le helper seul.
47. **Hotel A ?** NON, les hébergements liés à un hôtel sont exclus.
48. **Accommodation A ?** OUI.
49. **Property A ?** OUI.
50. **Rental A ?** NON.
51. **Reporting A ?** OUI.
52. **Domaines B ?** Hotel/Property/Finance/IAM/Reporting, 3+.
53. **Side effects A ?** Lectures Mongo seulement.
54. **Side effects B ?** Lectures Mongo/contrôles seulement.
55. **Notifications ?** NON.
56. **Emails ?** NON.
57. **Socket.IO ?** NON.
58. **Cloudinary ?** NON.
59. **Webhooks ?** NON.
60. **Financial writes ?** NON.
61. **Owner existant A ?** NON complet.
62. **Owner existant B ?** NON complet ; scope/finance partiels existants.
63. **Nouvelle abstraction A ?** Oui si extraction future.
64. **B ?** Oui si extraction future.
65. **God Service risk A ?** MEDIUM.
66. **B ?** HIGH.
67. **Cohesion A ?** HIGH pour un query owner strictement borné.
68. **B ?** MEDIUM.
69. **Blast radius A ?** HIGH.
70. **B ?** CRITICAL.
71. **Testability A ?** MEDIUM.
72. **B ?** LOW-MEDIUM.
73. **Duplication A ?** LOW, aucune implémentation exacte concurrente.
74. **B ?** LOW, mais scopes occupation/finance voisins susceptibles de drift.
75. **Tests A ?** Vide/partiel, tenant-owner A/B, publication/Property, réservations/nuits/dates, finance/refunds, erreurs, payload/HTTP.
76. **Tests B ?** Hôtel/Property/statuts, rooms/réservations/opérations, tenant/assignments/PlatformOperator, finance, hotelId, RevPAR/ADR, HTTP/mobile.
77. **Mongo ciblé A ?** Requis avant extraction.
78. **B ?** Requis avant extraction.
79. **Tenant tests A ?** Requis A/B/global.
80. **B ?** Requis A/B/global.
81. **Ownership tests A ?** Requis owner/createdBy.
82. **B ?** Requis manager/assignments.
83. **PlatformOperator A ?** Requis global/scopé.
84. **B ?** Requis global/scopé.
85. **Finance tests A ?** Requis.
86. **B ?** Requis et plus large.
87. **Plus simple ?** Accommodation.
88. **Plus risquée ?** Hotel.
89. **Mieux testée ?** Accommodation directement ; Hotel possède surtout des preuves indirectes.
90. **Plus cohésive ?** Accommodation.
91. **Moins transverse ?** Accommodation, mais toujours 3+ domaines.
92. **Meilleur gain/risque ?** Accommodation, insuffisant pour recommander.
93. **Peut-elle faire 2→1 ?** Techniquement oui.
94. **Pourquoi ?** Un query owner partagé remplacerait l'import ; ce gain ne justifie pas seul le risque.
95. **Poursuivre service→controller ?** NON.
96. **Pourquoi ?** Les deux restants sont HIGH/CRITICAL et sans quick win démontré.
97. **runPropertySearch plus prioritaire ?** Oui que ces deux edges après le finding sécurité, pas avant.
98. **Pourquoi ?** Dette unique active malgré query/publication/pagination HIGH ; gain structurel plus net après caractérisation.
99. **Estimation plus prioritaire ?** NON.
100. **Pourquoi ?** Writes, upload, notification, email et blast radius HIGH.
101. **Dead routes plus prioritaires ?** Oui que les deux extractions comme audit lifecycle, après sécurité.
102. **Pourquoi ?** Runtime faible et suppression potentiellement bornée après preuve historique/data.
103. **Route→model reste arrêté ?** OUI.
104. **Pourquoi ?** ARCH-2I reste valide ; dead routes ne rouvrent pas une campagne mécanique.
105. **Quittance bloque ?** NON, non reproduite dans ARCH-2L.
106. **Baseline modifiée ?** NON.
107. **Code production modifié ?** NON.
108. **Test métier modifié ?** NON.
109. **Frontend modifié ?** NON.
110. **Mobile modifié ?** NON.
111. **Mongo production muté ?** NON.
112. **architecture:check PASS ?** OUI.
113. **service→controller final ?** 2.
114. **controller→controller final ?** 1.
115. **route→model final ?** 12.
116. **cycles final ?** 0.
117. **git diff --check ?** Exit 0 final ; trois warnings CRLF préexistants distingués.
118. **Commit ?** NON.
119. **Push ?** NON.
120. **Deploy ?** NON.
121. **Prochain sprint exact ?** `HOTFIX-DASHBOARD-ANALYTICS-TENANT-SCOPE-1`.
122. **Target ?** Route/middleware tenant et contrat de scope de `getModuleAnalytics`.
123. **Objectif quantitatif ?** Zéro fuite A→B ; baseline architecturale stable 2/1/12.
124. **Risque ?** CRITICAL confidentialité, HIGH implémentation.
125. **Characterization ?** Matrice adversariale tenants A/B, rôles, PlatformOperator, ownership/assignments, quatre modules, finance, HTTP/Web/mobile.
126. **Non-goals ?** Aucun refactor KPI/edge, runPropertySearch, Estimation, dead route, quittance ou baseline.
127. **Arrêter cette catégorie après lui ?** OUI, la campagne service→controller reste arrêtée ; le hotfix n'appartient pas à cette catégorie.
128. **Verdict final ?** **ARCH-2M — GO SOUS RÉSERVES ; finding sécurité séparé, aucun correctif ; service→controller cleanup arrêté.**

## Gates

| Gate | Résultat |
|---|---|
| Architecture initiale | PASS, `2 / 1 / 12` |
| Checker ciblé | 1 suite, 7/7 tests verts |
| Architecture finale | PASS, compteurs inchangés `2 / 1 / 12` |
| `git diff --check` | Exit 0 ; trois warnings CRLF préexistants seulement |
| Tests métier / Mongo | Non lancés : aucune ambiguïté restante ne les justifiait |
| Code/test/baseline/frontend/mobile | Aucun changement ARCH-2M |
| Commit/push/deploy | NON / NON / NON |
