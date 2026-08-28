# HOTFIX-TENANT-SCOPE-HORIZONTAL-AUDIT-1 — Rapport final

## Verdict

**AUDIT CERTIFIÉ — CRITICAL FINDINGS IDENTIFIED.**

Sept findings P0 sont statiquement directement exploitables sur des routes montées. Le plus grave autorise des mutations du cycle de vie et du calendrier d'une réservation Accommodation d'un autre tenant, avec impact financier indirect. Aucun correctif n'a été appliqué.

**NEXT PRIORITY:** `HOTFIX-ACCOMMODATION-RESERVATION-TENANT-SCOPE-1`  
**SEVERITY:** P0

## Méthode et limites

Le grep runtime exhaustif a couvert routes, contrôleurs, services, middlewares, modèles et utilitaires ; les tests/docs ont été classés comme preuves, jamais comme surface runtime. Les 17 familles montées ont été auditées, avec approfondissement de 276 déclarations dans 19 routeurs sensibles sur 681 déclarations totales. Les findings P0 reposent sur une chaîne statique complète route→auth→handler→query/mutation. Aucun nouveau test ou script persistant n'a été créé et aucune preuve runtime additionnelle n'a été exécutée : les leaks runtime nouveaux restent **NON CONFIRMÉS**, sans diminuer leur exploitabilité statique directe.

## Réponses obligatoires

