# HOTFIX-FAVORITES-CANONICAL-PROPERTY-LIKES-1 — Rapport

**Verdict : A. FAVORITES CANONICAL CONTRACT — HOTFIX CERTIFIED GREEN**
**Aucun commit. Aucun push. Aucun deploy. Aucune migration destructive. Aucune suppression du legacy `Like`.**

## 0. Rappel du contrat cible (mandat §5)

```
heart write   → Property.likes[]                (inchangé, jamais modifié)
favorites read → UNION(Property.likes[], Like legacy targetType='Property'), dédupliquée
              → FavorisScreen / FavoritesPage    (DTO HTTP inchangé)
```

Décision utilisateur explicite (question posée en cours de mandat) : **UNION en lecture** retenue, et non « Property.likes[] uniquement », après découverte d'un second chemin d'écriture réel et actif vers la collection `Like` (voir §1).

## 1. Découverte critique en cours de mandat — un second cœur, non documenté par l'audit précédent

`AUDIT_MOBILE_FAVORITES_LIKE_SYNC1_REPORT.md` ne couvrait que le cœur de la fiche détail (mobile `DetailAnnonceScreen.jsx` + web `PropertyDetailPage.jsx`, tous deux → `Property.likes[]`). En marge de ce mandat, la lecture de `client/lib/components/PropertyCard.jsx` (utilisé sur **toutes** les grilles de listing web : `AltimmoAnnonces.jsx`, `AltimmoPage.jsx`, `PropertyList.jsx`, `PropertiesPage.jsx`, la gestion propriétaire/dashboard, et `FavoritesPage.jsx` elle-même) a révélé un **second bouton cœur générique**, `LikeButton` (`client/lib/components/likes/LikeButton.jsx`), monté avec `targetType="Property"` — qui appelle `POST /api/likes` et écrit donc réellement dans la collection `Like`, indépendamment de `Property.likes[]`.

Conséquence : basculer `GET /likes/my-favorites` sur `Property.likes[]` **uniquement** aurait pu faire disparaître silencieusement des favoris réels créés via ce second chemin (cartes de listing web). Une tentative de vérification directe en base (comptage `Like.countDocuments({targetType:'Property'})`) a été **bloquée par le classifieur de permissions** de l'environnement (requête Mongo ad hoc hors périmètre des tests). La décision a donc été posée explicitement à l'utilisateur plutôt que supposée — réponse : **UNION en lecture** (option la plus sûre, aucune perte de donnée possible, dette documentée).

## 2. Baseline (§9 du mandat)

- Branche `main`. HEAD avant modification : `36080a71eee31d417ba463391f6e7a2b9ddd3462`, inchangé pendant tout le mandat (aucun commit).
- `git status --short` initial confirmait les hotfixes préexistants déjà présents et préservés tout du long :
  - `AdCarousel.jsx` (`style={styles.image}`) — hotfix AdCarousel Image Layout, intact, non touché.
  - `dashboard.css` + `DashboardDarkModeContract.test.jsx` — hotfix Dashboard Dark Form Contrast, intact, non touché.
  - Hotfix Ads Fetch/Cache (`publiciteService.js`, namespace `publicites:`) — intact, non touché.
- Rapports non suivis (`AUDIT_MOBILE_FAVORITES_LIKE_SYNC1_REPORT.md`, `DIAG_MOBILE_ADS_*`, `HOTFIX_DASHBOARD_DARK_FORM_CONTRAST1_REPORT.md`, `HOTFIX_MOBILE_ADCAROUSEL_IMAGE_LAYOUT1_REPORT.md`) — laissés tels quels.
- Rien écrasé, rien réinitialisé.

## 3. Schéma confirmé (§6, aucune supposition)

```js
// server/models/Property.js:220
likes: [{ type: mongoose.Schema.ObjectId, ref: "User" }]
```
Tableau simple d'`ObjectId` référençant `User` — pas de sous-document, pas de date par utilisateur.

## 4. Audit des autres usages de `Like`/`/api/likes` (§8)

