# ARCH-2G — Rapport de certification

## Verdict

**ARCH-2G — AUDIT CERTIFIÉ.** Les 13 edges sont inventoriées, leurs 25 usages fonctionnels sont classifiés, la baseline reste intacte et aucun refactor n'a été exécuté.

**NEXT RECOMMENDED SPRINT: ARCH-2H — DEVIS ROUTE APPLICATION BOUNDARY**  
**TARGET:** `devisRoutes.js → Devis.js`  
**EXPECTED:** `route→model 13 → 12`  
**RISK:** MEDIUM  
**WHY:** meilleure cohésion et meilleur ratio valeur/risque hors frontières de sécurité.

Les preuves détaillées sont dans l'inventaire, la matrice d'usages, les matrices sécurité/risque/testabilité/quick-win/KEEP et la décision ARCH-2G.

## Réponses obligatoires

1. **Baseline HEAD réelle ?** `main` à `a04055f62952c782b92aeef2f100824a17a5f645`; worktree déjà sale et préservé.
2. **route→model = 13 ?** Oui, checker et imports réels concordent.
3. **service→controller = 4 ?** Oui.
4. **controller→controller = 1 ?** Oui.
5. **Cycles ?** 0.
6. **Stale ?** 0 selon la baseline documentaire; le checker courant rapporte surtout unresolved=0.
7. **New violations ?** 0.
8. **13 edges exactes ?** Contrat→Contrat; Devis→Devis; Estimation→Estimation; GestionDocument→Contrat; GestionDocument→Paiement; Locataire→Locataire; Paiement→Paiement; PlatformTenant→PlatformTenantDomain; Proprietaire→Proprietaire; Projets→Projet; Realisations→Realisation; RentalManagement→RentalManagement; UserBusinessProfile→User.
9. **Fichiers routes ?** Les 12 fichiers homonymes listés dans `ARCH2G_ROUTE_MODEL_INVENTORY.md`; GestionDocument porte deux edges.
10. **Models ?** Contrat, Devis, Estimation, Paiement, Locataire, PlatformTenantDomain, Proprietaire, Projet, Realisation, RentalManagement et User; `Projet.js` est absent.
11. **Usages réels ?** 25 opérations fonctionnelles, soit 28 invocations JS en séparant constructeur et `save`.
12. **Usages read-only ?** 15 : les guards et lookups, les listes Devis/Estimation/Projet/Realisation et le détail Realisation.
13. **Usages mutatifs ?** 10 : Devis create/update, Estimation create/mark-viewed, Projet create/update/delete et Realisation create/update/delete.
14. **Application logic ?** Aucun usage n'a cette classe principale; les cas proches sont classés plus précisément mutation orchestration.
15. **Query logic ?** Devis GET; Estimation find et count; Realisation GET liste.
16. **Authorization guards ?** Aucun comme classe principale; l'autorisation est présente mais tenant/ownership/operator est la décision précise.
17. **Tenant guards ?** Contrat, les deux GestionDocument, Locataire, Paiement, Proprietaire et UserBusinessProfile.
18. **Ownership guards ?** RentalManagement principalement; Contrat/Locataire/Proprietaire portent aussi des relations indirectes.
19. **PlatformOperator ?** PlatformTenantDomain directement; Paiement accepte aussi le contexte opérateur via la résolution tenant.
20. **Resource-existence guards ?** Le GET détail Realisation principalement; l'existence est aussi une étape des guards plus précis.
21. **Technical lookups ?** Aucun usage principal.
22. **Usages inconnus ?** Oui, les quatre opérations Projet : route non montée et modèle absent.
23. **Edges légitimes à conserver ?** 9 guards.
24. **Pourquoi ?** Elles décident tenant, ownership ou cross-tenant au point d'entrée et protègent des domaines sensibles.
25. **Vraie dette applicative ?** 3 edges démontrées : Devis, Estimation, Realisation; Projet reste legacy inconnu plutôt que dette extractible prouvée.
26. **Pourquoi ?** Elles exécutent queries/mutations dans les handlers; Realisation exige toutefois une décision de lifecycle avant extraction.
27. **Duplication ?** Oui.
28. **Où ?** Le motif `findById → existence → resolve tenant → assert tenant` se répète dans les routes location; les CRUD legacy Projet/Realisation sont parallèles.
29. **Services existants absorbants ?** Pas d'abstraction canonique Devis/Realisation/Projet trouvée; Estimation possède déjà un contrôleur riche mais pas la frontière des deux handlers audités.
30. **Lesquels ?** `estimationController.js` pour d'autres opérations Estimation; les services tenant/policies existants sont déjà appelés par les guards, pas substituables sans design.
31. **Risque de God Service ?** Oui si regroupement par Model ou domaine transversal.
32. **Candidats concernés ?** Un EstimationService total, une PropertyFacade, un UserService global ou un service location unifié.
33. **Edges Finance ?** GestionDocument→Paiement et Paiement→Paiement.
34. **Hôtel ?** Aucune des 13 directement.
35. **Gestion locative ?** Contrat, GestionDocument×2, Locataire, Paiement, Proprietaire et RentalManagement.
36. **Property ?** Aucune edge directe vers Property.
37. **Documents ?** GestionDocument→Contrat/Paiement; Estimation touche uploads/rapport au sens fonctionnel.
38. **Messaging ?** Aucune.
39. **CRM ?** Devis et Estimation via demandes/notifications commerciales.
40. **Blast radius le plus faible ?** Devis structurellement; Projet/Realisation paraissent isolés mais leur statut legacy inconnu interdit de conclure LOW.
41. **Le plus élevé ?** Paiement, PlatformTenantDomain, RentalManagement et UserBusinessProfile : CRITICAL.
42. **Candidat le plus cohérent ?** Devis, trois endpoints d'un seul workflow.
43. **Meilleur contrat de test ?** Devis, malgré l'absence actuelle d'une suite dédiée.
44. **Candidat nécessitant Mongo ?** Tous les candidats réalistes; Devis peut rester ciblé.
45. **Candidat touchant tenant ?** Les guards conservés; aucun des quatre candidats applicatifs n'en montre explicitement.
46. **Ownership ?** RentalManagement, conservé.
47. **PlatformOperator ?** PlatformTenantDomain, conservé; Paiement indirectement.
48. **Authorization ?** Tous les guards, Devis GET/PATCH et Estimation GET ont de l'auth; les legacy sont ambigus/absents.
49. **Mutations ?** Devis, Estimation, Projet et Realisation.
50. **Notifications ?** Devis et Estimation.
51. **Socket.IO ?** Aucun usage trouvé dans les handlers audités.
52. **Cloudinary ?** Estimation uniquement.
53. **Plus grand gain d'edges ?** Égalité : chaque candidat réaliste retire une edge; déplacer les neuf guards serait un faux gain.
54. **Est-il aussi le moins risqué ?** Parmi les dettes prouvées, Devis oui.
55. **Sinon pourquoi ne pas le choisir ?** Sans objet; les legacy seulement paraissent petits mais leur contrat n'est pas confirmé.
56. **Meilleur ratio gain/risque ?** Devis.
57. **Edges supprimées ?** 1.
58. **Compteur après sprint ?** 12.
59. **Autres compteurs stables ?** Attendu : service→controller 4, controller→controller 1, cycles/stale/new violations 0; à vérifier pendant ARCH-2H.
60. **Abstraction appropriée ?** Un `devisApplicationService` étroit, éventuellement appelé par un contrôleur fin.
61. **Existe-t-elle ?** Non trouvée.
62. **Créer une abstraction ?** Oui, pendant ARCH-2H seulement.
63. **Étroite ?** Oui : création, liste staff et transition de statut Devis uniquement.
64. **Endpoints ?** POST `/api/devis`, GET `/api/devis`, PATCH `/api/devis/:id`.
65. **Contrat à caractériser ?** Statuts/body HTTP, validation, tri/populate, 404, champs modifiables, `traitePar`, notifications/emails et leur caractère best effort.
66. **Tests existants utiles ?** Infrastructure Jest/Supertest/Mongo existante et conventions auth; aucune suite Devis dédiée n'a été trouvée.
67. **Tests manquants ?** Caractérisation ciblée des trois endpoints, auth, succès/échecs provider, persistance et non-régression du payload.
68. **Mongo exhaustif nécessaire ?** Non; Mongo ciblé oui.
69. **Guards devant rester route/middleware ?** Contrat, GestionDocument×2, Locataire, Paiement, PlatformTenantDomain, Proprietaire, RentalManagement et UserBusinessProfile jusqu'à policy équivalente prouvée.
70. **Edges à ne pas déplacer ?** Ces neuf edges.
71. **Exceptions documentées futures ?** Oui, ces neuf guards peuvent devenir exceptions volontaires.
72. **Pourquoi ?** Leur proximité de l'entrée HTTP rend la frontière visible et réduit le risque de bypass.
73. **4 service→controller plus prioritaires ?** Non face à Devis.
74. **Pourquoi ?** Le cluster reporting connu est transversal et plus risqué; Devis est borné et quantifiable.
75. **runPropertySearch prioritaire ?** Non.
76. **Pourquoi ?** Son edge controller→controller et son orchestration Property restent à risque moyen/élevé, contrairement au périmètre Devis.
77. **PropertyFacade globale recommandée ?** Non.
78. **Baseline modifiée ?** Non.
79. **Code production modifié ?** Non.
80. **Tests métier modifiés ?** Non.
81. **Frontend modifié ?** Non.
82. **Mobile modifié ?** Non.
83. **Données modifiées ?** Non.
84. **Commit ?** Non.
85. **Push ?** Non.
86. **Deploy ?** Non.
87. **architecture:check PASS ?** Oui à l'état initial; validation finale ci-dessous.
88. **git diff --check ?** Code 0 à l'état initial, avertissements CRLF préexistants seulement; validation finale ci-dessous.
89. **Prochain quick win ?** ARCH-2H — Devis Route Application Boundary.
90. **Pourquoi précisément ?** Une responsabilité cohérente, pas de tenant/ownership/operator/finance/Cloudinary, une seule edge et des effets providers bornables.
91. **Scope exact ?** L'import Devis et les accès Mongoose des trois handlers de `devisRoutes.js`, sans changer leurs contrats.
92. **Objectif quantifiable ?** Retirer cette edge et passer 13→12 avec comportement identique.
93. **Non-objectifs ?** Aucun changement de règles/statuts, schéma, API, providers, sécurité, frontend/mobile, Estimation ou legacy.
94. **Risques à verrouiller ?** Mutations, attribution staff, validation, ordre/populate, 404 et providers best effort.
95. **Tests avant code ?** HTTP+Mongo POST/GET/PATCH, auth/validation/404, payloads et doubles notification/email succès/échec.
96. **STOP condition ?** Écart contractuel, tenant implicite découvert, side-effect non maîtrisé, abstraction transverse nécessaire ou compteur autre que route→model dégradé.
97. **Sprint après validation ?** Une nouvelle décision fondée sur baseline 12; aucun successeur d'extraction n'est préautorisé.
98. **Raison de ne plus réduire route→model ?** Oui après Devis si les seuls choix sont guards ou flux/legacy à risque sans caractérisation.
99. **Dette alors prioritaire ?** Réévaluer les 4 service→controller, puis runPropertySearch, et mener séparément le lifecycle/security audit des routes legacy.
100. **Verdict final ?** ARCH-2G — AUDIT CERTIFIÉ; ARCH-2H recommandé mais non exécuté.

## Contrôles finaux

Contrôles rejoués à la clôture :

- `architecture:check` : PASS, 468 fichiers, 1 523 edges, route→model 13, service→controller 4, controller→controller 1, cycles 0, unresolved 0, dangling 3, nouvelles violations 0.
- Inventaire : exactement 13 lignes d'edges.
- Questions : exactement 100 réponses numérotées.
- Livrables : exactement 11 fichiers `ARCH2G_*`.
- `git diff --check` : code 0; trois avertissements CRLF préexistants seulement.
- Seuls les documents `ARCH2G_*` ont été créés par ce mandat; les autres différences, dont le test d'architecture déjà non suivi, appartiennent au worktree antérieur.
