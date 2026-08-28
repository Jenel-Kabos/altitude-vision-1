# ARCH-2E — Rapport de certification

## Verdict

**ARCH-2E — AUDIT CERTIFIÉ.**

**NEXT ARCHITECTURAL PRIORITY = ARCH-2F — Dashboard KPI Route Boundary.** Le programme route→model doit avancer par cluster ; le pilote dashboard offre le meilleur ratio gain/risque. Aucun refactor n'a été commencé.

## Réponses obligatoires

1. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`.
2. Branche : `main`.
3. Worktree non propre, changements antérieurs préservés.
4. Oui, service→controller = 4.
5. Oui, controller→controller = 1.
6. Oui, route→model = 17.
7. Oui, cycles = 0.
8. Oui, stale = 0.
9. Oui, nouvelles violations = 0.
10. Quatre DomainReports (`accommodation`, `hotel`, `immobilier`, `location`) vers `dashboardAnalyticsController`.
11. Sources exactes : `services/reporting/domains/{accommodationReport,hotelReport,immobilierReport,locationReport}.js`.
12. Cible unique : `controllers/dashboardAnalyticsController.js`.
13. Symboles : `accommodations`, `hotels`, `sales`, `rentals`.
14. Quatre agrégats KPI propres à leurs domaines.
15. Cluster technique unique, responsabilités métier multiples.
16. Même destination reporting mais scopes, collections et règles distincts.
17. Lecture uniquement.
18. Aucun side effect hors requêtes et calculs.
19. Oui, nombreuses lectures Mongo.
20. Oui pour Accommodation/Hotel et scopes indirects.
21. Pas dans toutes ; Hotel dépend du rôle/scope accessible.
22. `scopeUserIds` filtre sales/rentals ; pas de mutation ownership.
23. Indirect via acteur/tenant Hotel.
24. Oui, KPI transactions/paiements/documents/allocation/refunds.
25. Non.
26. `reportingService` et DomainReports existent, mais pas les query owners.
27. Oui, si les quatre implémentations sont réunies dans un seul service.
28. Coût 4/5.
29. Risque 4/5.
30. Gain 4/5, mais pas au meilleur ratio.
31. Oui, 17 edges toujours présentes.
32. 13 fichiers route.
33. 14 modèles/cibles nominales distinctes, avec Contrat/Paiement/User répétés ; `Projet` absent.
34. 13 edges read-only.
35. 4 edges dans des routes qui écrivent.
36. 9 participent à auth/autorisation/tenant au sens large.
37. 9 sont liées à une frontière tenant/ressource.
38. Au moins 4 contiennent une dimension ownership/self explicite ou indirecte.
39. Les workflows Devis/Estimation/Projet/Réalisation font validation inline ; guards valident aussi les IDs.
40. 8 edges exposent de la logique applicative inline.
41. 8 réellement problématiques architecturalement.
42. 9 potentiellement acceptables comme lookups de middleware spécialisés.
43. Dashboard KPI (4), formulaires/workflows (2), contenu legacy CRUD (2), guards sécurité (9).
44. Dashboard KPI.
45. 4 edges.
46. Risque pilote 1/5.
47. Coût pilote 2/5.
48. Testabilité 4/5 après ajout de caractérisation API.
49. 18 endpoints dans `propertyRoutes`; 33 sur les cinq routeurs Property nommés.
50. 7 controllers nommés, 9 avec Accommodation/Hotel composites.
51. Environ 16 services nommés Property, davantage avec transversaux.
52. Surtout `propertyController` (1199 lignes), puis Hotel/Accommodation/sale/rental selon workflow.
53. Prédicats de visibilité et guards ownership sont répétés conceptuellement ; les mappings input ont été centralisés. Ne pas confondre similitude avec règle identique.
54. Partiellement : inputs centralisés, orchestrations spécialisées distribuées.
55. Partiellement : filtre canonique service, query encore controller, Accommodation séparée.
56. Non, volontairement distincte par Property/Accommodation/Hotel.
57. Primitives cohérentes, usages distribués ; aucune équivalence globale démontrée.
58. Même constat pour ownership.
59. Ils partagent désormais certains contrats backend, pas un workflow universel.
60. Non pour une façade globale maintenant.
61. Risque de God Service et divergence entre sous-domaines supérieur au gain immédiat.
62. Plus tard : une orchestration par use case, par exemple query search uniquement.
63. Très élevé, 5/5.
64. Très transversal, 5/5.
65. Coût 5/5.
66. Gain théorique 5/5, ratio faible.
67. `controllers/propertyController.js`.
68. `altimmoSearchController` et appel interne `getAllProperties`.
69. Partager la même query sans duplication.
70. `{ query, isAdmin }`.
71. `{ properties, total }`.
72. Property find/count et Accommodation conditionnelle.
73. Disponible + Validée + publiée + Altimmo ; hébergement `publicationStatus=publie`.
74. Filtrés via nomenclature canonique/legacy.
75. Aucun filtre tenant direct.
76. Aucun filtre owner direct.
77. Non direct.
78. `isAdmin` gouverne la vue staff, calculé par les callers.
79. Log seulement.
80. Publication critique, deux collections, pagination et contexte staff divergents.
81. Oui, confirmée dans le code actuel.
82. Query service Property Search explicite.
83. Moyen-élevé, 4/5.
84. Non ; pertinentes mais matrice public/staff/pagination à compléter.
85. Non.
86. Plus grand gain théorique : Property globale.
87. Plus faible risque : pilote dashboard.
88. Meilleur ratio : pilote dashboard route→model.
89. Plus facile à caractériser : dashboard.
90. Plus transversal : Property, puis Reporting.
91. Plus dangereux : Property globale.
92. Éviter maintenant : Property Facade globale et migration des guards sécurité.
93. Traiter maintenant : dashboard KPI route boundary.
94. Quatre edges locales, read-only, sans sécurité métier complexe.
95. ARCH-2F — Dashboard KPI Route Boundary.
96. Uniquement `/api/dashboard/stats`, ses quatre modèles directs et `userKpiService`; auth/HTTP restent dans la route.
97. route→model 17→13 ; autres compteurs stables, cycles/new/stale 0.
98. Statut/payload/compteurs/erreur 500/auth/rôles strictement identiques.
99. Caractérisation API avant, unitaires query, tests route auth, backend complet, checker, lint, diff-check ; Mongo ciblé si les vraies collections sont utilisées.
100. Réévaluer Devis/Réalisation versus maintien des guards tenant ; ne pas lancer automatiquement Reporting ou Property.

## Gates read-only

- `architecture:check` : PASS.
- Aucun code production, test ou baseline ARCH-2E modifié.
- Seuls les dix documents ARCH-2E ont été créés.
- Aucun commit, push ou déploiement.
