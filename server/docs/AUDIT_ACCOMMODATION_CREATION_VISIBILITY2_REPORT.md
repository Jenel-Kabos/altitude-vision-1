# AUDIT-ACCOMMODATION-CREATION-VISIBILITY-2 — Rapport final

## Verdict

**B. MULTIPLE ROOT CAUSES CONFIRMED**

La création DB fonctionne, mais le HTTP 201 ne garantit pas la visibilité. Le flux réel persiste une Property et une Accommodation, puis trois frontières indépendantes peuvent masquer la ressource : tenant non propagé par la route admin, cycle `brouillon/soumis/publie`, et Property support créée `En attente` alors que la liste exige `Validée`. En parallèle, « 4 Biens Altimmo » est un compteur global brut de Property, tandis que « Tous les biens » est une projection publiée, scopée et dédupliquée. Ce sont des définitions différentes.

## Réponses obligatoires 1–25

1. Page : `/dashboard/hebergements`, `ManageAccommodationsPage`.
2. Composant : `AccommodationPropertyForm`, fonction `submit`.
3. Endpoint : `POST /api/accommodations/admin`, multipart `FormData`.
4. Controller : `accommodationController.createFull`.
5. Service : `accommodationService.createFullAccommodation`, avec builders de `propertyPublicationInputService`.
6. Modèles créés : Property et Accommodation; RatePlan optionnel; Hotel optionnel pour type hôtelier.
7. Cas indépendant : 2 obligatoires, jusqu'à 3 avec tarif. Cas hôtelier : jusqu'à 4.
8. Oui, une Property support est toujours créée par ce flux.
9. Property `status=hebergement`, `statusAdmin=En attente`; Accommodation `active=true`.
10. `moderationStatus` n'existe pas.
11. `publicationStatus=brouillon`, puis `soumis` si readiness complète; jamais `publie` à la création.
12. Property : aucun tenant injecté par le builder. Accommodation : `actingUser.platformTenant || null`; la route n'installe pas le contexte canonique, donc le tenant attendu n'est pas garanti et peut être null. Valeur production : **NON CONFIRMÉE**.
13. Property owner : owner valide du payload, sinon Admin; Accommodation `createdBy=Admin`.
14. Toute résolution HTTP réussie déclenche le toast; le body n'est pas inspecté.
15. Oui lorsque 201 est retourné : les documents obligatoires ont été persistés; les échecs ultérieurs couverts sont compensés.
16. Oui, la ressource peut être créée mais invisible.
17. Filtres masquants : tenant, `publie`, indépendant, actif et Property `Validée`; la modération exige `soumis`.
18. Oui, le hotfix historique est toujours présent.
19. Oui, la route actuelle utilise le service qui le contient.
20. Oui dans son périmètre testé : une ressource prête devient `soumis`; il ne résout pas tenant/Property/publication.
21. Oui : `/mobile/full` et `POST /accommodations`, mais elles ne sont pas utilisées par ce bouton.
22. Liste : `GET /api/accommodations/admin/list`; KPI : `GET /api/dashboard-analytics/accommodations`.
23. Liste : `publie`, indépendant, actif, Property `Validée`, tenant, plus filtres UI/pagination. KPI : tenant + indépendant.
24. Le document créé ne passe pas les gates de publication/Property et peut aussi être hors tenant; le KPI 0 est directement compatible avec `tenant:null`.
25. S'il est prêt et correctement tenanté : file `/status/pending`; incomplet : seulement DB/flux propriétaire non exposé au staff; tenant null : hors files scopées.

## Réponses obligatoires 26–42

26. `GET /api/dashboard/stats`.
27. Collection `properties`.
28. Aucune agrégation : `Property.countDocuments()`.
29. Parce que quatre documents Property existent dans le périmètre global brut; leur identité/origine production est **NON CONFIRMÉE**.
30. `/dashboard/properties` n'affiche que la projection éligible : validation, publication, disponibilité, scope et déduplication.
31. Non, les définitions de « bien » diffèrent.
32. Oui, car la création crée une Property.
33. +1 par appel indépendant normal réussi.
34. La Property est l'ancre physique du profil Accommodation.
35. Non dans le compteur général : Accommodation n'y est jamais additionné.
36. Aucune double création n'est prouvée. Le +2 observé ne peut toutefois provenir d'un seul appel normal.
37. Oui.
38. Modèles/collections distincts; `Accommodation.property` est une référence requise et unique (1:1).
39. Pas garanti : création sans middleware canonique, lectures avec ce middleware.
40. Non au niveau de la route de création; le contexte affiché côté UI ne suffit pas à le persister. Valeur production : **NON CONFIRMÉE**.
41. **NON CONFIRMÉE**.
42. Aucun SHA/version production n'a pu être prouvé; le HEAD local explique néanmoins le symptôme.

## Réponses obligatoires 43–55

43. Plusieurs bugs/frontières incohérentes.
44. Causes : propagation tenant absente; contrat succès/visibilité trompeur; cycle Accommodation et validation Property non alignés; métrique dashboard brute différente du portefeuille.
45. Fichiers principaux : `ManageAccommodationsPage.jsx`, `AccommodationPropertyForm.jsx`, `accommodationService.js` client; `accommodationRoutes.js`, `accommodationController.js`, `accommodationService.js`, `propertyPublicationInputService.js`, `dashboardAnalyticsController.js`, `dashboardKpiQueryService.js`, `propertyPortfolioService.js` serveur.
46. Fonctions/repères détaillés dans le document FLOW.
47. F-01/F-02/F-03 : P1 fonctionnel; F-04/F-06 : P2; pas de P0 démontré.
48. Risque de paires invisibles et mal attribuées, pas de Property orpheline démontrée grâce aux compensations.
49. Oui, a priori récupérables; preuve sur données production : **NON CONFIRMÉE**.
50. Probablement pour les anciennes valeurs nulles/incomplètes; décision après inventaire read-only.
51. Tenant canonique sur écriture des deux modèles; contrat UI/lifecycle aligné; gate de modération cohérent; métrique définie et scopée.
52. Tests route-level create→inspect→pending/list/analytics, incomplete, double gate, tenant, compteur +1 et non-régression portefeuille.
53. Code produit modifié pendant l'audit : **NON**. Seuls les quatre documents autorisés ont été ajoutés.
54. Commit/push/deploy : **NON**.
55. Verdict : **B. MULTIPLE ROOT CAUSES CONFIRMED**.

## Gates et limites

- Baseline : branche `main`, HEAD `6214b77f7a43950218051227e99412cb5aadf7a4`.
- Tests ciblés : **4 suites / 42 tests verts**.
- `git diff --check` final : **vert**.
- Aucune lecture ni mutation de Mongo production.
- Version production, contenu exact des quatre Property et quantité de données à backfiller : **NON CONFIRMÉS**.
- Aucun fix, commit, push ou déploiement.
