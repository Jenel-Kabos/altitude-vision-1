# AUDIT-MOBILE-CONFIRMED-VISITS-VISIBILITY-1 — Rapport final

## Verdict

**G. PRODUCT CONTRACT MISMATCH — root cause confirmée.**

Le compte mobile cible cumule le rôle `Proprietaire` et le rôle métier de demandeur de cette visite. `VisitesScreen` choisit toutefois un unique contexte à partir du rôle global : un `Proprietaire` appelle exclusivement `GET /api/visites/owner` et voit le titre « Visites de mes biens ». La visite cible est correctement liée à ce compte par `Visite.client`, mais le bien appartient au compte Admin Altitude Vision. Elle est donc absente, à juste titre, de la query propriétaire et présente dans la query client `GET /api/visites/my`, que cette interface ne rend plus accessible à ce profil dual.

Ce n'est ni un problème de statut, de date, de paiement, de mapper, de rendu, de cache, ni une fuite tenant. C'est une sélection exclusive de contrat mobile incompatible avec un utilisateur pouvant être à la fois propriétaire et client d'un bien tiers.

## Matrice de preuve

| Étape | Résultat |
|---|---|
| Visit ID | `6a91f8afa5c38bdf8be22718` |
| Property/Accommodation ID | `6a911186cbe20b4c495d6591` |
| Client/User ID | `6a84080352c6ffabafb26af7` |
| Persisted status | `status=confirmee`, `statut=Confirmée` |
| Confirmed date | `scheduledStartAt=2026-08-29T10:00:00.000Z` (11:00 Africa/Brazzaville) ; `dateConfirmee=null` |
| Start time | Confirmation : 11:00 locale ; préférence initiale : 09:00 locale |
| End time | `scheduledEndAt=2026-08-29T12:30:00.000Z` (13:30 locale) |
| Dashboard endpoint | `PATCH /api/visites/:id`, puis `GET /api/visites` |
| Mobile endpoint | `GET /api/visites/owner`, choisi parce que `user.role === 'Proprietaire'` |
| Mobile HTTP status | Non capturé directement ; contrat handler : 200. Le rendu réel ne distingue pas un 200 vide d'une erreur car le `catch` force aussi `[]`. |
| Raw visits count | Query exacte de l'endpoint owner reproduite en lecture Mongo : 0 |
| Target visit raw | Non dans owner ; oui dans my (`1/1`) |
| Mapped count | 0 ; aucun mapper de visites n'existe sur cet écran |
| Upcoming count | 0 |
| Target rendered | Non, reproduit sur Samsung SM-S918B |

## Trace complète

### Dashboard → persistence

`client/app/dashboard/visites/page.jsx` rend `client/lib/pages/dashboard/VisitesPage.jsx`. Le bouton « Confirmer date » appelle `handleProposerDate`, puis `updateVisite` dans `client/lib/services/visiteService.js` :

- méthode : `PATCH` ;
- route : `/api/visites/:id` ;
- payload réel construit : `scheduledStartAt`, `scheduledEndAt`, `meetingAddressSnapshot`, `status: "confirmee"` ;
- réponse : `{ status: 'success', data: { visite: serializeVisite(visite, 'staff') } }`.

Le contrôleur `server/controllers/visiteController.js::updateVisite` normalise le statut, vérifie la transition et le conflit, puis `appendHistory` maintient les deux contrats : `status=confirmee` et `statut=Confirmée`.

Le document réel lu sans mutation contient :

- propriété `6a911186cbe20b4c495d6591`, type `Villa`, statut métier `hebergement` ;
- client `6a84080352c6ffabafb26af7`, rôle `Proprietaire` ;
- owner snapshot/référence `6a7de24d48d42c4c87f893d5`, identique au propriétaire réel du bien, compte Admin Altitude Vision ;
- `requestedDate=2026-08-29T08:00:00.000Z` et `requestedTime=09:00` ;
- `scheduledStartAt=2026-08-29T10:00:00.000Z` ;
- `scheduledEndAt=2026-08-29T12:30:00.000Z` ;
- `timezone=Africa/Brazzaville` ;
- `paiementStatus=non_requis`, commission non renseignée ;
- création `2026-08-28T21:07:59.831Z`, dernière mise à jour `2026-08-29T07:10:00.431Z`.

