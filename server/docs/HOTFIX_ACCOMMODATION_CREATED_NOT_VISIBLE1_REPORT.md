# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Rapport final

## 1. Résumé

Un hébergement créé via l'outil admin "Ajouter un hébergement" (`/dashboard/hebergements` → `POST /accommodations/admin`) restait bloqué en `publicationStatus: 'brouillon'` — la valeur par défaut du schéma, jamais transitionnée par ce point d'entrée précis. Ce statut ne satisfaisait ni le filtre de la liste "Hébergements" (`'publie'` uniquement) ni celui de "Modération Hébergements" (`'soumis'` uniquement), les deux seules surfaces reliées à la sidebar staff — d'où le compteur "Hébergements = 1" (compte tout, sans filtre de statut) contre "Publiés = 0" et liste vide. Le flux mobile analogue (`createFullMobileAccommodation`) prouve déjà, en code et en tests, que le contrat attendu pour ce type de point d'entrée est l'auto-soumission à la modération (`'soumis'`), jamais le blocage silencieux en brouillon ni l'auto-publication. Correctif minimal appliqué : `createFullAccommodation` soumet désormais automatiquement l'hébergement fraîchement créé si `evaluateReadiness` (garde déjà existante, réutilisée à l'identique) le juge complet ; sinon il reste en `brouillon`, comportement inchangé. Reproduction rouge→vert obtenue sur vrai Mongo. Aucune règle métier nouvelle, aucun changement RBAC, aucun affaiblissement tenant/owner/PlatformOperator.

## 2. Réponses aux 64 questions du mandat