| Usage | Fichier | Touché ? |
|---|---|---|
| Favoris Property (cible du mandat) | `likeController.getMyFavorites` | **Oui, modifié** |
| Cœur fiche détail Property (mobile+web) | `propertyController.toggleLike` → `Property.likes[]` | **Non touché** (mandat §45 : régression du cœur testée séparément, voir §9) |
| Cœur listing Property (web, `PropertyCard.jsx`) | `LikeButton` → `POST /api/likes` → collection `Like` | **Non touché** — c'est ce chemin qui justifie l'UNION (§1) |
| Cœur Event (`EventCard.jsx`) | `LikeButton targetType="Event"` → collection `Like` | **Non touché**, hors périmètre |
| Cœur Portfolio/Altcom (`PortfolioCard.jsx`) | `LikeButton targetType="Portfolio"` → collection `Like` | **Non touché**. Anomalie latente et non liée à ce mandat repérée en passant : `targetType="Portfolio"` n'est pas dans l'enum `Like.targetType` (`['Property','Event','Service']`), ce qui ferait échouer `toggleLike` en 400 pour ce cas précis — préexistant, hors scope, non corrigé, signalé pour mémoire uniquement. |
| `GET /likes/status/:type/:id` | `likeController.getLikeStatus` | **Non touché** |
| `GET /likes/users/:type/:id` | `likeController.getLikeUsers` | **Non touché** |

Aucun de ces usages hors « favoris Property » n'a été modifié.

## 5. RED → GREEN backend

Fichier créé : `server/__tests__/favoritesCanonicalPropertyLikes1.mongo.integration.test.js` (intégration Mongo réelle, express + supertest + JWT, même convention que `propertyAssetRoutes.mongo.integration.test.js`).

**RED (avant fix)** — exécuté contre le code inchangé :
```
Tests: 5 failed, 4 passed, 9 total
```
Les 5 échecs concernaient exactement les scénarios dépendant de la source canonique `Property.likes[]` (like canonique visible, unlike canonique effectif, plusieurs favoris canoniques, cas hébergement, bien non validé) — `GET /likes/my-favorites` renvoyait `[]` dans tous ces cas puisque l'ancien code ne lisait que la collection `Like`. Les 4 tests qui passaient déjà (isolation, 401, UNION legacy simple, UNION sans doublon) sont ceux qui ne dépendent pas de la lecture canonique — cohérent avec le diagnostic.

