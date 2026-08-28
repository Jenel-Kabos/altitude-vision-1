# HOTFIX-ACCOMMODATION-CREATION-VISIBILITY-2 — Rapport final

## Verdict

**A. ACCOMMODATION CREATION/VISIBILITY HOTFIX CERTIFIED GREEN**

Le workflow Admin conserve la politique canonique `CREATE → soumis → VALIDATE → publie`. Il n'auto-publie jamais un hébergement incomplet. La création est désormais tenant-scopée et fail-closed, la paire Property/Accommodation reçoit le même tenant, la décision de modération synchronise les deux gates de publication, l'UI annonce le statut réel et ouvre la file de modération, et « Biens Altimmo » réutilise exactement la projection dédupliquée de « Tous les biens ».

## Corrections

- `POST /api/accommodations/admin` utilise `requireTenantScope`, le resolver canonique existant. Admin A/B et PlatformOperator explicitement scopé créent dans le tenant sélectionné; Admin ou opérateur non scopé reçoit 403.
- `createFullAccommodation` dérive une seule fois le tenant de l'acteur enrichi et le persiste sur Property et Accommodation.
- La réponse 201 ajoute `data.lifecycle` sans retirer ni renommer aucun champ : `soumis/pending_moderation` ou `brouillon/draft`.
- Le frontend affiche « envoyé en modération » ou « brouillon enregistré » à partir de cette réponse. Un nouvel hébergement `soumis` ouvre `/dashboard/moderation/hebergement`.
- La validation charge désormais aussi `Property.description` (sans quoi le score restait artificiellement à 80 %), puis synchronise `Accommodation=publie`, `Property.statusAdmin=Validée`, `Property.isPublished=true`. Le rejet synchronise `rejete/Rejetée/isPublished=false`.
- `getPropertyPortfolioForTenantScope` centralise projection, expansion canonique du scope et déduplication. `/properties/portfolio` et le KPI `Altimmo` utilisent cette même fonction.
- `GET /api/dashboard/stats` exige un tenant résolu et transmet son scope au KPI.

## RED → GREEN

Avant correction, la nouvelle suite métier avait **4 tests en échec** : lifecycle absent, tenant `null`, création non scopée acceptée, validation bloquée/Property non synchronisée. Après correction : **4/4 verts**.

Le test permanent couvre : Admin tenant A et B, absence cross-tenant, fail-closed Admin/opérateur global, opérateur explicitement scopé, complet `soumis`, incomplet `brouillon`, Property/Accommodation cohérentes, file de modération, validation, liste publiée, et égalité KPI/portefeuille.

## Réponses obligatoires 1–23

1. HEAD initial : `6214b77f7a43950218051227e99412cb5aadf7a4`.
2. Route corrigée : oui, `POST /api/accommodations/admin`.
3. Tenant context corrigé : oui.
4. Mécanisme réutilisé : `requireTenantScope` et les services tenant existants.
5. Test RED tenant : oui; tenant persisté `null` avant fix.
6. GREEN : oui, A/B isolés et absence de contexte refusée.
7. Lifecycle Admin complet attendu : `soumis`, puis validation, puis `publie`.
8. Lifecycle obtenu : conforme.
9. Admin incomplet : reste `brouillon`, jamais publié.
10. Owner/mobile : inchangé; aucune auto-validation ajoutée.
11. Property support créée : oui, comme auparavant.
12. Tenant cohérent : même tenant sur Property et Accommodation.
13. Statuts cohérents : `En attente` pendant brouillon/soumission; `Validée + isPublished` à la validation; `Rejetée` au rejet.
14. Relation cohérente : référence 1:1 `Accommodation.property`, owner inchangé.
15. Créé complet visible immédiatement dans la file de modération; après validation dans Hébergements et Tous les biens. Brouillon reste non publié et est annoncé comme tel.
16. `/dashboard/hebergements` reste volontairement une liste de publiés validés; le parcours redirige un `soumis` vers sa file canonique.
17. Message succès : dérivé du statut backend réel.
18. Ancien compteur : `Property.countDocuments()` global brut.
19. Nouveau compteur : `propertyPortfolio.stats.total` tenant-scopé.
20. Même projection que Tous les biens : oui, fonction partagée.
21. Déduplication : oui, même Map par Property.
22. Property support : compte seulement lorsque son Accommodation devient éligible; jamais en double.
23. Une création `soumis` ajoute 0 au compteur visible; après validation elle ajoute 1.

## Réponses obligatoires 24–45

24. Delta historique 2→4 : **NON CONFIRMÉ**; aucune formule artificielle ajoutée.
25. Données existantes : récupérables par rattachement tenant, complétion et modération après inventaire.
26. Backfill : probablement nécessaire pour les anciennes paires `tenant:null`; volume et autorité à confirmer avant exécution.
27. Migration/script : aucun créé ni exécuté.
28. Mutation production : **NON**.
29. Nouveau test E2E métier : oui, `accommodationCreationVisibility2.mongo.integration.test.js`.
30. RED : 4/4 en échec avant correction.
31. GREEN : 4/4 verts après correction.
32. Tests serveur ciblés consolidés : **10 suites, 156/156 verts**.
33. Architecture : PASS, 473 fichiers, 1572 edges, 0 nouvelle violation.
34. Lint : serveur 0 erreur (108 avertissements historiques); client 0 erreur (267 avertissements historiques).
35. Frontend build : Next.js production PASS; avertissements historiques et `fetch EPERM` non bloquants pendant pré-rendu.
36. `git diff --check` : PASS.
37. Nouvelle vulnérabilité : aucune identifiée; l'écriture et le KPI sont désormais fail-closed par tenant.
38. Breaking API : aucun champ supprimé/modifié; `data.lifecycle` est additif. Les appels staff sans tenant à create/dashboard stats sont volontairement refusés selon la frontière canonique.
39. Mobile : code et lifecycle mobile non modifiés; tests mobile ciblés verts.
40. Hors scope : aucun code métier d'un autre domaine modifié. Les quatre documents d'audit préexistants sont conservés.
41. Commit : **NON**.
42. Push : **NON**.
43. Deploy : **NON**.
44. HEAD final : `6214b77f7a43950218051227e99412cb5aadf7a4` (aucun commit).
45. Verdict : **A. ACCOMMODATION CREATION/VISIBILITY HOTFIX CERTIFIED GREEN**.

## Fichiers produit principaux

- `server/routes/accommodationRoutes.js`, `server/controllers/accommodationController.js`, `server/services/accommodationService.js`
- `server/services/propertyPortfolioService.js`, `server/controllers/propertyPortfolioController.js`
- `server/routes/dashboardRoutes.js`, `server/services/dashboardKpiQueryService.js`
- `client/lib/components/dashboard/AccommodationPropertyForm.jsx`, `client/lib/pages/dashboard/ManageAccommodationsPage.jsx`

Aucun commit, push, déploiement, backfill ou accès en écriture à la production n'a été effectué.
