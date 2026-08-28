# ARCH-2L — Rapport final

## Verdict

**ARCH-2L — CERTIFIÉ VERT sur son périmètre obligatoire.** La query locative read-only possède désormais un owner canonique partagé. L'edge `locationReport → dashboardAnalyticsController` est supprimée, sans changement de KPI, scope owner, tenant, PlatformOperator, IAM ou finance.

## Réponses obligatoires

1. **HEAD actuel ?** `a04055f62952c782b92aeef2f100824a17a5f645`.
2. **Branche ?** `main`.
3. **Worktree ?** Déjà fortement sale ; changements existants préservés.
4. **service→controller = 3 confirmé ?** Oui.
5. **controller→controller = 1 ?** Oui.
6. **route→model = 12 ?** Oui.
7. **cycles ?** 0.
8. **stale ?** 0.
9. **new violations ?** 0.
10. **unresolved imports ?** 0.
11. **Edge locationReport→dashboardAnalyticsController existe ?** Oui avant extraction.
12. **Quel import exact ?** `const { rentals } = require('../../../controllers/dashboardAnalyticsController')`.
13. **Quel symbole ?** `rentals`.
14. **Combien de call sites ?** Deux fonctionnels : DomainReport et table du handler Dashboard.
15. **Fonction vivante ?** Oui, routes Dashboard/Reporting montées et Reporting consommé par ERP.
16. **Read-only confirmé ?** Oui.
17. **Mutation trouvée ?** NON.
18. **Dépendance HTTP ?** NON.
19. **req utilisé ?** NON.
20. **res ?** NON.
21. **next ?** NON.
22. **Quels sont exactement les 5 Models ?** Property, RentalManagement, Contrat, Paiement, RentalMaintenanceTicket.
23. **Query Model 1 ?** Property `find(owner $in).distinct('_id')` si scope.
24. **Model 2 ?** RentalManagement aggregate management actif, disponibilité/occupation/préavis.
25. **Model 3 ?** Contrat distinct pour scope paiements puis aggregate location actif/expiration.
26. **Model 4 ?** Paiement aggregate encaissé/impayé/pénalités.
27. **Model 5 ?** RentalMaintenanceTicket count des statuts ouverts.
28. **Quels filters ?** Détaillés dans `ARCH2L_QUERY_CONTRACT.md`, inchangés.
29. **Quel owner filter exact ?** `Property.owner:{$in:scopeUserIds}`, puis Property IDs sur `property`/`bien` et Contrat IDs sur Paiement.
30. **OwnerId vient d'où ?** Reporting : scope utilisateurs OrgUnit résolu en amont ; Dashboard : aucun scope historique.
31. **Conversion ObjectId ?** Set→tableau puis `new ObjectId(String(id))`, inchangé.
32. **Owner absent ?** Scope `null`, mode global.
33. **Owner inconnu ?** Zéro Property, filtres `$in:[]`, KPI à zéro.
34. **Scope global possible ?** Oui, scope absent.
35. **Tenant impliqué ?** Indirectement en amont via tenant→OrgUnit→scope owners ; pas dans le query service.
36. **PlatformOperator ?** Oui : non scopé produit le mode global historique ; test dédié sans scope.
37. **IAM ?** Inchangé et extérieur : auth/RBAC Dashboard et Reporting.
38. **Finance ?** Lectures Paiement seulement ; aucune écriture/formule modifiée.
39. **Quels statuses ?** managementActivated true ; disponible ; occupe ; preavis ; contrat location/actif ; paiements impayé/en_retard/partiel ; maintenance statuses canoniques ouverts.
40. **Quelles dates ?** `now` et `soon=now+30×86400000`, inclusifs sur dateFinBail.
41. **Quels calculs ?** Compteurs, somme encaissée, restant `max(total-reçu,0)`, pénalités conditionnelles.
42. **Agrégations ?** Trois pipelines `$match+$group`, plus un count.
43. **Pagination ?** Aucune.
44. **Sorting ?** Aucun.
45. **Population ?** Aucune.
46. **Projections ?** `distinct('_id')` seulement.
47. **Queries séquentielles ou parallèles ?** Property puis Contrat séquentielles ; quatre opérations en Promise.all.
48. **Ordre conservé ?** Oui, textuellement.
49. **Side effects ?** Aucun hors lectures Mongo.
50. **Email ?** NON.
51. **Notifications ?** NON.
52. **Socket.IO ?** NON.
53. **Cloudinary ?** NON.
54. **Webhook ?** NON.
55. **Financial writes ?** NON.
56. **Contrat before caractérisé ?** Oui, avant production.
57. **Combien de tests ?** 27/27 avant : 5 query Mongo, 9 Dashboard, 13 Reporting.
58. **Owner A testé ?** Oui, complet.
59. **Owner B ?** Oui comme contamination et dans union multi-owner.
60. **Cross-owner ?** Oui, absence de fuite prouvée.
61. **Empty data ?** Oui, forme exacte à zéro.
62. **Partial data ?** Oui, RentalManagement seul et fallbacks.
63. **DB errors ?** Oui, erreur Property identique propagée.
64. **Query contract identique après ?** Oui.
65. **Owner scope identique ?** Oui.
66. **Tenant identique ?** Oui.
67. **PlatformOperator identique ?** Oui, global sans scope.
68. **KPI identiques ?** Oui.
69. **Formules identiques ?** Oui.
70. **Un owner existant pouvait-il être réutilisé ?** Non sans mélanger immobilier ou reporting transversal.
71. **Lequel ?** Aucun ; `immobilierReportQueryService` a été évalué mais volontairement séparé.
72. **Nouveau query service créé ?** Oui.
73. **Pourquoi ?** Deux consumers avaient besoin de la même query non HTTP sous un owner étroit.
74. **Son nom ?** `rentalReportQueryService.js`.
75. **Sa responsabilité en une phrase ?** Fournir les agrégations read-only du rapport locatif sous un scope d'owners fourni.
76. **Risque God Service ?** Évité : un seul use case, cinq modèles, aucune permission/orchestration mutation.
77. **dashboardAnalyticsController utilise-t-il le nouvel owner ?** Oui.
78. **locationReport utilise-t-il le nouvel owner ?** Oui.
79. **locationReport importe-t-il encore le controller ?** NON.
80. **Ancien helper du controller supprimé ?** Oui, fonction et export retirés.
81. **Handler HTTP intact ?** Oui ; seul son owner de query change.
82. **Une seule source de vérité ?** Oui.
83. **Baseline edge retirée ?** Oui, uniquement Location.
84. **service→controller avant ?** 3.
85. **après ?** 2.
86. **3→2 atteint ?** Oui.
87. **controller→controller stable ?** Oui, 1.
88. **runPropertySearch intact ?** Oui.
89. **route→model stable ?** Oui, 12.
90. **cycles = 0 ?** Oui.
91. **stale = 0 ?** Oui.
92. **new violations = 0 ?** Oui.
93. **unresolved imports = 0 ?** Oui.
94. **tests ciblés ?** Oui : Dashboard/query/checker verts ; Reporting Mongo vert.
95. **Mongo ciblé ?** Oui, cross-owner/empty/partial/error/global verts.
96. **Mongo exhaustif ?** Oui : 100/100 suites et 987/987 tests verts ; replica set arrêté proprement.
97. **anomalie quittance reproduite ?** NON lors de cette campagne.
98. **Si oui, exactement identique et hors scope ?** Sans objet ; la dette connue reste indépendante et aucune correction n'a été effectuée.
99. **Quittance modifiée ?** NON.
100. **backend complet ?** Oui, 141 suites et 1 566/1 566 tests verts.
101. **checker tests ?** Oui, 7/7 verts.
102. **architecture:check ?** PASS, 2/1/12.
103. **lint ?** 0 erreur, 108 warnings préexistants après retrait de l'import devenu inutile.
104. **git diff --check ?** Vert, warnings CRLF préexistants uniquement.
105. **frontend modifié ?** NON par ARCH-2L.
106. **mobile modifié ?** NON par ARCH-2L.
107. **règle métier ajoutée ?** NON.
108. **règle métier supprimée ?** NON.
109. **owner scope modifié ?** NON.
110. **tenant modifié ?** NON.
111. **finance modifiée ?** NON.
112. **production modifiée ?** NON : aucune donnée/provider/déploiement ; code backend local extrait seulement.
113. **commit ?** NON.
114. **push ?** NON.
115. **deploy ?** NON.
116. **anomalie métier découverte ?** Le `_id:null` conditionnel historique a été observé et verrouillé, sans le modifier ; anomalie quittance déjà connue indépendante.
117. **laissée hors scope ?** Oui, toute correction de ces deux points est hors scope.
118. **combien de service→controller restent ?** 2 : Accommodation et Hotel.
119. **faut-il continuer cette catégorie après ARCH-2L ?** Pas automatiquement ; les deux edges restantes sont HIGH/CRITICAL et doivent être comparées aux autres dettes.
120. **prochaine priorité recommandée ?** Audit/hotfix dédié de l'échec Mongo quittance, avant une nouvelle extraction architecturale risquée.
121. **verdict final ?** **ARCH-2L — CERTIFIÉ VERT sur les gates obligatoires ; owner rental canonique et baseline 3→2.**

## Gates

| Gate | Résultat |
|---|---|
| Caractérisation avant | 27/27 verts |
| Query Mongo post-extraction | 6/6 verts, incluant isolation owner et global PlatformOperator |
| Reporting Mongo | 13/13 verts |
| Backend complet | 141 suites, 1 566/1 566 verts |
| Checker | 7/7 verts |
| Architecture | PASS, service→controller 3→2 |
| Lint | 0 erreur, 108 warnings préexistants |
| Mongo exhaustif recommandé | 100 suites, 987/987 verts ; anomalie quittance non reproduite |

Aucun commit, push ou déploiement n'a été effectué.
