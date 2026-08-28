# HZ-09 — Rapport final

## Verdict

**AUDIT CERTIFIÉ — RECLASSIFY**

## Réponses obligatoires 1–124

1. HEAD initial : `a04055f62952c782b92aeef2f100824a17a5f645`.
2. Branche : `main`.
3. Worktree initial : fortement dirty, 65 fichiers suivis dans le diff initial ; préservé.
4. Finding exact : résolution inline des headers dans plusieurs contrôleurs/routes, créant drift et omission future.
5. Source : matrices et rapports `HOTFIX_TENANT_SCOPE_HORIZONTAL_AUDIT1_*` et `REAUDIT2_*`.
6. Classification originale : dette transversale/cross-domain, STILL_OPEN.
7. Sévérité originale : P2.
8. Pourquoi P2 : dispersion et risque indirect/futur d'omission sur une frontière tenant.
9. Domaine réel : transversal PlatformTenant, couvrant GL, immobilier, hébergement, organisation et profils.
10. Fichiers : 12 consommateurs de production listés dans la matrice de références.
11. Symboles : 15 appels directs à `resolveTenantForUser` et leurs gardes/helpers locaux.
12. Routes : paiements, profils métier, contrats, documents GL/locatifs, locataires, propriétaires, properties, accommodations, organisation, rental management et accommodation reservations.
13. Routes montées : oui, toutes.
14. URLs finales : documentées dans la matrice d'entrypoints.
15. Autres entrypoints : aucun cron/worker/queue/socket/webhook/script relié trouvé.
16. Controllers : cinq consommateurs directs, plus les contrôleurs appelés après sept route guards.
17. Service : `services/platformTenant/tenantContextService.js`.
18. Helpers : gardes locaux, middleware tenant et attribution de ressource.
19. Models : PlatformTenant/OrgMembership/OrgUnit/User et modèles métier ciblés.
20. Query/mutation finale : lectures ObjectId/listes et opérations métier variées, toujours après RBAC/ownership/garde selon route.
21. Path encore LIVE : oui.
22. Partiellement live : non ; le pattern est entièrement live, son risque est partiellement compensé par des middlewares.
23. Dead code : aucun consommateur identifié.
24. HZ-01 : a ajouté une frontière aux mutations Reservation, sans retirer les appels.
25. HZ-02 : a ajouté une frontière calendrier/blocs, sans retirer les appels.
26. HZ-03 : a borné la liste Reservation et rend un appel partiellement redondant.
27. HZ-04 : a borné les listes admin Accommodation ; autres appels inchangés.
28. HZ-05 : a borné les listes HotelReservation ; aucun appel HZ-09 supprimé.
29. HZ-06 : a borné les listes Hotel ; aucun appel HZ-09 supprimé.
30. HZ-07 : a borné la modération Property ; helpers Property subsistent.
31. Corrigé indirectement : non.
32. Frontière tenant : oui, mais validée par le service canonique.
33. Ownership : distinct et préservé ; pas la cause HZ-09.
34. RBAC : distinct et appliqué ; pas la cause HZ-09.
35. IDOR : non démontré ; ObjectId suivi d'un garde d'attribution/ownership.
36. Attribution : utilisée par la majorité des gardes ; relation avec HZ-08 séparée.
37. Fallback global : aucun créé par `resolveTenantForUser`.
38. Admin : concerné uniquement dans les permissions prévues, jamais comme preuve de tenant.
39. Staff : principal acteur des gardes inline.
40. Proprietaire : ownership/self sur certaines routes, aucun nouveau droit HZ-09.
41. Client : guest/self selon domaine, aucun nouveau droit HZ-09.
42. PlatformOperator global : resolver retourne null ; globalité uniquement via middleware explicite allow-platform-wide.
43. PlatformOperator scoped : sélection validée côté serveur.
44. Staff sans tenant : refus/absence de scope ; aucun fallback global HZ-09 démontré.
45. Source tenant : header validé, membership unique ou legacy fallback canonique.
46. `req.platformTenant` : utilisé par les middlewares/routes durcies, pas par les gardes inline eux-mêmes.
47. Tenant injecté dans query : selon domaine ; ailleurs contrôle post-load par attribution.
48. ObjectId client contrôlable : oui sur plusieurs routes.
49. Body contrôlable : oui pour mutations métier, après autorisations.
50. Query params contrôlables : oui selon listes/filtres.
51. Validation same-tenant : oui via resolver + attribution/racine/filtre.
52. Validation ownership : oui lorsque requise, séparément.
53. Validation RBAC : oui par protect/restrictTo/capabilities.
54. Fallback global : non imputable à HZ-09.
55. Fallback légitime : PlatformOperator global uniquement quand middleware explicite l'autorise ; legacy unique dans le resolver.
56. Cross-tenant statiquement possible : non par le seul pattern HZ-09.
57. Cross-tenant runtime confirmé : non.
58. Lecture indue : aucune démontrée.
59. Mutation indue : aucune démontrée.
60. Données exposées : NONE DEMONSTRATED.
61. PII : aucune exposition HZ-09 démontrée.
62. Finance : aucune exposition/écriture indue HZ-09 démontrée.
63. Messages : aucune.
64. Documents : aucune exposition indue démontrée.
65. Réservations : aucune exposition indue démontrée.
66. Effets de bord indus : aucun.
67. Notification indue : non.
68. Email indu : non.
69. Finance write indu : non.
70. Availability write indu : non.
71. Publication/status write indu : non.
72. Exploitabilité : THEORETICAL_ONLY pour sécurité ; dérive fonctionnelle fail-closed confirmée.
73. Préconditions : future divergence ou nouvel appelant contournant la validation canonique.
74. Blast radius : 12 fichiers/15 appels, plusieurs domaines ; large pour une canonicalisation.
75. Sévérité actuelle : P3 architecture/fiabilité.
76. P2 toujours correct : non comme finding sécurité.
77. Nouveau P0/P1 : non.
78. Consumer frontend : API consommée potentiellement, aucun changement requis/analysé au-delà de la surface HTTP.
79. Consumer mobile : idem.
80. Consumer job/cron : aucun trouvé.
81. Tests existants : nombreux tests tenant, adversariaux, PlatformOperator et HZ-01→07.
82. Tests exécutés : six suites ciblées.
83. Résultat exact : 6/6 suites, 130/130 tests, 0 snapshot ; 267,945 s hors sandbox.
84. Code legacy : fallback legacy borné dans le resolver ; vivant, distinct de la dispersion.
85. Mécanisme canonique : middleware `tenantContext.js` + `resolveEffectiveTenantContext`.
86. Compatibilité historique : importante pour routes self/owner, ordre Express et legacy fallback.
87. Relation HZ-08 : plusieurs appels invoquent ensuite `assertResourceTenantOrUnattributed`.
88. Dépendance unresolved : non pour classer HZ-09 ; cette tolérance appartient à HZ-08.
89. Migration nécessaire : non pour canonicaliser le code ; aucune migration de données HZ-09.
90. Schema change : non.
91. Frontend change : non attendu.
92. Mobile change : non attendu.
93. KEEP : possible techniquement, mais laisse la dette sans bonne classification.
94. HOTFIX : rejeté faute de vulnérabilité ciblée démontrée.
95. CANONICALIZE : recommandé progressivement dans un sprint architecture séparé.
96. REMOVE : rejeté, chemins vivants.
97. DEPRECATE : viable progressivement pour les helpers inline.
98. DEFER : acceptable après reclassification P3.
99. ALREADY FIXED : rejeté, 15 appels subsistent.
100. Décision unique : RECLASSIFY.
101. Pourquoi : dette réelle, mais risque sécurité P2 non démontré ; deux divergences échouent fermé.
102. Prochain sprint nécessaire : non avant l'audit sécurité final ; optionnel pour architecture/fiabilité.
103. Nom exact : `ARCH-HZ09-CANONICAL-TENANT-BOUNDARY-1`.
104. HZ-09 peut être fermé : oui dans le registre sécurité, avec transfert explicite en dette P3.
105. Audit horizontal final ensuite : oui, sans exécuter ici.
106. Architecture initiale : 472 fichiers, 1531 edges, route→model 12/11, service→controller 2, controller→controller 1, controller→model 192.
107. Architecture finale : identique, 472 fichiers, 1531 edges, route→model 12/11, service→controller 2, controller→controller 1, controller→model 192.
108. Cycles : 0 initialement et finalement.
109. Unresolved imports : 0 initialement et finalement ; dangling progressifs 3.
110. New violations : 0 initialement et finalement.
111. Checker : PASS initial et final.
112. Diff-check : code 0 initial et final, avec les mêmes trois avertissements CRLF préexistants.
113. Code production modifié : NON.
114. Tests métier modifiés : NON.
115. Frontend modifié : NON.
116. Mobile modifié : NON.
117. Schema modifié : NON.
118. Migration : NON.
119. Production mutée : NON.
120. Commit : NON.
121. Push : NON.
122. Deploy : NON.
123. Seuls documents HZ09 créés par ce mandat : OUI, exactement 12.
124. Verdict final : **AUDIT CERTIFIÉ — RECLASSIFY**.

## Synthèse

Les appels directs sont une dette de cohérence réelle. Ils n'acceptent toutefois jamais un tenant client sans validation : tous convergent vers `resolveEffectiveTenantContext`. Les deux divergences actuelles d'alias retirent une sélection légitime et provoquent un refus, elles n'élargissent pas l'accès. HZ-09 ne doit donc plus bloquer l'audit horizontal final comme dette sécurité P2. Aucun correctif, aucune régularisation HZ-08 et aucun audit final n'ont été lancés.