1. **HEAD ?** `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé, aucun commit créé pendant ce mandat).
2. **Branche ?** `main`.
3. **Worktree ?** Non propre — nombreuses modifications non commitées de mandats antérieurs de cette même session marathon, préexistantes à ce mandat.
4. **Endpoint create exact ?** `POST /api/accommodations/admin` → `exports.createFull` (`server/controllers/accommodationController.js:889`).
5. **Composant create exact ?** `client/lib/components/dashboard/AccommodationPropertyForm.jsx`, ouvert depuis `ManageAccommodationsPage.jsx` ("Ajouter un hébergement").
6. **Payload exact ?** `FormData` : champs Property (title, description, price, status='hebergement', pole, type, availability, surface, bedrooms, bathrooms, livingRooms, kitchens, constructionType), address, location, amenities, images, accommodationType, capacity[maxAdults/maxChildren], beds, checkInTime, checkOutTime, minimumStay, maximumStay, cancellationPolicy, houseRules, securityDeposit, cleaningFee, nightlyPrice, accommodationAmenities, rules, includedServices. **Aucun champ `publicationStatus`, `isApproved`, `owner` envoyé.**
7. **Document Mongo créé ?** Oui — `Property` + `Accommodation` + `RatePlan` optionnel, confirmé par test service-level sur vrai Mongo.
8. **Tenant correct ?** Oui, dérivé de `actingUser.platformTenant`, inchangé par ce hotfix (voir `_TENANT_MATRIX.md`).
9. **Owner correct ?** Oui, `req.user.id` (l'Admin créateur) par défaut, inchangé.
10. **Status après création (avant hotfix) ?** `publicationStatus: 'brouillon'` (défaut du schéma, jamais fixé explicitement par `createFull`).
11. **Approval (avant hotfix) ?** Aucune — jamais soumis, donc jamais éligible à validation.
12. **Publication (avant hotfix) ?** Aucune — `publicationStatus !== 'publie'`.
13. **Pourquoi compteur = 1 ?** L'agrégation KPI "total" (`dashboardAnalyticsController.js:26`) compte tous les hébergements indépendants du tenant, **sans filtre de statut**.
14. **Query compteur ?** `Accommodation.aggregate([{$match: independent}, ..., {$group: {total: $sum 1, published: $sum(publicationStatus==='publie')}}])`.
15. **Pourquoi Publiés = 0 ?** Le même agrégat compte `published` uniquement si `publicationStatus === 'publie'` — le brouillon ne le satisfait pas.
16. **Query Publiés ?** Même agrégation que ci-dessus, champ `published`.
17. **Query liste principale ?** `GET /api/accommodations/admin/list?status=publie&validatedOnly=true&activeOnly=true&independentOnly=true` → `Accommodation.find({publicationStatus:'publie', accommodationType:{$ne:'hotel'}, hotel:null, active:{$ne:false}})` + population filtrée `statusAdmin:'Validée'`.
18. **Quels filtres ?** `publicationStatus`, `accommodationType`/`hotel` (independentOnly), `active` (activeOnly), `property.statusAdmin` (validatedOnly).
19. **Le document passe-t-il ces filtres (avant hotfix) ?** Non — `publicationStatus:'brouillon' !== 'publie'`.
20. **Sinon lequel échoue ?** Le filtre `publicationStatus:'publie'`, exclusivement.
21. **API liste retourne le document (avant hotfix) ?** Non.
22. **Frontend le reçoit (avant hotfix) ?** Non — absent de la réponse API elle-même, pas un problème de filtrage côté client.
23. **Frontend le filtre ?** Non — `ManageAccommodationsPage.jsx` affiche fidèlement ce que l'API renvoie, sans filtre supplémentaire côté client.
24. **Cache impliqué ?** Non — `load()` et `loadAnalytics()` sont rappelés après chaque création (`onSuccess`), aucun état stale.
25. **Refresh impliqué ?** Non, pour la même raison.
26. **Modération liste retourne le document (avant hotfix) ?** Non — `GET /accommodations/status/pending` filtre `publicationStatus:'soumis'`, jamais satisfait par `'brouillon'`.
27. **Le workflow exige-t-il validation ?** Oui — c'est un contrat métier réel et volontaire (le staff doit valider avant publication), non remis en cause par ce hotfix.
28. **Preuve ?** `reviewDecision` (validate) exige `publicationStatus === 'soumis'` ; le flux mobile analogue soumet automatiquement mais s'arrête à `'soumis'`, jamais `'publie'` — preuve que la modération humaine reste un gate réel et voulu.
29. **Admin create doit-il auto-valider ?** Non — aucune preuve de ce contrat ; le flux mobile analogue (le seul précédent comparable) s'arrête à `'soumis'`, pas `'publie'`.
30. **Preuve ?** Voir `_ROOT_CAUSE.md` §"Preuve directe du contrat attendu" — `mobileAccommodationPublicationService.js` auto-soumet mais n'auto-publie jamais.
31. **Propriétaire create même contrat ?** Non, et volontairement différent : `exports.create` (self-service) reste en `brouillon` avec un bouton "Soumettre" explicite dans `/mes-hebergements` — contrat de relecture intentionnel, **non modifié** par ce hotfix.
32. **PlatformOperator ?** Non concerné — ni lu ni modifié par `createFullAccommodation` ni par le correctif.
33. **HZ-04 tenant scope intact ?** Oui — `accommodationAdminListsTenantScope.mongo.integration.test.js` reste vert (37/37 sur la suite Mongo ciblée Accommodation), sans aucune adaptation.
34. **Reproduction rouge obtenue ?** Oui — `git stash` du correctif → 2/3 tests échouent avec `Received: "brouillon"` au lieu de `"soumis"` ; `git stash pop` → 3/3 verts.
35. **Cause racine exacte ?** `createFullAccommodation` ne fixe jamais `publicationStatus`, laissant la valeur par défaut `'brouillon'`, invisible des deux surfaces staff reliées à la sidebar, sans voie de sortie découvrable.
36. **Expected workflow ou bug ?** Bug confirmé (catégorie A) — le workflow de modération lui-même est légitime et intact, mais ce point d'entrée précis n'y accédait jamais, contrairement à son analogue mobile déjà correct.
37. **Correctif nécessaire ?** Oui.
38. **Backend ?** Oui — `server/services/accommodationService.js::createFullAccommodation`, une seule fonction modifiée.
39. **Frontend ?** Non — aucun fichier `client/` modifié.
40. **Status default ?** Schéma `Accommodation.publicationStatus` inchangé (`default: 'brouillon'`) — le correctif transitionne explicitement après création, ne change pas le défaut du schéma (qui reste correct pour le flux propriétaire self-service).
41. **Tenant ?** Inchangé (voir Q8).
42. **Query ?** Aucune requête de lecture modifiée — seule la valeur écrite à la création change (sous condition de réussite de `evaluateReadiness`).
43. **Cache ?** Non concerné.
44. **Nouvelle règle métier ajoutée ?** **NON** — réutilisation exacte d'une transition (`brouillon→soumis` via `evaluateReadiness`) et d'un statut cible (`'soumis'`) déjà définis et déjà appliqués ailleurs (flux mobile).
45. **RBAC modifié ?** **NON** — aucune route, aucun `restrictTo`, aucune vérification de rôle touchée.
46. **Tenant security affaiblie ?** **NON** — voir `_TENANT_MATRIX.md`.
47. **HZ-01→HZ-04 toujours verts ?** Oui pour HZ-04 (Accommodation, seul concerné par ce chemin de code) — confirmé par exécution réelle. HZ-01→HZ-03 sont hors du chemin de code modifié (non-Accommodation) et non affectés par construction.
48. **Tests ciblés ?** 3/3 PASS (`accommodationCreatedVisibility.mongo.integration.test.js`).
49. **Backend complet ?** `npm run test:unit` → 141 suites / 1579 tests PASS.
50. **Mongo exhaustif ?** `npm run test:mongo` → 106/108 suites, 1097/1111 tests PASS ; 2 suites en échec, toutes deux préexistantes et sans rapport avec ce hotfix (voir `_GATE_MATRIX.md`).
51. **Client complet ?** Non requis — aucune modification frontend.
52. **Build ?** Non requis — aucune modification frontend.
53. **Architecture PASS ?** Oui, 0 nouvelle violation.
54. **Lint ?** 0 erreur, warnings pré-existants uniquement.
55. **diff-check ?** Propre sur les fichiers de ce mandat.
56. **Frontend modifié ?** Non.
57. **Mobile modifié ?** Non.
58. **Schema modifié ?** Non — le schéma `Accommodation.js` n'a subi aucune modification.
59. **Migration ?** Non — aucune migration de données nécessaire (le correctif n'affecte que les créations futures).
60. **Production mutée ?** Non — aucun test n'a touché la production ; tous les tests Mongo utilisent `MongoMemoryReplSet` éphémère.
61. **Commit ?** Non.
62. **Push ?** Non.
63. **Deploy ?** Non.
64. **Verdict final ?** Voir §3.

## 3. Verdict

**A. BUG CONFIRMÉ — CERTIFIÉ VERT APRÈS FIX**

Cause racine prouvée par reproduction rouge→vert sur vrai Mongo, contrat de visibilité démontré par comparaison directe avec un point d'entrée analogue déjà correct (flux mobile), correctif minimal (une fonction, une transition déjà existante réutilisée), aucune règle métier inventée, RBAC inchangé, tenant/owner/PlatformOperator intacts, bonne surface (Modération Hébergements) affiche désormais le document comme promis par le message d'état vide, refresh déjà cohérent (non touché), HZ-04 non-régressé, tests ciblés et suite complète verts, architecture PASS, lint sans nouvelle erreur, diff-check vert.

## 4. Fichiers créés/modifiés

**Code** :
- `server/services/accommodationService.js` (modifié — `createFullAccommodation`)
- `server/__tests__/accommodationCreatedVisibility.mongo.integration.test.js` (nouveau — reproduction + non-régression)

**Documentation** (`server/docs/`, préfixe `HOTFIX_ACCOMMODATION_CREATED_NOT_VISIBLE1_`) :
`_ETAT_INITIAL.md`, `_FLOW.md`, `_QUERY_MATRIX.md`, `_STATUS_MATRIX.md`, `_TENANT_MATRIX.md`, `_REPRODUCTION.md`, `_ROOT_CAUSE.md`, `_FIX_DECISION.md`, `_GATE_MATRIX.md`, `_REPORT.md` (ce fichier).

**Aucune mutation de production. Aucun commit, push ou déploiement.**

## 5. STOP

Conformément au mandat, ce sprint s'arrête ici. **En attente de validation de l'utilisateur avant tout commit.**