1. **HEAD ?** `a04055f62952c782b92aeef2f100824a17a5f645`.
2. **Branche ?** `main`.
3. **Worktree ?** Fortement dirty avant audit ; préservé.
4. **Architecture PASS ?** Oui : 471 fichiers, 1528 edges, 0 cycle/unresolved/new violation.
5. **Combien de primitives tenant différentes ?** Seize catégories opérationnelles inventoriées.
6. **Lesquelles ?** Resolver effectif/disponible/direct, scope, cinq variantes middleware, attribution stricte/tolérante, scope Hotel, ownership, headers sélecteurs.
7. **Primitive canonique ?** `tenantContextService` + factory `createRequireTenantScope`/`resolveAndAttachTenantScope`.
8. **Preuve ?** Elle valide membership, statut, sélection opérateur, attache tenant/scope/capacités et est réutilisée par les familles certifiées.
9. **Route families montées auditées ?** 17.
10. **Lesquelles ?** Property, Rental, Hotel, Accommodation, Finance, Documents, CRM, Messaging, Users, Transactions, Payments, Visits, Estimation, Devis, Dashboard, Reports, Other.
11. **Endpoints sensibles environ ?** 276 déclarations approfondies dans 19 routeurs clés ; 681 déclarations totales inventoriées.
12. **Familles avec resolver canonique ?** Dashboard, Reporting, CRM, Marketing, ERP, Documents, Rental Management/Maintenance, Users, exports/audit.
13. **Checks inline ?** Property, Accommodation, locataires/propriétaires/contrats/paiements legacy, Hotel domain guards, Messaging.
14. **Familles utilisant `req.user.platformTenant` ?** Dashboard, Hotel, Finance, Accommodation services, ERP.
15. **Directement ?** Hotel/Finance/Dashboard/ERP.
16. **Indirectement ?** Accommodation billing/reservation et reporting services.
17. **Où défini ?** `resolveAndAttachTenantScope`; certains HotelReservation copient aussi le contexte attaché après validation.
18. **Authoritative partout ?** Non ; seulement après résolution serveur. Son absence n'autorise rien par elle-même.
19. **Optional tenant filters ?** Oui.
20. **Combien ?** Au moins 24 occurrences runtime explicites recensées dans CRM, Marketing, Reporting, ERP, Dashboard, Public API et messaging.
21. **Global modes légitimes ?** Reporting exécutif, branches ERP/reporting appelées par contexte opérateur reconnu, Dashboard Analytics certifié, Public API sous clé tenant.
22. **Fail-open potentiels ?** Les listes/mutations HZ-01 à HZ-07 et les services seulement s'ils sont appelés hors garde ; les services CRM/Marketing sont correctement gardés par route.
23. **Tenant IDs client-supplied ?** Oui, headers tenant, quelques query/params métier et IDs de ressources.
24. **Lesquels ?** `X-Platform-Tenant-Id`, `X-Tenant-Id`, params tenant des routes plateforme, hotel/accommodation/property/reservation IDs.
25. **Validés ?** Headers/params tenant via resolver canonique dans les safe patterns ; les IDs de ressources HZ-01/HZ-02 atteignent la query sans validation tenant.
26. **Admin tenant-scoped sans resolver ?** Oui.
27. **Où ?** AccommodationReservation, calendrier Accommodation, listes Accommodation/Property ; Hotel/HotelReservation attachent parfois le contexte mais l'ignorent pour Admin.
28. **Modes PlatformOperator global correctement distingués ?** Oui dans Reporting et Dashboard Analytics.
29. **Où ?** `requireTenantScopeAllowPlatformWide` et `requireTenantScopeForAnalytics`.
30. **Modes PlatformOperator scoped ?** Oui.
31. **Où ?** Middleware canonique, Reporting, Dashboard, PlatformTenant, CRM/ERP/Finance après sélection.
32. **Property routes sûres ?** Actions individuelles Admin/owner renforcées par attribution ; public contract séparé.
33. **Findings Property ?** HZ-07 : pending/count et listing staff global.
34. **Rental routes sûres ?** Majoritairement : scope IDs, capabilities et router.param attribution.
35. **Findings Rental ?** Aucun P0 nouveau démontré ; attribution legacy tolérante P2 transversal.
36. **Hotel routes sûres ?** Opérations ciblées majoritairement protégées par `resolveHotelAccessScope`.
37. **Findings Hotel ?** HZ-05/HZ-06 : listes Admin/HotelReservation globales.
38. **Accommodation routes sûres ?** Actions individuelles principales possèdent une attribution tenant/ownership.
39. **Findings Accommodation ?** HZ-01 à HZ-04 : transitions, calendrier, liste reservation sans tenant, listes admin.
40. **Finance routes sûres ?** Finance Hotel majoritairement protégée par capacités + scope établissement ; paiement locatif par attribution.
41. **Findings Finance ?** Impact financier indirect HZ-01 ; aucun bypass direct supplémentaire démontré dans `/api/financial`.
42. **Documents sûrs ?** Routes principales tenant-required et attribution indirecte.
43. **Findings Documents ?** Aucun P0 ; tolérance legacy HZ-08.
44. **CRM sûr ?** Oui sur le chemin monté : staff + `requireTenantScope`, tenant passé aux services.
45. **Findings CRM ?** Aucun nouveau finding.
46. **Messaging sûr ?** Participant/ownership et attribution observés ; unread staff fail-closed.
47. **Findings Messaging ?** Pas de P0 ; diversité des gardes classée dans le drift HZ-09.
48. **Users/Admin sûr ?** Actions admin bornées par `requireTenantScope` et garde param.
49. **Findings Users ?** Aucun nouveau P0.
50. **Reporting sûr ?** Oui ; global réservé au vrai PlatformOperator.
51. **Findings Reporting ?** Aucun après le hotfix Dashboard.
52. **Nouveau P0 ?** Oui.
53. **Combien ?** Sept clusters.
54. **P1 ?** Aucun retenu : les cas sérieux sont directement exploitables statiquement, les ambiguïtés restantes sont P2.
55. **Combien ?** 0.
56. **P2 ?** Deux.
57. **Finding le plus grave ?** HZ-01.
58. **Endpoint/family exact ?** `POST /api/accommodation-reservations/:id/{confirm,cancel,check-in,check-out,no-show}`.
59. **Actor ?** Admin/Collaborateur/GestionnaireImmobilier/CommunityManager Tenant A ciblant une réservation B.
60. **Données ?** Réservation, disponibilité, locks, statut, pricing et facture indirecte.
61. **Finance impliquée ?** Oui, confirmation appelle `ensureAccommodationInvoice`.
62. **Mutation ou lecture ?** Mutation, plus effets financiers/notification/audit.
63. **Runtime leak prouvée ?** NON CONFIRMÉ pour ce nouveau finding ; aucune mutation/test ajouté dans cet audit.
64. **Preuve statique ?** Route montée avec `protect`, service `findById`, `canManage` vrai sur rôle seul, puis save/locks/facture.
65. **Missing resolver ?** Oui.
66. **Missing authorization ?** Tenant authorization manquante ; rôle présent.
67. **Optional filter fail-open ?** Oui sur plusieurs listes ; HZ-01 est encore plus direct, sans filtre.
68. **Client-supplied tenant ?** Pas nécessaire à l'exploitation : ObjectId de ressource suffit.
69. **Lookup cross-tenant ?** Aucun lookup causal démontré.
70. **Populate cross-tenant ?** Les populates amplifient l'information des listes globales mais la racine est déjà non scopée.
71. **Indirect tenant scope ?** Oui : Accommodation→Reservation→locks/payments/documents.
72. **Pattern safe à réutiliser ?** Resolver canonique avant handler puis attribution de réservation/accommodation, tout en conservant owner/guest.
73. **Existe-t-il déjà ?** Oui.
74. **Nouvelle primitive future ?** Non nécessaire pour le prochain hotfix.
75. **Pourquoi ?** Les primitives existantes couvrent sélection, fail-closed, opérateur et attribution ; leur adoption manque.
76. **Hotfix Dashboard a éliminé uniquement sa famille ?** Oui.
77. **Autres familles même pattern ?** Oui, absence/ignorance de scope avant query.
78. **Combien ?** Quatre domaines principaux : AccommodationReservation/Accommodation, HotelReservation/Hotel, Property ; sept clusters endpoint.
79. **Cleanup service→controller suspendu ?** Oui.
80. **Pourquoi ?** Une mutation cross-tenant P0 domine la dette structurelle.
81. **runPropertySearch doit attendre ?** Oui, sauf si requis par le futur hotfix Property dédié.
82. **Estimation ?** Attend.
83. **Dead routes ?** Attendent.
84. **Catalogue feature ?** Attend.
85. **Priorité unique ?** Accommodation Reservation tenant boundary.
86. **Nom exact ?** `HOTFIX-ACCOMMODATION-RESERVATION-TENANT-SCOPE-1`.
87. **Scope ?** Lifecycle, calendar/blocks, financial subflows et collection list de la famille, avec contrats actor explicites.
88. **Severity ?** P0.
89. **Characterization nécessaire ?** Oui avant correction, endpoint par endpoint.
90. **Tests sentinelles ?** Oui, Tenant A/B et mutations/lectures distinctives.
91. **PlatformOperator tests ?** Oui global/scopé selon contrat à confirmer ; ne pas inventer un global Accommodation.
92. **Mongo ciblé ?** Requis dans le futur hotfix ; non lancé pour cet audit.
93. **Mongo exhaustif ?** Non requis/lancé pour l'audit read-only.
94. **Backend complet ?** Non lancé ; aucun code/test modifié.
95. **Baseline modifiée ?** NON.
96. **Code production modifié ?** NON.
97. **Tests métier modifiés ?** NON.
98. **Frontend modifié ?** NON.
99. **Mobile modifié ?** NON.
100. **DB production mutée ?** NON.
101. **Commit ?** NON.
102. **Push ?** NON.
103. **Deploy ?** NON.
104. **architecture:check final ?** PASS : compteurs strictement inchangés, 0 cycle/unresolved/new violation.
105. **git diff --check ?** Vert ; seulement trois warnings CRLF préexistants.
106. **Findings total ?** Neuf.
107. **Réellement exploitables ?** Sept statiquement directs ; runtime nouveau NON CONFIRMÉ.
108. **Seulement design ?** Deux P2.
109. **Safe patterns à conserver ?** Resolver canonical fail-closed, PlatformOperator source-aware, attribution stricte, scopes indirects par IDs, domain capabilities et ownership self-service.
110. **Verdict final ?** **AUDIT CERTIFIÉ — CRITICAL FINDINGS IDENTIFIED.**

Aucun commit, push, déploiement, test persistant ou mutation de base n'a été effectué.
