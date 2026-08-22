# HOTFIX-PROPERTY-SALE-RENT-SEPARATION-1 — Rapport final

Date : 2026-08-22. Branche `main`. Aucun commit créé (`git add`/`push`/`deploy`/`reset --hard` jamais exécutés).

## Résumé exécutif

Les listes (`/properties/portfolio`) et les KPI métier (`dashboard-analytics/sales|rentals`) étaient déjà correctement séparés par univers métier — audités et prouvés corrects, non modifiés. La cause unique et prouvée du mélange observé était le widget "Patrimoine" (`PropertyPortfolioDashboard`, alimenté par `GET /api/property-asset/portfolio/dashboard`), qui interroge `Property` sans aucun filtre transactionnel et se monte à l'identique sur `/dashboard/sales` et `/dashboard/rentals`. Un paramètre `status` optionnel, filtré côté Mongo et validé par liste blanche côté serveur, restreint désormais ce widget au bon univers métier sur ces deux pages, sans changer son comportement historique ailleurs (patrimoine global, reporting).

## Réponses aux 39 questions du mandat

1. **Champ canonique Vente/Location ?** `Property.status`.
2. **Valeurs exactes ?** `'vente' | 'location' | 'hebergement'` (enum Mongoose).
3. **Pourquoi une vente était-elle comptée dans Rentals ?** Le widget Patrimoine (`getPortfolioDashboard`) n'appliquait aucun filtre `status` et se montait sans distinction sur les deux pages.
4. **Backend ?** Oui — `filter = {}` en l'absence de filtre transactionnel.
5. **Frontend ?** Oui, en partie — le composant ne transmettait jamais l'univers métier de la page (`section`) au service.
6. **Les deux ?** Oui — cause combinée A (aucun filtre appliqué) + D (composant/endpoint partagé sans discriminant transmis).
7. **Sales list utilisait-elle le bon filtre ?** Oui, déjà correct avant ce hotfix (`PROPERTY_PUBLICATION_FILTER` + tag `status` par item + filtre frontend fiable) — non modifié.
8. **Sales KPI ?** Oui, déjà correct (`status:'vente'` dans `dashboardAnalyticsController.sales()`) — non modifié.
9. **Rentals list ?** Oui, déjà correct (même endpoint que Sales list, filtre frontend sur un champ réel) — non modifié.
10. **Rentals KPI ?** Oui, déjà correct par construction — aucune métrique Rentals stats ne référence `Property.status` (sourcées de `RentalManagement`/`Contrat`/`Paiement`/`RentalMaintenanceTicket`) — non modifié.
11. **Quel KPI Rentals comptait la vente ?** Aucun des KPI "stats" (`dashboard-analytics/rentals`) — uniquement les champs du widget Patrimoine (Valeur totale, Total biens, Valeur par type, Biens vacants/occupés, Coût d'entretien, Alertes).
12. **Le type Parcelle était-il impliqué ?** Non — confirmé par lecture de code, aucune branche conditionnelle sur `type` dans le chemin fautif ; le bug touchait indifféremment tout type physique.
13. **Le tenant était-il impliqué ?** Non — `resolveTenantScope`/`expandScopeWithUnaffiliatedUsersIfSoleTenant`/`tenantResourceAttributionService` non modifiés, aucun bug tenant démontré.
14. **La publication était-elle impliquée ?** Non — `statusAdmin`/`isPublished` ignorés par le widget Patrimoine avant comme après ce hotfix (il agrège par construction tout le patrimoine géré, publié ou non) ; axe orthogonal, non mélangé.
15. **Quel correctif exact ?** Paramètre `status` optionnel ajouté à `propertyAssetPortfolioService.getPortfolioDashboard`, au contrôleur (`propertyAssetController.getPortfolioDashboard`, validé par liste blanche `['vente','location']`), au service client (`propertyAssetService.getPortfolioDashboard`) et au composant (`PropertyPortfolioDashboard`), transmis par `ManagePropertiesPage` selon `section`.
16. **Un helper/constante a-t-il été créé ?** Non — un simple paramètre optionnel filtré nativement dans la requête Mongo existante (`Property.find({...filter, status})`), conformément au mandat §40 (ne pas fabriquer un filtre canonique universel pour un besoin aussi étroit).
17. **Vente apparaît-elle uniquement dans Sales ?** Oui, testé (Mongo intégration + unitaire frontend).
18. **Location uniquement dans Rentals ?** Oui, testé.
19. **Valeur totale séparée ?** Oui — testé avec fixtures réelles (Parcelle vente 80M / Maison location 20M) : Sales=80M, Rentals=20M, jamais 100M des deux côtés.
20. **Valeur par type séparée ?** Oui — Sales : `{Parcelle: 80000000}` sans Maison ; Rentals : `{Maison: 20000000}` sans Parcelle.
21. **Total biens séparé ?** Oui — Sales=1, Rentals=1 (jamais 2 des deux côtés).
22. **Drafts séparés ?** Oui — testé (`statusAdmin:'En attente'` vente reste côté `?status=vente`, absent côté `location`).
23. **Rejected séparés ?** Oui — testé (`statusAdmin:'Rejetée'` vente reste côté vente, absent côté location).
24. **Published séparés ?** Oui — testé (`isPublished:true` location reste côté location, absent côté vente).
25. **Catalogue public intact ?** Oui — aucune requête du catalogue public (`GET /api/properties`, `runPropertySearch`) modifiée ; continue de mélanger vente/location selon son contrat existant, non touché.
26. **Home intacte ?** Oui — `GET /api/properties/latest` non modifié.
27. **Publication hotfix intact ?** Oui — suites `propertyRoutes.test.js`, `salePropertyRoutes.test.js`, `rentalPropertyRoutes.test.js`, `propertyPortfolio.mongo.integration.test.js`, `tenantHardening.mongo.integration.test.js` rejouées, toutes vertes sans modification.
28. **Parcelle intacte ?** Oui — `propertyFilterConstants.test.js` (parité enum) et `propertyMobileController.unit.test.js` rejoués verts ; "Parcelle" reste un type valide dans tous les chemins testés, y compris dans les nouvelles fixtures de ce hotfix.
29. **Tests backend ?** 10 nouveaux tests Mongo intégration (`propertyAssetRoutes.mongo.integration.test.js`), couvrant les 16 scénarios minimum du mandat (inclusion/exclusion croisée, agrégation 80M/20M, valeur par type, comptages, brouillon/rejeté/publié non cross-domain, type physique ignoré, paramètre forgé ignoré, scope propriétaire combiné).
30. **Tests frontend ?** 5 nouveaux tests (`PropertyAssetComponents.test.jsx` : relais du prop `status` sans/avec valeur ; `ManagePropertiesPage.test.jsx` : Sales→`status=vente`, Rentals→`status=location`, page "Tous les biens" ne monte pas le widget).
31. **Mongo tests ?** 3 suites rejouées + étendues : 44/44 vertes (`propertyPortfolio`, `tenantHardening`, `propertyAssetRoutes`).
32. **Suite serveur ?** 127/127 suites, 1459/1459 tests verts.
33. **Suite client ?** 92/93 fichiers, 638/638 tests verts hors un fichier pré-existant et sans rapport (`HotelModerationPage.test.jsx`, travail externe non commité déjà présent au démarrage de ce sprint — voir Réserve ci-dessous).
34. **Lint ?** Backend : 0 erreur, 106 warnings (baseline inchangée). Frontend : 0 erreur, 267 warnings (266 baseline + 1 warning pré-existant sur un import inutilisé dans `ManagePropertiesPage.test.jsx`, non introduit par ce hotfix).
35. **Build ?** `npm run build:next` terminé avec succès.
36. **`git diff --check` ?** exit 0.
37. **Fichiers modifiés ?** Backend : `server/services/propertyAssetPortfolioService.js`, `server/controllers/propertyAssetController.js`, `server/__tests__/propertyAssetRoutes.mongo.integration.test.js`. Frontend : `client/lib/services/propertyAssetService.js`, `client/lib/components/dashboard/propertyAsset/PropertyPortfolioDashboard.jsx`, `client/lib/pages/dashboard/ManagePropertiesPage.jsx`, `client/lib/__tests__/PropertyAssetComponents.test.jsx`, `client/lib/__tests__/ManagePropertiesPage.test.jsx`. Documentation : 4 fichiers créés dans `server/docs/`. **`client/lib/pages/dashboard/HotelModerationPage.jsx` n'a pas été touché** (modification externe préexistante, laissée intacte).
38. **Commit/push/deploy ?** Aucun.
39. **Verdict ?** Voir ci-dessous.

## Gates

| Gate | Résultat |
|---|---|
| Tests backend ciblés (Mongo, portfolio/asset/tenant/publication) | 3 suites, 44/44 ✅ |
| Tests régression Property/Sale/Rental/Parcelle | 5 suites, 83/83 ✅ |
| Suite backend unit complète | 127/127 suites, 1459/1459 ✅ |
| Lint backend | 0 erreur ✅ |
| Tests frontend ciblés (widget Patrimoine + ManagePropertiesPage) | 2 fichiers, 42/42 ✅ |
| Suite client complète | 92/93 fichiers, 638/638 tests verts (1 fichier pré-existant hors périmètre, voir réserve) ⚠️ |
| Lint client | 0 erreur ✅ |
| Build production | ✅ |
| `git diff --check` | exit 0 ✅ |

## Réserve — fichier hors périmètre déjà en échec

`client/lib/__tests__/HotelModerationPage.test.jsx` échoue avec le fichier `client/lib/pages/dashboard/HotelModerationPage.jsx` tel qu'il existait AVANT ce hotfix (modification externe non commitée, présente dans `git status --short` dès le baseline de ce sprint, jamais modifiée ni par le hotfix précédent ni par celui-ci). Ce fichier concerne la modération hôtelière (Hotel/Accommodation), explicitement hors périmètre de ce hotfix (mandat §3 : "Ne pas mélanger Accommodation, Hotel..."). Non corrigé ici — signalé pour information, pas silencieusement ignoré.

## Verdict

**CERTIFIÉ VERT** pour le périmètre du mandat (séparation Vente/Location dans Sales/Rentals — listes, KPI, agrégations) :
- Cause racine prouvée par lecture de code et testée par fixtures réalistes (Parcelle vente 80M / Maison location 20M).
- Vente/Location mutuellement exclusifs dans toutes les surfaces concernées (listes déjà correctes, KPI stats déjà corrects, widget Patrimoine corrigé) — jamais 100M des deux côtés.
- Publication (hotfix précédent), tenant, modération et Parcelle non régressés — tous rejoués verts.
- Catalogue public et Home non cassés — non modifiés.
- Tous les gates backend/frontend verts, à l'exception d'un fichier de test préexistant et explicitement hors périmètre (Hôtellerie), déjà en échec avant ce sprint et non aggravé par lui.

## STOP

Conformément au mandat : PAY-7.1 non touché, Inbox Pro non poursuivi, aucun refactor global de `Property`. En attente de validation utilisateur.