La ligne dashboard « Heure souhaitée 09:00 – 13:30 » mélange la préférence client `heurePreferee=09:00` et `requestedEnd`, que le serializer alimente prioritairement avec `scheduledEndAt=13:30`. Le créneau confirmé réel commence à 11:00. Cette incohérence d'affichage mérite un audit ultérieur mais ne cause pas la disparition mobile.

### Endpoint mobile → state → rendu

`altimmo-app/src/screens/Visites/VisitesScreen.jsx` contient :

```js
const isProprietaire = user?.role === 'Proprietaire';
const endpoint = isProprietaire ? '/visites/owner' : '/visites/my';
```

`GET /api/visites/owner` recherche d'abord `Property.find({ owner: req.user.id })`, puis `Visite.find({ property: { $in: propertyIds } })`. Pour l'utilisateur cible :

- propriétés possédées : 2 ;
- visites sur ces propriétés : 0 ;
- visite cible dans la query owner : non.

La query alternative `Visite.find({ client: req.user.id })`, utilisée par `/visites/my`, retourne 1 visite, précisément la cible.

Il n'existe aucun mapper intermédiaire. Le state reçoit directement `res.data.data.visites`. Le filtre « À venir » est :

```js
visites.filter(v => tab === 'venir' ? isActive(v) : !isActive(v))
```

`isActive` exclut seulement les statuts terminaux ; il ne compare aucune date à `Date.now()`. `confirmee` est actif. Si la visite était reçue, elle apparaîtrait dans « À venir ».

### Cache et lifecycle

- clé : `visites:/visites/owner` ;
- TTL : 2 minutes ;
- fetch au mount ;
- pull-to-refresh : force la requête ;
- événements socket : invalidation et force refresh ;
- pas de `useFocusEffect` ni de listener focus ; un simple refocus n'impose donc pas un fetch ;
- Samsung : écran vide reproduit, pull-to-refresh sans effet, sortie/retour sans effet et cold start sans effet.

Le cache et le refocus peuvent retarder d'autres mises à jour, mais ils ne sont pas la cause de ce cas : même la query fraîche retourne zéro élément dans le contexte owner.

## Réponses obligatoires

