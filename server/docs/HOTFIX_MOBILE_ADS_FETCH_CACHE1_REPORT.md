# HOTFIX-MOBILE-ADS-FETCH-CACHE-1 — Rapport final

## Verdict

**A. MOBILE ADS FETCH/CACHE HOTFIX CERTIFIED GREEN.**

Le pipeline publicitaire mobile possède désormais un namespace de cache unique, distingue techniquement chargement/succès avec données/succès vide/erreur, revalide au focus et au pull-to-refresh, et permet les transitions erreur→succès et vide→succès sans redémarrage. Une publicité valide atteint `AdCarousel`; un vrai succès `[]` conserve le fallback Altimmo. Aucun changement n'a été apporté aux recommandations, au backend, à Mongo, à Cloudinary ou au design du carousel.

## Baseline

- Branche : `main`.
- HEAD initial : `5d605bbd8206088500560f286149c1114c1fb8f4`.
- Worktree initial préservé :
  - `altimmo-app/package.json` modifié ;
  - `altimmo-app/package-lock.json` modifié ;
  - `server/docs/AUDIT_MOBILE_HOME_IMAGE_PIPELINES1_REPORT.md` non suivi.
- `git diff --check` initial : vert.
- Le rapport d'audit source a été lu intégralement avant modification.

## Pipeline concerné

`ListeAnnoncesScreen.jsx`
→ callback `loadPublicites`
→ `getActivePublicites`
→ cache mémoire `cacheService`
→ `GET /api/publicites/active`
→ state `pubs` + `pubsLoadState`
→ `AdCarousel` si `pubs.length > 0`, sinon fallback Altimmo.

Il n'existait pas de hook publicité dédié. Le hotfix réutilise les `useFocusEffect` et `RefreshControl` déjà présents dans la Home.

## RED → GREEN

### RED 1 — namespace cache incohérent

Avant correction :

- écriture/lecture du service : `publicites:active` ;
- préfixe de catégorie utilisé pour statistiques/invalidation : `publicite:` ;
- l'invalidation du préfixe déclaré ne supprimait donc pas l'entrée écrite ;
- aucune constante partagée ne verrouillait le contrat.

Le test RED échouait sur le préfixe absent/incohérent et sur la relecture après invalidation.

Correction :

- `PUBLICITES_CACHE_PREFIX = 'publicites:'` ;
- `PUBLICITES_CACHE_KEY = 'publicites:active'` ;
- catégorie Cache Management alignée sur `publicites:` ;
- lecture, écriture, invalidation, statistiques et refresh partagent le même namespace.

Le pluriel est canonique car il était déjà utilisé par le service réel et correspond à la clé de catégorie `publicites`. Le cache est uniquement en mémoire : aucune entrée ne survit au redémarrage d'une installation. Aucune migration legacy n'est nécessaire ; l'ancienne variante singulière n'était pas une clé d'écriture du service.

### RED 2 — erreur silencieuse

Avant correction, `getActivePublicites().then(setPubs).catch(() => {})` absorbait toute erreur. Un échec était visuellement et techniquement assimilé à `pubs=[]`.

Correction : `pubsLoadState` distingue :

- `loading` ;
- `success_with_ads` ;
- `success_empty` ;
- `error`.

En erreur, la Home ne crashe pas, conserve toute publicité déjà chargée et reste retryable. En développement seulement, elle émet :

```text
[Publicites] load failed { code, status }
```

Aucune URL, valeur de payload, clé, header, token ou credential n'est loggé. Lorsque la liste est vide, le fallback conserve une indication d'accessibilité différente entre succès vide et indisponibilité temporaire.

### RED 3 — absence de revalidation

Avant correction, les publicités étaient chargées une fois au montage. Le pull-to-refresh et le refocus ne les rechargeaient pas ; un `[]` pouvait rester servi par le TTL de 15 minutes.

Correction :

- une revalidation forcée a lieu une fois par entrée/focus sur la Home ;
- le pull-to-refresh existant déclenche la même revalidation ;
- `forceRefresh` invalide le namespace canonique avant l'appel réseau ;
- une erreur n'est jamais mise en cache ;
- un succès `[]` reste un résultat valide et cacheable, mais il est contourné au focus/refresh ;
- un succès avec publicités remplace le state et le cache.

La callback de focus est stable et ne dépend d'aucun state qu'elle modifie. Le test prouve un appel initial puis exactement un appel au refocus, sans appel additionnel après rerender.

## Contrat final cache/refresh

| Situation | Comportement |
|---|---|
| Cache valide, appel ordinaire | Retour du cache, sans réseau |
| Entrée/refocus Home | Invalidation `publicites:` puis revalidation réseau |
| Pull-to-refresh | Même revalidation forcée |
| Erreur réseau | Pas de cache écrit, state `error`, retry au prochain trigger |
| Succès `[]` | Cache et state `success_empty`, fallback autorisé |
| Succès avec publicités | Cache et state `success_with_ads`, carousel rendu |
| Erreur après données existantes | Données existantes conservées, carousel non effacé |

Les règles backend existantes (`actif: true`, `pole: 'Altimmo'`) ne sont ni modifiées ni contournées.

## Tests permanents

Deux nouvelles suites, 10 nouveaux tests :

- `publiciteService.test.js` : namespace canonique, write/read/invalidate, succès vide puis force-refresh, erreur non cachée ;
- `ListeAnnoncesScreenPublicites.test.jsx` : succès avec carousel, succès vide avec fallback, erreur observable sans crash, erreur→refresh→succès, vide→refresh→succès, refocus unique sans boucle.

