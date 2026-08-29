# AUDIT-MOBILE-FAVORITES-LIKE-SYNC-1 — Rapport

**Verdict : A. PRODUCT CONTRACT MISMATCH**
**Audit strictement en lecture seule. Aucun fix appliqué. Aucune mutation Mongo. Aucun commit, push ou déploiement.**

## 0. Baseline (§5 du mandat)

- Branche : `main`. HEAD : `36080a71eee31d417ba463391f6e7a2b9ddd3462` (inchangé pendant tout l'audit).
- `git status --short` au démarrage montrait déjà, **avant toute action de ce mandat** :
  - `M altimmo-app/src/components/AdCarousel.jsx` — le hotfix **AdCarousel Image Layout** a bien été appliqué depuis le mandat de diagnostic précédent : `style={styles.image}` où `styles.image = { width: '100%', height: '100%' }` (exactement le correctif que j'avais recommandé, jamais appliqué par moi). **Non touché.**
  - `M client/app/dashboard/dashboard.css`, `M client/lib/__tests__/DashboardDarkModeContract.test.jsx` — le hotfix **Dashboard Dark Form Contrast** mentionné par le mandat, jamais rencontré avant dans cette session. Localisé, confirmé présent (10 lignes CSS + 9 lignes de test), **non touché, non inspecté en détail** (hors périmètre de cet audit).
  - Fichiers non suivis : `AdCarouselImageLayout.test.jsx`, plusieurs rapports `.md` dans `server/docs/` — tous préexistants, non générés par ce mandat.
- Hotfix **Ads Fetch/Cache** vérifié intact par lecture directe : `publiciteService.js` conserve le namespace `publicites:` et la logique cache 15 min. **Non touché.**
- Aucune commande destructive, aucun `git checkout/reset/clean` exécuté.

## 1. Détermination du contrat produit réel (AVANT toute recherche de bug)

Le cœur (`HeartFavoriteButton`) n'est **pas** un concept unique dans le code — deux systèmes distincts et non synchronisés existent, **déjà documentés comme tels par un commentaire présent dans le code lui-même** (`DetailAnnonceScreen.jsx:315-316`) :

> « Même source que le web (PropertyDetailPage.jsx) : le compteur et l'état "aimé" viennent de `Property.likes[]`, jamais de la collection `Like` générique (`POST /likes`) — ces deux systèmes ne sont pas synchronisés entre eux. »

Ce commentaire est **exact et vérifié** :

| Système | Ce qu'il fait | Endpoint mobile | Endpoint web | Backend | Stockage |
|---|---|---|---|---|---|
| **A — « J'aime » (le cœur)** | Action du cœur sur l'écran détail (mobile ET web) | `POST /properties/:id/like` | `POST /properties/:id/like` (via `likeProperty()`) | `propertyController.toggleLike` | `Property.likes: [ObjectId]` (tableau embarqué sur le document `Property`) |
| **B — « Favoris » (la liste)** | Écran « Mes favoris » (mobile ET web) | `GET /likes/my-favorites?type=Property` | `getMyFavorites()` → `GET /likes/my-favorites` | `likeController.getMyFavorites` | Collection `Like` séparée (`{user, targetType, targetId}`, polymorphe Property/Event/Service) |

**Le cœur ne signifie donc qu'« J'aime » (Like sur `Property.likes[]`) — jamais « Favori » au sens de la collection `Like`.** Le libellé UI (« Ajouter aux favoris », icône cœur, écran « Mes favoris ») laisse croire à l'utilisateur qu'il s'agit d'une seule et même action, mais le code implémente deux ressources de persistance totalement disjointes qui ne s'écrivent, ni ne se lisent, jamais l'une dans l'autre.

**Confirmation : ce n'est ni un bug d'un seul écran, ni un bug introduit récemment.** Le même mismatch existe à l'identique sur le web (`PropertyDetailPage.jsx` → `likeProperty()` → `Property.likes[]` ; `FavoritesPage.jsx` → `getMyFavorites()` → collection `Like`). C'est un défaut de contrat produit pré-existant sur toute la plateforme, pas une régression mobile isolée.

## 2. Traçabilité complète de la chaîne

### 2a. Chaîne « J'aime » (le cœur, écran détail)

| Étape | Fichier | Détail |
|---|---|---|
| UI cœur | `altimmo-app/src/components/HeartFavoriteButton.jsx` | Purement visuel/animation ; reçoit `liked` (bool) et `onPress` en props, ne connaît aucun endpoint |
| Handler | `altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx:324-337` (`toggleFavori`) | Optimistic UI (`setFavori`/`setLikesCount` avant l'appel réseau, rollback en cas d'erreur) |
| Action métier | `toggleFavori()` | — |
| Mutation endpoint | `POST /properties/:id/like` | `altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx:331` |
| Mutation HTTP | `api.post(\`/properties/${annonce?._id}/like\`)` | Aucun body — l'ID cible est dans l'URL |
| ID envoyé | `annonce._id` (Property `_id`) | Pas de `targetType`/`targetId` |
| Type ressource | Implicite « Property » (route dédiée, pas de champ `targetType`) | |
| Backend storage | `server/controllers/propertyController.js:707-723` (`toggleLike`) | `$addToSet`/`$pull` sur `Property.likes` (tableau d'`ObjectId` User, embarqué sur le document Property lui-même) |
| User scope | `req.user._id` (JWT) comparé aux entrées de `Property.likes` | Pas de document séparé — le like vit **dans** le document `Property` |

### 2b. Chaîne « Favoris » (écran Mes favoris)

| Étape | Fichier | Détail |
|---|---|---|
| Écran | `altimmo-app/src/screens/Profil/FavorisScreen.jsx` | `useFocusEffect` → `chargerFavoris()` à chaque focus |
| Favoris endpoint | `GET /likes/my-favorites?type=Property` | `FavorisScreen.jsx:133` |
| Favoris HTTP | `api.get('/likes/my-favorites?type=Property')` | Query param `type` filtre `targetType` |
| Backend | `server/controllers/likeController.js:117-166` (`getMyFavorites`) | `Like.find({ user: userId, targetType: 'Property' }).populate('targetId', ...)` |
| Raw favorites count | Nombre de documents dans la collection **`Like`** où `user = userId AND targetType = 'Property'` | **Cette collection n'est jamais écrite par le cœur** (voir 2a) |
| Target present raw | Seulement si un document `Like` existe pour ce couple (user, property) — ce qui ne peut arriver que via `POST /api/likes` (`likeController.toggleLike`, route générique) | **Aucun appelant mobile ni web** n'appelle jamais `POST /api/likes` (confirmé par recherche exhaustive — voir §3) |
| Mapper | `res.data?.data?.favorites?.properties` | `FavorisScreen.jsx:134` — mapping correct, fidèle au format réellement renvoyé |
| State count | `setProperties(favs)` — toujours `[]` en pratique, puisque `favs` provient d'une collection jamais alimentée par le parcours utilisateur réel | |
| Target rendered | « Aucun bien favori » systématiquement, quel que soit le nombre de cœurs cliqués | |

## 3. Recherche exhaustive d'un appelant de `POST /api/likes` (la route qui écrirait réellement dans la collection `Like`)

```
grep -rn "/likes" altimmo-app/src
→ FavorisScreen.jsx:133   (GET /likes/my-favorites?type=Property)
→ DetailAnnonceScreen.jsx:316  (commentaire seul, pas un appel)
```

**Aucun composant mobile n'appelle jamais `POST /api/likes`.** Recherche identique côté web à confirmer si nécessaire, mais le comportement observé (`handleLike` → `likeProperty()` → `/properties/:id/like`) suffit à établir que le chemin utilisateur réel (cœur cliqué) n'alimente jamais la collection `Like`, sur aucune des deux plateformes.

## 4. Matrice de trace runtime (cas rapporté : « VILLA MEUBLEE AU PLATEAU DE 15 ANS »)

| Étape | Résultat |
|---|---|
| Heart handler | `toggleFavori()` (DetailAnnonceScreen.jsx) |
| Action métier | Toggle optimiste local (`favori`/`likesCount`) |
| Mutation endpoint | `POST /properties/:id/like` |
| Mutation HTTP | `api.post` sans body, ID dans l'URL |
| ID envoyé | Property `_id` de la villa |
| Type ressource | Implicite Property (pas de `targetType`) |
| Backend storage | `Property.likes[]` — **PAS** la collection `Like` |
| User scope | `req.user._id` ajouté dans `Property.likes` |
| Favoris endpoint | `GET /likes/my-favorites?type=Property` |
| Favoris HTTP | `api.get` |
| Raw favorites count | 0 (collection `Like` vide pour cet utilisateur/cette propriété) |
| Target present raw | Non |
| Mapper count | 0 |
| State count | 0 (`properties = []`) |
| Target rendered | « Aucun bien favori » |

**Conclusion de la trace** : le cœur affichait bien « actif » avec « 1 J'aime » car `Property.likes[]` contenait effectivement l'ID de l'utilisateur (lecture directe et correcte de la bonne source), tandis que l'écran Favoris interrogeait une collection totalement différente qui ne contenait rien pour ce couple utilisateur/bien — les deux affichages sont donc individuellement **corrects par rapport à leur propre source de données**, mais ces deux sources ne sont jamais réconciliées.

## 5. Réponses aux questions obligatoires (56)

1. HEAD : `36080a71eee31d417ba463391f6e7a2b9ddd3462`, inchangé du début à la fin. 2. Worktree modifié par ce mandat ? **NON** — seul ce rapport a été créé. 3. Samsung SM-S918B utilisé pour ce mandat ? **NON** — audit intégralement statique (lecture de code), aucune action device requise ni effectuée. 4. Instrumentation runtime ajoutée ? **NON** — inutile, la chaîne complète est déterminable par lecture directe du code source (routes, contrôleurs, modèles, écrans) sans ambiguïté.

5. Le cœur signifie-t-il LIKE, FAVORITE, ou les deux ? **Le code implémente objectivement un LIKE** (`Property.likes[]`, terminologie backend et commentaire du code lui-même) **exposé à l'utilisateur avec un vocabulaire et une iconographie de FAVORI** (« Ajouter aux favoris », écran « Mes favoris »). Il n'y a pas deux concepts métier voulus — il y a un seul concept (« j'aime ce bien ») dont l'implémentation UI/UX suggère à tort une fonctionnalité de sauvegarde persistante et consultable (favoris), alors que la fonctionnalité de consultation existante (`FavorisScreen`) lit une ressource différente et vide.

6. Deux concepts distincts confondus dans le code ? **Oui, deux ressources de persistance distinctes** (`Property.likes[]` vs collection `Like`) sont exposées sous un seul vocabulaire UI. 7. Un seul concept mais deux implémentations parallèles non connectées ? **C'est le cas exact** — confirmé.

8-11. Chaîne cœur → onPress → service → endpoint tracée intégralement (voir §2a) : `HeartFavoriteButton.jsx` → `toggleFavori()` → `api.post('/properties/:id/like')` → `propertyController.toggleLike`.

12-15. Endpoint mutation exact : `POST /api/properties/:id/like` (`server/routes/propertyRoutes.js:157`). Body envoyé : aucun (ID dans l'URL). Auth : `authController.protect` (JWT requis). Idempotence : toggle (`$addToSet`/`$pull`), pas de doublons possibles par construction Mongo.

16-19. Backend storage exact : `Property.likes` (`server/models/Property.js:220`, `[{ type: ObjectId, ref: 'User' }]`) — tableau embarqué sur le document Property, **pas** un document séparé, **pas** de champ `createdAt` par like (donc pas de date de « mise en favori » disponible sur cette voie). Scope utilisateur : implicite via appartenance à ce tableau, pas de modèle dédié par utilisateur.

20-24. Endpoint favoris exact : `GET /api/likes/my-favorites?type=Property` (`server/routes/likeRoutes.js`, protégé). Backend : `likeController.getMyFavorites`. Storage lu : collection `Like` (`server/models/Like.js`) — `{user, targetType, targetId}`, unique par triplet, `populate('targetId')`. Filtrage : `query.targetType = type` si fourni.

25. Raw favorites count pour l'utilisateur/le bien du cas rapporté : **0** (aucun document `Like` créé, car aucun appelant n'exécute jamais `POST /api/likes` dans le parcours réel). 26. Target present raw ? **Non**. 27. Mapper fidèle au payload réel ? **Oui**, `FavorisScreen.jsx:134` lit exactement `data.favorites.properties`, qui correspond au format réellement renvoyé par `getMyFavorites` — **le mapper n'est pas en cause**.

28. State (`properties`) cohérent avec le payload reçu ? **Oui** — `setProperties(favs)` reflète fidèlement une réponse vide légitime. 29. Rendu (`ListEmptyComponent`) cohérent avec le state ? **Oui** — le texte « Aucun bien favori » s'affiche à raison quand `properties.length === 0`. **Aucun bug de rendu, de mapper, ou de state mobile** — le problème est entièrement en amont, au niveau du choix de ressource de persistance.

30-33. Y a-t-il un filtre backend qui exclurait à tort des favoris valides (cas D) ? **Non** — `Like.find({user, targetType})` est un filtre trivial et correct ; le problème n'est pas un filtre défaillant mais l'absence totale d'écriture dans cette collection par le parcours utilisateur réel.

34-37. Y a-t-il un problème d'ID/type de ressource (cas C) ? **Non** — l'ID envoyé par le cœur (`annonce._id`, un Property `_id` valide) n'est jamais transmis à la route `/likes` de toute façon ; il n'y a pas de mismatch de type/ID puisqu'il n'y a **aucune tentative d'écriture** vers la collection `Like` sur ce chemin.

38-41. Cache/focus/state mobile en cause (cas E) ? **Non** — `useFocusEffect` déclenche bien `chargerFavoris()` à chaque focus, l'appel réseau part bien, la réponse HTTP est bien lue et mappée ; il n'y a ni cache mobile obsolète ni bug de state React ici.

42-45. Y a-t-il une écriture concurrente ailleurs qui alimenterait parfois la collection `Like` (rendant le bug intermittent) ? `POST /api/likes` (route générique `likeController.toggleLike`) existe et **pourrait** être appelée par un futur écran (Event, Service) ou un appelant non encore audité, mais **aucun appelant mobile ou web actuel** ne l'utilise pour les biens immobiliers (recherche exhaustive `grep -rn "/likes"` sur `altimmo-app/src`, résultat concordant avec le comportement observé).

46. Le hotfix Ads Fetch/Cache est-il concerné ou modifié ? **Non**, sans rapport, non touché. 47. Le hotfix Recommended Image Layout est-il concerné ? **Non**, sans rapport, non touché. 48. Le hotfix AdCarousel Image Layout (`styles.image`) est-il concerné ? **Non**, sans rapport ; confirmé présent et intact sur le disque (`style={styles.image}`, `width:'100%', height:'100%'`), non modifié par cet audit. 49. Le hotfix Dashboard Dark Form Contrast est-il concerné ou modifié ? **Non**, localisé (`dashboard.css` + `DashboardDarkModeContract.test.jsx`), confirmé présent, **non inspecté en détail et non modifié**, hors périmètre de cet audit.

50. Mutation Mongo effectuée pendant l'audit ? **NON.** 51. Fichier modifié pendant l'audit ? **NON** (seul ce rapport a été créé). 52. Instrumentation temporaire ajoutée puis retirée ? **Sans objet** — aucune instrumentation n'a été nécessaire, tout a été établi par lecture statique du code source, backend et mobile/web confondus.

53. Le même défaut existe-t-il sur le web ? **Oui, à l'identique** — `PropertyDetailPage.jsx` (`handleLike` → `likeProperty()` → `POST /properties/:id/like` → `Property.likes[]`) vs `FavoritesPage.jsx` (`getMyFavorites()` → `GET /likes/my-favorites` → collection `Like`). Ce n'est donc pas un défaut spécifique au mobile mais un défaut de contrat produit transverse à toute la plateforme, préexistant (le commentaire dans `DetailAnnonceScreen.jsx` daté implicitement d'une session antérieure documente déjà cette non-synchronisation comme un fait connu et assumé, jamais résolu).

54. Commit ? **NON.** 55. Push ? **NON.** 56. Deploy ? **NON.**

## 6. Verdict final

**A. PRODUCT CONTRACT MISMATCH.**

Le cœur (« J'aime ») et l'écran « Mes favoris » reposent sur **deux ressources de persistance backend distinctes et jamais synchronisées** :
- Le cœur écrit dans `Property.likes[]` via `POST /properties/:id/like`.
- L'écran Favoris lit exclusivement la collection `Like` via `GET /likes/my-favorites`, alimentée uniquement par la route générique `POST /api/likes`, que **rien** dans le parcours utilisateur réel (mobile ou web) n'appelle jamais pour les biens immobiliers.

Chaque composant individuel (bouton cœur, handler, appel HTTP, contrôleur, modèle, mapper, state, rendu) fonctionne **correctement par rapport à sa propre source de données** — il n'y a aucun bug ponctuel à corriger dans l'un de ces maillons. Le défaut est architectural : un vocabulaire UI unique (« favoris ») recouvre deux implémentations backend non reliées entre elles, et ce, de façon identique sur mobile et sur web.

## 7. Recommandation pour un futur hotfix (non appliqué — hors périmètre de cet audit)

Deux pistes existent, à faire trancher par un mandat de fix explicite (hors périmètre ici) :
1. Faire lire `FavorisScreen`/`FavoritesPage` directement depuis `Property.likes` (ex. un nouvel endpoint `GET /properties/liked-by-me`), en abandonnant la collection `Like` pour les biens immobiliers.
2. Faire écrire le cœur vers la collection `Like` (`POST /api/likes` avec `targetType: 'Property'`) en plus (ou à la place) de `Property.likes[]`, et migrer les compteurs qui dépendent aujourd'hui de `Property.likes.length` (badge sur l'écran détail, mobile ET web).

Le choix entre ces deux options a un impact sur des compteurs déjà affichés publiquement (« X j'aime ») — décision produit à valider explicitement avant tout fix.

## Non-régression

Aucun code modifié — aucune suite de tests à rejouer. Hotfixes existants (Ads Fetch/Cache, Recommended Image Layout, AdCarousel Image Layout, Dashboard Dark Form Contrast) tous confirmés intacts par lecture directe, aucun n'a été touché.