1. **HEAD :** `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5`, branche `main`.
2. **Worktree initial :** quatre modifications mobiles préexistantes (`navigationSdk.js`, `DetailAnnonceScreen.jsx`, test et implémentation `propertyMapper`) et `server/docs/AUDIT_PROPERTY_SHARE_WHATSAPP_OG1_REPORT.md` non suivi. `HOTFIX_MOBILE_PROPERTY_SHARE_CANONICAL_URL1_REPORT.md` est apparu concurremment après le baseline et a également été laissé intact.
3. **Changements existants préservés :** oui.
4. **Modèle exact :** `server/models/Visite.js`, modèle Mongoose `Visite`.
5. **Document cible identifié :** oui.
6. **Visit ID :** `6a91f8afa5c38bdf8be22718`.
7. **Bien :** `6a911186cbe20b4c495d6591`, « VILLA MEUBLEE AU PLATEAU DE 15 ANS ».
8. **Type ressource :** modèle `Property`, type `Villa`, `status=hebergement`; aucun modèle `AccommodationVisit` séparé.
9. **Lien client :** ObjectId dans `Visite.client`; owner également snapshoté dans `Visite.owner`.
10. **User mobile correspond :** oui au `client`; non au propriétaire du bien.
11. **Statut persisté :** `confirmee` et legacy `Confirmée`.
12. **Statut dashboard :** `Confirmée` via `displayStatus`/`statut`.
13. **Date persistée :** préférée 29/08/2026 à 09:00 ; confirmée via `scheduledStartAt` à 11:00 locale. `dateConfirmee` est null.
14. **Heure début :** 11:00 locale confirmée, 09:00 préférée.
15. **Heure fin :** 13:30 locale.
16. **Fuseau :** champ `Africa/Brazzaville`, valeurs Date stockées en UTC.
17. **Endpoint confirmation :** `PATCH /api/visites/:id` authentifié, capacité `visits.manage`, scope tenant staff/operator.
18. **Payload :** `scheduledStartAt`, `scheduledEndAt`, `meetingAddressSnapshot`, `status=confirmee`.
19. **Réponse :** 200 success avec visite sérialisée staff.
20. **Endpoint mobile :** `/api/visites/owner` pour ce rôle ; `/api/visites/my` existe mais n'est pas sélectionné.
21. **Query backend :** propriétés où `owner=req.user.id`, puis visites dont `property` appartient à cette liste.
22. **User scope :** `req.user.id`, correctement fermé.
23. **Tenant scope :** l'endpoint owner n'élargit pas le tenant ; frontière par propriété possédée. Aucun défaut tenant démontré.
24. **HTTP mobile :** non confirmé directement ; écran vide réel et query backend exacte confirmés.
25. **Raw count :** 0 pour owner ; 1 pour my.
26. **Cible présente brute :** non dans owner, oui dans my.
27. **Mapper :** aucun.
28. **State :** 0 élément depuis owner.
29. **Filtre upcoming :** statut non terminal uniquement, sans date.
30. **Classée passée :** non ; elle n'atteint jamais le filtre.
31. **Pourquoi :** sans objet.
32. **Refocus déclenche fetch :** non, pas de hook focus.
33. **Pull-to-refresh :** oui, force refresh ; résultat toujours vide.
34. **Cold start :** testé ; résultat toujours vide.
35. **Cache impliqué :** présent mais non causal.
36. **Stale state :** exclu comme cause principale.
37. **Property/Accommodation mismatch :** non ; les deux côtés utilisent `Property`.
38. **Status mismatch :** non.
39. **Date/timezone mismatch :** incohérence d'affichage secondaire, non causale.
40. **User ID mismatch :** le client ID est correct ; mismatch entre le contexte owner sélectionné et la relation client attendue.
41. **Backend filter mismatch :** la query owner respecte son contrat, mais ce contrat exclusif ne répond pas au cas dual-role.
42. **Paiement/commission :** aucun filtre de ce type dans owner/my ; `non_requis`, donc non impliqué.
43. **Root cause exacte :** sélection mobile exclusive de `/visites/owner` sur le seul rôle `Proprietaire`, masquant les visites où ce même utilisateur est `client` d'un bien tiers.
44. **Catégorie :** `PRODUCT CONTRACT` + `USER LINK` au point de sélection ; verdict principal G.
45. **Preuve :** cible absente owner (0), présente my (1), user cible = client, owner du bien = autre compte, filtre mobile accepterait `confirmee`.
46. **Fix minimal recommandé :** dissocier le contexte « mes demandes » du contexte « visites de mes biens » pour les comptes dual-role, sans fusionner silencieusement les permissions.
47. **Futur fix backend :** aucun élargissement de `/owner`; conserver son scope. Éventuellement exposer un endpoint agrégé explicitement typé et testé, seulement si le produit le décide.
48. **Futur fix mobile :** rendre accessibles les deux vues ou deux sous-onglets (`/my` et `/owner`) pour un propriétaire, avec libellés non ambigus et listes séparées/dédupliquées.
49. **Futur fix web :** aucun pour la visibilité mobile. Auditer séparément le mélange heure préférée/fin confirmée.
50. **Tests RED :** VisitesScreen avec utilisateur `Proprietaire` ayant une visite client mais aucune visite owner; vérifier que la vue « Mes visites » reste accessible. Ajouter test de sélection des deux contextes et de non-fusion des droits.
51. **Tests GREEN :** endpoint owner reste strict, endpoint my reste strict, dual-role voit les deux contextes, `confirmee` apparaît dans À venir, statuts terminaux restent dans Passées, pull-to-refresh/refocus testés.
52. **Instrumentation retirée :** aucune instrumentation ajoutée.
53. **`git diff --check` :** vert.
54. **Code modifié :** non.
55. **Mongo muté :** non ; lectures `find/select/distinct` uniquement.
56. **Commit :** non.
57. **Push :** non.
58. **Deploy :** non.
59. **Verdict final :** **G. PRODUCT CONTRACT MISMATCH**, avec mismatch de contexte utilisateur démontré.

## Tests existants et lacunes

Les tests actuels couvrent la création/payload mobile, la disponibilité, le modèle, le workflow, les statuts et l'automatisation. Aucun test permanent de `VisitesScreen`, de choix `/my` versus `/owner`, de profil dual-role, de state/upcoming mobile ou de refocus n'a été trouvé. Cette absence explique pourquoi le contrat exclusif par rôle n'est pas protégé.

## Périmètre final

Seul ce rapport a été créé. Aucun fichier web, mobile ou backend fonctionnel n'a été modifié. Aucun secret, jeton, numéro complet ou email complet n'est reproduit dans ce rapport. Aucune mutation Mongo, installation, commit, push ou déploiement n'a été effectué.