Preuve RED fonctionnelle après correction du seul harnais Reanimated : **2 suites en échec, 7 tests en échec et 3 déjà verts**. Les échecs couvraient le namespace, `forceRefresh`, l'observabilité, le retry et le refocus.

Preuve GREEN ciblée, incluant la suite Home recommandations pour verrouiller le hors-scope :

- **3 suites sur 3 vertes** ;
- **14 tests sur 14 verts** ;
- 0 snapshot.

## Gates

| Gate | Résultat |
|---|---|
| Syntaxe mobile | Vert — 196 fichiers |
| Tests ciblés | Vert — 3 suites, 14 tests |
| Lint mobile | Vert — 0 erreur, 118 avertissements préexistants |
| TypeScript | Vert |
| Architecture mobile | Non applicable — aucun script/checker mobile déclaré |
| Expo Doctor | 20/21 — dette package patch préexistante, indépendante du hotfix |
| `git diff --check` | Vert |
| Android device/emulator | Non disponible via ADB pendant ce travail |

Expo Doctor signale uniquement cinq écarts patch dans l'alignement SDK 57 déjà en cours : `expo`, `expo-font`, `expo-updates`, `eslint-config-expo` et `jest-expo`. Les fichiers package étaient modifiés avant ce mandat ; aucun `--force` ou `--legacy-peer-deps` n'a été utilisé et cette dette n'a pas été élargie.

## Fichiers modifiés par ce mandat

- `altimmo-app/src/services/cacheService.js` ;
- `altimmo-app/src/services/publiciteService.js` ;
- `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` — uniquement state/lifecycle/fallback publicitaires ;
- `altimmo-app/src/services/__tests__/publiciteService.test.js` ;
- `altimmo-app/src/screens/Annonces/__tests__/ListeAnnoncesScreenPublicites.test.jsx` ;
- `server/docs/HOTFIX_MOBILE_ADS_FETCH_CACHE1_REPORT.md`.

Les modifications préexistantes des packages et le rapport d'audit sont conservés. `RecommendedCarousel.jsx`, `propertyMapper.js`, `annonceService.js`, le backend et les fichiers Cloudinary sont inchangés.

## Réponses obligatoires

1. HEAD initial : `5d605bbd8206088500560f286149c1114c1fb8f4`.
2. Worktree initial : deux packages mobiles modifiés, rapport d'audit non suivi.
3. Modifications préexistantes préservées : oui.
4. Home : `ListeAnnoncesScreen.jsx`.
5. Hook/service : aucun hook dédié ; `loadPublicites` + `getActivePublicites`.
6. Endpoint : `GET /api/publicites/active`.
7. Cache helper : `cacheService.cache`.
8. Ancien préfixe d'écriture : `publicites:`.
9. Ancien préfixe de lecture : `publicites:`.
10. Ancien préfixe d'invalidation déclaré : `publicite:` ; la Home n'invalidait pas les publicités.
11. Cause de l'incohérence : clé service plurielle et métadonnée catégorie singulière, sans constante partagée.
12. Préfixe final : `publicites:`.
13. Compatibilité ancien cache : pas de migration nécessaire, cache mémoire non persistant.
14. Gestion : alignement immédiat de la catégorie ; expiration naturelle au plus tard au redémarrage pour tout état mémoire antérieur.
15. `[]` reste valide : oui.
16. Fallback Altimmo conservé : oui.
17. Condition : `pubs.length === 0`, après succès vide ou pendant/à la suite d'une erreur sans donnée antérieure.
18. Ancienne erreur : absorbée silencieusement, state indistinguable d'un vide valide.
19. Nouvelle erreur : state `error`, log DEV expurgé, données antérieures conservées, retry possible.
20. Observable techniquement : oui.
21. Aucun secret loggé : confirmé par le payload de log limité à `code` et `status`.
22. Ancien refresh : annonces/recommandations seulement.
23. Nouveau trigger : focus Home et pull-to-refresh existant.
24. Risque de boucle : fermé par callback stable sans dépendance de state muté.
25. Nombre de fetch : un par focus explicite, un par pull-to-refresh explicite.
26. Cache vide revalidé : oui.
27. Erreur réseau retryable : oui, aucune erreur mise en cache.
28. Erreur→succès : test vert.
29. Vide→succès : test vert.
30. Publicité valide au carousel : test vert.
31. Carousel modifié visuellement : non.
32. Cloudinary modifié : non.
33. Backend modifié : non.
34. Mongo modifié : non.
35. Recommandations modifiées : non.
36. RED cache : reproduit.
37. RED erreur : reproduit.
38. RED refresh : reproduit.
39. GREEN : tous correspondants verts.
40. Tests permanents : oui, 10.
41. Suites/tests ciblés : 3 suites, 14 tests verts.
42. Lint : vert, 0 erreur.
43. Typecheck : vert.
44. Architecture : non applicable au mobile.
45. Expo Doctor : 20/21, cinq écarts patch préexistants documentés.
46. Diff-check : vert.
47. Fichiers exacts : liste ci-dessus.
48. Commit : non.
49. Push : non.
50. Deploy : non.
51. HEAD final : `5d605bbd8206088500560f286149c1114c1fb8f4`.
52. Verdict : **A. MOBILE ADS FETCH/CACHE HOTFIX CERTIFIED GREEN**.