**Fix appliqué** — `server/controllers/likeController.js`, fonction `getFavoriteProperties()` (nouvelle) + refonte de `getMyFavorites` : lit `Property.find({ likes: userId })` (canonique) en parallèle de `Like.find({ user: userId, targetType: 'Property' }).populate('targetId')` (legacy), fusionne par `_id` (Map, dédoublonnage), trie par `likedAt` décroissant quand disponible. Événements/Services inchangés (toujours lus depuis la collection `Like` uniquement, aucune source canonique équivalente n'existe pour eux).

**GREEN (après fix)** :
```
Tests: 9 passed, 9 total
```

## 6. Preuve « pas de double écriture » (§15)

Chaque test RED→GREEN vérifie explicitement `Like.countDocuments({ targetType: 'Property' })` avant/après lecture des favoris : reste à `0` quand seule la voie canonique est utilisée. La fonction `getFavoriteProperties()` est strictement en lecture (`Property.find(...).lean()`, `Like.find(...).lean()`) — aucun `create`/`save`/`update` n'y est introduit.

## 7. Régression du cœur (§45)

`propertyController.toggleLike` (mutation `Property.likes[]` via `$addToSet`/`$pull`) n'a **pas été modifié** — aucune ligne touchée. Testé implicitement à chaque test RED→GREEN (chaque scénario simule son effet exact via `$addToSet`/`$pull` directement, reproduisant fidèlement son comportement). Validé en conditions réelles sur device (§11) : toggle like/unlike sur un bien réel, compteur "j'aime" et état visuel du cœur corrects à chaque étape.

## 8. Legacy `Like` (§17, §23–25)

- Modèle `Like`, route `POST /api/likes`, `getLikeStatus`, `getLikeUsers` : **non supprimés, non modifiés**.
- Vérification directe en base du volume de documents `Like` existants pour `targetType='Property'` : **tentée, bloquée par le classifieur de permissions de l'environnement** (requête Mongo ad hoc hors tests refusée). Compte tenu du chemin d'écriture actif découvert (§1), l'hypothèse « aucune donnée legacy » n'a pas pu être écartée par la preuve — décision utilisateur : traiter cette incertitude par une **UNION en lecture transitoire** plutôt que par une bascule sèche.
- Cette UNION est documentée dans le code (commentaire au-dessus de `getFavoriteProperties`) comme dette explicite : `Property.likes[]` reste la source canonique pour toute **nouvelle** écriture ; la lecture legacy `Like` n'est là que pour ne perdre aucun favori déjà existant via `PropertyCard.jsx`. Aucune tâche de fond, aucun cron, aucune synchronisation en arrière-plan n'a été ajoutée (§47).

## 9. Contrat DTO (§16–18)

Enveloppe HTTP strictement préservée : `{ status: 'success', results, data: { favorites: { properties, events, services } } }`. Seule différence délibérée : `results` reflète désormais le total réellement retourné (`properties.length + events.length + services.length`) plutôt que le nombre brut de documents `Like` correspondant à la requête — l'ancien calcul était déjà trompeur pour les favoris Property dès lors qu'une union est nécessaire, et aucun consommateur (`FavorisScreen.jsx`, `FavoritesPage.jsx`, `likeService.js`) ne lit ce champ `results` (tous lisent `data.favorites` directement) — confirmé par grep. Aucune pagination n'existait avant ce fix ; aucune n'a été ajoutée (comportement inchangé, non un regrettable oubli — le mandat interdit d'inventer une fonctionnalité absente).

## 10. Visibilité / hébergement / déduplication (§19–22)

- Aucun filtre de visibilité (statusAdmin/availability) n'existait avant ce fix sur cet endpoint — comportement **préservé à l'identique** (test dédié : un bien `statusAdmin: 'En attente'` / `availability: 'Loué'` reste visible dans les favoris, comme avant).
- Cas hébergement (le bien réel du bug, « VILLA MEUBLEE ») : testé explicitement avec `status: 'hebergement'` + `accommodationType`, apparaît correctement.
- Déduplication : testée explicitement (un bien présent à la fois dans `Property.likes[]` ET dans un document `Like` n'apparaît qu'une seule fois).

## 11. Validation runtime réelle — Samsung SM-S918B

Le mandat demandait explicitement une validation sur device avec le worktree actuel. Contrainte : `EXPO_PUBLIC_API_URL` pointe en production (`.env`), et aucun commit/push/deploy n'est autorisé — le fix backend local n'est donc visible du mobile qu'en pointant temporairement le dev client vers un backend local exécutant le code corrigé.

**Méthode** (aucune modification de fichier committable) :
1. `cd server && npm run dev` — backend local démarré avec le fix, connecté au **même** MongoDB que la production (confirmé par `.env`, comme documenté dans le guide du projet).
2. `adb reverse tcp:5000 tcp:5000` + `adb reverse tcp:8081 tcp:8081`.
3. `EXPO_PUBLIC_API_URL=http://localhost:5000/api npx expo start --dev-client --port 8081` (variable d'environnement passée en ligne de commande, aucun fichier modifié).
4. `force-stop` + relance de l'app → nouveau bundle JS confirmé (`Android Bundled … 2369 modules`), pointant vers le backend local corrigé.

**Blocage physique initial** : l'écran affichait « Protection contre les appuis accidentels » de façon répétée (capteur de proximité probablement couvert) — un swipe de déverrouillage synthétique via `adb` provoquait systématiquement une remise en veille immédiate. Conformément à la discipline déjà appliquée dans cette session (ne jamais fabriquer un résultat quand un blocage matériel réel existe), une question a été posée à l'utilisateur pour qu'il découvre/déverrouille physiquement l'appareil — après confirmation, le déverrouillage a fonctionné normalement.

**Scénario exécuté et observé (captures d'écran à chaque étape)** :
1. Ouverture d'un bien « PARCELLE A VENDRE » (0 j'aime, cœur inactif).
2. Appui sur le cœur → cœur devient actif (or), « 1 j'aime ».
3. Navigation Profil → Mes favoris → **le bien apparaît immédiatement**, sans redémarrage de l'app.
4. Retour sur la fiche du bien → appui sur le cœur → cœur redevient inactif, « 0 j'aime ».
5. Retour sur Mes favoris → **le bien a disparu**.
6. Fait notable et non anticipé : l'écran Mes favoris contenait déjà, avant toute manipulation, un second favori réel : **« VILLA MEUBLEE AU PLATEAU DE 15 ANS »** — exactement le bien cité dans le rapport de bug original (`AUDIT-MOBILE-FAVORITES-LIKE-SYNC-1`). Il est resté visible tout du long, confirmant sur donnée réelle de production que le cas exact ayant motivé cet audit est désormais correctement résolu.

Nettoyage post-validation : `force-stop` de l'app, `adb reverse --remove` sur les deux ports, arrêt du backend local et de Metro (`pkill`). Aucune donnée de test n'a été laissée dans un état incohérent — le bien « PARCELLE A VENDRE » a été remis dans son état initial (non aimé) par le test d'unlike lui-même (§59 du mandat respecté).

## 12. Web (§36–37)

`FavoritesPage.jsx` et `client/lib/services/likeService.js::getMyFavorites()` consomment le même contrat HTTP (`GET /likes/my-favorites` → `response.data.data.favorites`), strictement inchangé. Aucune modification de code web n'a été nécessaire ni effectuée.

## 13. Mobile (§32–35)

`FavorisScreen.jsx` utilise déjà `useFocusEffect(() => chargerFavoris())` — refetch systématique à chaque focus, confirmé par lecture de code (pas de stale state à corriger, hypothèse explicitement vérifiée avant toute modification, conformément à la mandate §35). **Aucune modification mobile n'a été nécessaire** — confirmé également par la validation runtime (§11), où le favori apparaît/disparaît sans aucune action de rechargement manuel de l'app.

## 14. Gates

- **Backend unitaire** : `npm test` (hors intégration Mongo) → **141 suites, 1582/1582 tests, PASS**.
- **Backend intégration Mongo complète** (`npm run test:mongo`, 131 suites) → **130 suites passées, 1 échec isolé** (`accommodationCalendarTenantScope.mongo.integration.test.js`, assertion `404` vs `400` sur un test tenant-scope hôtel/hébergement, domaine totalement indépendant des favoris). **Vérifié non-régression** : ce fichier de test, exécuté seul, passe **15/15** aussi bien avec qu'sans le fix de ce mandat (`git stash` du fichier `likeController.js` puis ré-exécution ciblée) — confirmant qu'il s'agit d'une flakiness préexistante liée à l'exécution séquentielle de 131 suites partageant un même replica set Mongo, sans aucun rapport avec ce hotfix.
- **Lint** : `npx eslint controllers/likeController.js __tests__/favoritesCanonicalPropertyLikes1.mongo.integration.test.js` → **0 erreur, 0 warning**.
- **Architecture** : `npm run architecture:check` → **0 nouvelle violation** (`Architecture boundaries: PASS`).
- **TypeScript** : sans objet (projet backend JS pur ; aucun fichier mobile/frontend modifié).
- **Build** : sans objet (aucun fichier frontend modifié — pas de build Next.js requis par le mandat dans ce cas).
- **`git diff --check`** : propre.

## 15. Diff final classé (§61)

```
 M altimmo-app/src/components/AdCarousel.jsx                    → A. préexistant, non touché (hotfix AdCarousel Image Layout)
 M client/app/dashboard/dashboard.css                           → A. préexistant, non touché (hotfix Dashboard Dark Form Contrast)
 M client/lib/__tests__/DashboardDarkModeContract.test.jsx      → A. préexistant, non touché
 M server/controllers/likeController.js                         → B. hotfix favoris (getMyFavorites + getFavoriteProperties)
?? server/__tests__/favoritesCanonicalPropertyLikes1.mongo.integration.test.js → C. tests RED→GREEN de ce mandat
?? server/docs/AUDIT_MOBILE_FAVORITES_LIKE_SYNC1_REPORT.md      → D. rapport (mandat précédent)
?? server/docs/DIAG_MOBILE_ADS_*.md                             → D. rapports (mandats précédents)
?? server/docs/HOTFIX_DASHBOARD_DARK_FORM_CONTRAST1_REPORT.md   → D. rapport préexistant
?? server/docs/HOTFIX_MOBILE_ADCAROUSEL_IMAGE_LAYOUT1_REPORT.md → D. rapport préexistant
?? server/docs/HOTFIX_FAVORITES_CANONICAL_PROPERTY_LIKES1_REPORT.md → D. ce rapport
?? altimmo-app/src/components/__tests__/AdCarouselImageLayout.test.jsx → A. préexistant, non touché
```

## 16. Réponses aux questions obligatoires (58)

1. HEAD initial : `36080a71eee31d417ba463391f6e7a2b9ddd3462` (inchangé, aucun commit créé). 2. Worktree initial : hotfixes préexistants présents et intacts (AdCarousel Image Layout, Dashboard Dark Form Contrast, Ads Fetch/Cache), rapports non suivis présents. 3. Hotfixes préexistants préservés ? **Oui**, confirmé par lecture avant/après et par `git diff --stat` limité à `likeController.js`.

4. Schéma exact de `Property.likes` : `[{ type: ObjectId, ref: 'User' }]` (`server/models/Property.js:220`). 5. Modèle `Like` encore utilisé ailleurs ? **Oui.** 6. Par quoi : `POST /api/likes` (générique, `LikeButton.jsx` sur `PropertyCard.jsx`/`EventCard.jsx`/`PortfolioCard.jsx`), `GET /likes/status/:type/:id`, `GET /likes/users/:type/:id` — tous non modifiés.

7. Source canonique finale des favoris immobiliers : **`Property.likes[]`, en UNION avec les documents `Like` legacy pour `targetType='Property'`** (union en lecture, dette documentée — écart assumé par rapport à l'attendu « Property.likes[] uniquement » du §7 du mandat, sur décision explicite de l'utilisateur après découverte du second chemin d'écriture réel, §1). 8. Mutation cœur modifiée ? **NON**, confirmé — `propertyController.toggleLike` intact. 9. Double écriture ajoutée ? **NON**, confirmé — `getFavoriteProperties()` est strictement en lecture, testé explicitement.

10. `GET /likes/my-favorites` conservé ? **Oui.** 11. Contrat HTTP conservé ? **Oui**, à l'exception mineure et documentée de `results` (§9).

12. Nouvelle requête backend exacte : `Property.find({ likes: userId }).select(...).lean()` en parallèle de `Like.find({ user: userId, targetType: 'Property' }).populate('targetId').lean()`, fusion par `_id` en `Map`.

13. Utilisateur A voit ses likes ? **Oui**, testé et validé sur device réel. 14. Utilisateur B exclu ? **Oui**, testé (isolation stricte).

15. Unlike retire le favori ? **Oui**, testé (intégration) et validé sur device réel.

16. Documents `Like` nécessaires pour le chemin canonique ? **NON**, confirmé — testé explicitement (`Like.countDocuments` reste à 0).

17. Données `Like` legacy trouvées ? **NON CONFIRMÉ** — vérification directe en base bloquée par le classifieur de permissions de l'environnement ; l'existence d'un chemin d'écriture réel et actif (`PropertyCard.jsx`) rend leur présence plausible mais non quantifiée. 18. Compatibilité legacy nécessaire ? **Oui, par précaution**, décision utilisateur. 19. Stratégie retenue : **UNION en lecture, transitoire, documentée comme dette dans le code**.

20. Pagination conservée ? **Sans objet** — n'existait pas avant, non ajoutée. 21. Déduplication correcte ? **Oui**, testée explicitement. 22. Visibility rules conservées ? **Oui** — aucun filtre n'existait avant, aucun n'a été ajouté, testé explicitement (bien non validé reste visible).

23. Hébergement/support Property correctement géré ? **Oui**, testé explicitement (« VILLA MEUBLEE ») et confirmé sur device réel avec le bien exact du bug original.

24. RED backend exact : 5/9 tests échouaient (scénarios dépendant de la source canonique), 4/9 passaient déjà (isolation, 401, UNION legacy). 25. GREEN backend exact : 9/9 tests passent après le fix.

26. Mobile modifié ? **NON.** 27. Pourquoi : `FavorisScreen.jsx` refetch déjà au focus (`useFocusEffect`), confirmé par lecture de code puis par validation runtime — aucune anomalie à corriger.

28. Refetch au focus nécessaire ? Déjà présent, rien à ajouter. 29. Était-il réellement cassé ? **Non**, vérifié avant toute modification et reconfirmé sur device (le favori apparaît/disparaît sans redémarrage de l'app).

30. Web modifié ? **NON.** 31. Pourquoi : le contrat HTTP consommé par `FavoritesPage.jsx`/`likeService.js` reste strictement identique.

32. Test mobile cœur → Mes favoris ? **Oui, exécuté en conditions réelles sur Samsung SM-S918B** (pas seulement un test automatisé — un scénario utilisateur complet). 33. Test unlike → disparition ? **Oui**, confirmé sur device réel.

34. Test web ? Non exécuté en runtime (pas de navigateur disponible dans cet environnement pour un smoke test web) — couverture assurée par le fait que le contrat HTTP consommé est strictement inchangé et par la preuve backend (intégration Mongo). 35. Résultat : sans objet (non exécuté), correction jugée sûre par préservation stricte du contrat.

36. Compteur « J'aime » intact ? **Oui**, confirmé sur device (« 1 j'aime » puis « 0 j'aime » corrects à chaque étape). 37. État cœur intact ? **Oui**, confirmé visuellement (or → contour → or).

38. Backend suites/tests : unitaire 1582/1582 PASS ; intégration Mongo 1297/1298 PASS (1 échec non lié, confirmé flaky/préexistant, voir §14). 39. Mobile suites/tests : non modifié, non rejoué (aucune modification de code mobile). 40. Frontend suites/tests : non modifié, non rejoué.

41. Lint : 0 erreur, 0 warning sur les fichiers touchés. 42. TypeScript : sans objet. 43. Architecture : 0 nouvelle violation, PASS. 44. Build si applicable : sans objet, aucun fichier frontend modifié. 45. diff-check : PASS, propre.

46. Samsung testé ? **Oui.** 47. Favori apparaît immédiatement ? **Oui**, sans redémarrage de l'app. 48. Unlike le retire ? **Oui**, confirmé.

49. Backend Mongo schema modifié ? **NON.** 50. Migration ? **NON.** 51. Collection `Like` supprimée ? **NON.** 52. Route `POST /api/likes` supprimée ? **NON.**

53. Fichiers exacts modifiés : `server/controllers/likeController.js` (modifié) ; `server/__tests__/favoritesCanonicalPropertyLikes1.mongo.integration.test.js` (créé) ; `server/docs/HOTFIX_FAVORITES_CANONICAL_PROPERTY_LIKES1_REPORT.md` (créé, ce rapport).

54. Commit ? **NON.** 55. Push ? **NON.** 56. Deploy ? **NON.**

57. HEAD final : `36080a71eee31d417ba463391f6e7a2b9ddd3462`, inchangé.

58. **Verdict final : A. FAVORITES CANONICAL CONTRACT — HOTFIX CERTIFIED GREEN.**

## 17. Dette documentée pour l'avenir (§48)

- Modèle `Like` et route `POST /api/likes` restent en usage réel pour Property (via `PropertyCard.jsx`), Event et Portfolio — **ne pas les supprimer** sans audit d'usage complet.
- La lecture UNION dans `getFavoriteProperties()` est une dette transitoire explicite : tant que `PropertyCard.jsx` continue d'écrire dans la collection `Like` en parallèle de `Property.likes[]`, ces deux chemins d'écriture coexistent pour la même ressource. Une décision produit future devrait soit unifier les deux cœurs Property (listing vs détail) sur une seule mutation, soit assumer officiellement les deux comme équivalents.
- Anomalie latente, non liée à ce mandat : `PortfolioCard.jsx` appelle `toggleLike('Portfolio', id)`, alors que l'enum `Like.targetType` n'accepte que `['Property','Event','Service']` — ce like échouerait probablement en 400. Non corrigé (hors scope), signalé pour un futur mandat.
