# HZ-08 — Rapport final

## Verdict

**AUDIT CERTIFIÉ — DEFER.** Pattern LIVE, dette réelle dépendante des données, aucune vulnérabilité P0/P1 universelle démontrée, aucune correction autorisée ni effectuée.

## Réponses obligatoires 1–110

1. HEAD ? `a04055f62952c782b92aeef2f100824a17a5f645`.
2. Branche ? `main`.
3. Worktree initial ? Fortement dirty et préexistant, préservé.
4. Finding original exact ? Ressources historiques avec `assertResourceTenantOrUnattributed`; `unresolved` volontairement toléré; P2.
5. Pourquoi legacy ? Données antérieures à PlatformTenant, tenant/relation/membership absent.
6. Pourquoi P2 ? Risque conditionné par données + ID connu + RBAC, pas un endpoint global universel.
7. Domaine ? Transversal : GL, Property, Accommodation, messaging, documents, profils et extensions.
8. Modèle ? Plusieurs ; aucun modèle unique.
9. Champ d'attribution ? `tenant`/`platformTenant` ou preuves relationnelles selon resourceType.
10. Route ? Plusieurs familles listées dans l'entrypoint matrix.
11. Route montée ? Oui, toutes les familles LIVE citées sont montées dans `server.js`.
12. URL finale ? `/api/contrats`, `/paiements`, `/gestion-docs`, `/rental-management`, `/proprietaires`, `/locataires`, `/documents`, `/user-business-profiles`, `/properties`, `/accommodations`, `/accommodation-reservations`, `/conversations`, `/messages`, notamment.
13. Autre entrypoint ? CLI audit/régularisation et resolver de notifications.
14. Controller ? Multiples controllers inventoriés.
15. Service ? `tenantResourceAttributionService`.
16. Query/mutation ? Lookup ressource/relations, puis handler métier si autorisé.
17. Consumer frontend ? Oui, web GL/documents/profils/réservations/messagerie.
18. Consumer mobile ? Oui, profils/réservations/RentalManagement owner/messagerie.
19. Consumer job/cron ? Aucun confirmé ; CLI offline oui.
20. Tests existants ? Oui, attribution, TENANT-CERT-2, Audit2A, audit/exec regularization.
21. Path LIVE ? Oui.
22. Path DEAD ? Aucun candidat globalement dead.
23. Nouveau path canonique ? Garde stricte + champs tenant + régularisation déterministe.
24. Legacy encore nécessaire ? Oui pour compatibilité historique non régularisée.
25. Legacy read ? Oui.
26. Legacy write ? Oui sur certaines routes mutationnelles.
27. Qui déclenche ? Acteur authentifié satisfaisant le RBAC/capability, ou self-service prévu.
28. Admin ? Oui selon route.
29. Staff ? Oui selon capability.
30. Proprietaire ? Self-service sur routes prévues.
31. Client ? Participant/guest/self uniquement selon domaine.
32. PlatformOperator global ? Seulement si le garde de route l'autorise explicitement.
33. PlatformOperator scoped ? Oui, tenant sélectionné validé; unresolved reste toléré.
34. Source ID attribué ? Ressource chargée par paramètre, puis relations DB.
35. Source tenant ? Champ direct, relation, OrgMembership, ou aucun.
36. req.platformTenant utilisé ? Oui sur plusieurs consumers; ailleurs resolver avec header validé.
37. Valeur client directly trusted ? ID de cible choisi, mais tenant/assignee non persisté directement par ce helper.
38. Validation same-tenant ? Oui si attribution resolved.
39. Validation ownership ? Séparée et variable selon domaine.
40. Validation RBAC ? Oui en amont sur les paths étudiés.
41. Staff sans tenant ? Refusé par routes canonically guarded; comportement variable ailleurs.
42. Fallback global ? Pas de query globale créée; allow de la cible unresolved déjà chargée.
43. Cross-tenant statiquement possible ? Pas pour une ressource resolved; accès multi-tenant logique possible pour unresolved.
44. Cross-tenant runtime confirmé ? Resolved A→B refusé confirmé; attaque unresolved A/B dédiée NON CONFIRMÉE.
45. ObjectId B injectable depuis A ? Oui comme paramètre, mais refusé si B est resolved.
46. Attribution B possible depuis A ? Non démontrée; le helper ne réattribue rien.
47. Attribution A possible depuis B ? Non démontrée.
48. Ressource modifiée ? Possible selon endpoint unresolved; aucune mutation faite par cet audit.
49. PII exposée ? Potentiellement selon modèle; aucune nouvelle exposition runtime capturée.
50. Finance impactée ? Routes Paiement/Reservation/Documents concernées; perte financière non démontrée.
51. Notification déclenchée ? Possible sur certains handlers.
52. Email déclenché ? Possible via `/gestion-docs/envoyer`.
53. Workflow déclenché ? Possible GL/Reservation/Property.
54. Autre effet ? Documents, audit logs ou publication selon handler.
55. Exploitabilité ? `STATICALLY_EXPLOITABLE` uniquement pour une cible unresolved connue et acteur RBAC; runtime générique NON CONFIRMÉ.
56. Impact ? Autorité métier ambiguë, lecture/mutation potentiellement indue.
57. Sévérité ? P2.
58. P2 justifié ? Oui.
59. P0/P1 découvert ? Non.
60. Compatibilité historique ? Forte.
61. Données historiques ? Oui; preuve existante 376 ressources.
62. Frontend dépend legacy ? Les APIs LIVE sont utilisées; dépendance à des documents unresolved précis NON CONFIRMÉE.
63. Mobile dépend legacy ? APIs utilisées; dépendance à unresolved précis NON CONFIRMÉE.
64. API externe ? NON CONFIRMÉ.
65. Tests dépendent legacy ? Oui, contrats de compatibilité explicites.
66. Suppression safe ? Non.
67. Tenant-scope fix isolable ? Non transversalement; route par route après régularisation.
68. Service canonique ? Oui.
69. Réutilisable ? Oui pour attribution déterministe, pas pour inventer B/D/F.
70. Migration nécessaire ? Régularisation data nécessaire; migration schéma pas universellement.
71. Schema change ? Non démontré comme nécessaire.
72. Frontend change ? Non pour phase data; possible pour revue humaine future, NON CONFIRMÉ.
73. Mobile change ? Non démontré.
74. Blast radius ? Élevé et transversal.
75. Risque correction ? HIGH si modification uniforme; MEDIUM par dépréciation progressive.
76. Option A KEEP ? Rejetée comme état final.
77. Option B REMOVE ? Rejetée : code LIVE.
78. Option C TENANT-SCOPE ? Après régularisation, par consumer.
79. Option D CANONICALIZE ? Cible long terme.
80. Option E DEPRECATE ? Recommandée progressivement.
81. Option F DEFER ? Retenue.
82. Décision unique ? DEFER.
83. Pourquoi ? Dette data-dependent, compatibilité forte, fix uniforme dangereux, aucune urgence P0/P1.
84. Prochain sprint ? Oui.
85. Nom ? `HZ08-LEGACY-DATA-AUTHORITY-REGULARIZATION-1`.
86. Architecture initiale ? PASS, 472 fichiers/1 531 edges.
87. Architecture finale ? PASS, mêmes métriques.
88. Cycles ? 0.
89. Unresolved imports ? 0.
90. New violations ? 0.
91. Checker ? 7/7 vert.
92. Tests caractérisation ? Six suites Mongo existantes.
93. Résultats ? 90/90, 6/6; premier essai sandbox EPERM de setup, relance autorisée verte.
94. diff-check ? Vert, trois warnings CRLF préexistants.
95. Seuls docs HZ08 créés ? Oui pour ce mandat, onze fichiers.
96. Code production modifié ? NON.
97. Tests métier modifiés ? NON.
98. Frontend modifié ? NON.
99. Mobile modifié ? NON.
100. Schema modifié ? NON.
101. Migration ? NON.
102. Production mutée ? NON.
103. Commit ? NON.
104. Push ? NON.
105. Deploy ? NON.
106. HZ-01→HZ-07 touchés ? NON.
107. HZ-08 fermé ? Non; audit fermé, finding OPEN/DEFERRED.
108. HZ-09 ensuite ? Oui, reste ouvert.
109. Audit horizontal final ? Oui après HZ-08 data et HZ-09.
110. Verdict final ? **AUDIT CERTIFIÉ — DEFER**.

