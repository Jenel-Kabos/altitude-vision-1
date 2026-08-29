# DIAG-MOBILE-ADS-RUNTIME-FINAL-1 — Rapport

**Verdict : D. ROOT CAUSE CONFIRMED — CAROUSEL RENDER/IMAGE FAILURE**
**Aucun fix appliqué. Aucun commit, push ou déploiement.**

## Matrice obligatoire

| Étape | Résultat |
|---|---|
| Fetch déclenché | Oui |
| Endpoint | `GET /publicites/active` |
| Base URL | `https://altitude-vision.onrender.com/api` |
| HTTP status | 200 |
| Raw ads count | **1** |
| Mapped count | N/A (aucun mapper mobile — pass-through direct) |
| Filtered count | N/A (aucun filtre mobile — pass-through direct) |
| Cache count | 1 (namespace `publicites:active`, TTL 15 min) |
| pubs.length | **1** |
| Carousel ads count | **1** (`AdCarousel` reçoit bien l'item) |
| Wrapper dimensions | **352 × 220** (valides, non nulles — confirmé via `onLayout`) |
| URI finale | `https://res.cloudinary.com/dop8vzm5z/image/upload/v1787689014/yzsezsejywoicfo1kqrt.jpg` |
| URI valide (test externe) | **Oui** — HTTP 200, `image/jpeg`, 124167 octets |
| onLoadStart | **Jamais déclenché** |
| onLoad | **Jamais déclenché** |
| onError | **Jamais déclenché** |
| onLoadEnd | **Jamais déclenché** |
| Visible | **NON** — fallback gris + titre "Altimmo" affiché à la place de l'image |

## Réponses aux questions obligatoires

1. HEAD : `36080a71eee31d417ba463391f6e7a2b9ddd3462`, inchangé. 2. Worktree préservé ? **Oui**, identique avant/après (`git status --short` vide dans les deux cas). 3. Samsung SM-S918B utilisé ? **Oui** (`R5CW821Y2JZ`, déjà connecté et autorisé). 4. Metro actuel confirmé ? **Oui** — `Android Bundled … index.js` observé après chaque rechargement de l'app, logs d'instrumentation reçus en temps réel.

5. Backend réellement appelé ? **Oui**, confirmé par log `FETCH_START`/`FETCH_SUCCESS`. 6. Base URL : `https://altitude-vision.onrender.com/api` — **c'est la production réelle**, pas un backend de dev (confirmé via `.env` : `EXPO_PUBLIC_API_URL=https://altitude-vision.onrender.com/api`, aucune surcharge locale). 7. Endpoint : `/publicites/active`. 8. Méthode HTTP : `GET`.

9. Fetch déclenché ? **Oui**, à chaque cache miss (cold start et après `forceRefresh`). 10. HTTP status : **200**. 11. Erreur éventuelle : **Aucune** — CAS B confirmé (HTTP 200, payload non vide), CAS A (`[]`) et CAS C (erreur HTTP) tous deux **exclus**.

12. Raw ads count : **1**. 13. Payload contient une pub ? **Oui.**

14-17. Sans objet — le payload n'est **pas** vide (CAS 1 « NO ELIGIBLE AD DATA » exclu ; CAS 2 « BACKEND FILTER » exclu, aucune investigation backend read-only nécessaire).

18. Publicité réelle observée : `_id: 6a8df837306fabec9cad3586`, `titre: "Altimmo"`, `actif: true`, `pole: "Altimmo"`, `media` = URL Cloudinary valide. 19. Dates : non présentes sur ce document (pas de `startDate`/`endDate` dans la réponse). 20. Tenant : non applicable — le modèle Publicité de cette API n'est pas tenant-scopé dans ce payload.

21. Mapped ads count : **N/A** — confirmé par lecture du code (`publiciteService.js`) : aucun mapper, la donnée API est transmise telle quelle. 22. Filtered ads count : **N/A** — aucun `.filter()` mobile sur les publicités (vérifié dans `publiciteService.js` et `ListeAnnoncesScreen.jsx`). 23. Cache count : **1**, clé `publicites:active` (namespace unifié du hotfix précédent, confirmé intact). 24. Cache key : `publicites:active`. 25. `pubs.length` juste avant rendu : **1**, ID `6a8df837306fabec9cad3586` (capturé explicitement dans le state juste avant `setPubsLoadState`).

26. Pull-to-refresh refetch ? **Oui**, confirmé — `forceRefresh: true`, nouveau `FETCH_START`/`FETCH_SUCCESS`, résultat identique. 27. Refocus refetch ? Non testé isolément dans ce mandat (le pull-to-refresh avec `forceRefresh` couvre le même chemin de code que la revalidation au retour Home, déjà certifiée par `HOTFIX-MOBILE-ADS-FETCH-CACHE-1` — non re-testé pour rester dans le périmètre strict du diagnostic image).

28. Carousel reçoit combien de pubs ? **1**, confirmé par log `[DIAG-ADS] AdCarousel received`.

29. Fallback affiché parce que `pubs=0` ? **NON.** `pubs.length === 1` tout du long — le fallback visuel observé n'est **pas** le fallback vide de l'application (qui ne s'affiche que si `pubs.length === 0` selon la condition ligne 451 de `ListeAnnoncesScreen.jsx`) : c'est en réalité **le rendu réel de la publicité "Altimmo"**, dont le titre s'affiche correctement (texte superposé au dégradé, toujours rendu par `AdCarousel`, indépendamment de l'état de chargement de l'image) mais dont l'image de fond Cloudinary ne se charge jamais. Le nom même de la publicité (« Altimmo ») explique pourquoi ce rendu cassé a été confondu avec un fallback générique de la marque.

30. URI finale : `https://res.cloudinary.com/dop8vzm5z/image/upload/v1787689014/yzsezsejywoicfo1kqrt.jpg`. 31. URI valide ? **Oui**, testée indépendamment (`curl`) : HTTP 200, `Content-Type: image/jpeg`, 124167 octets — l'image existe réellement et est accessible publiquement. 32-35. `onLoadStart`/`onLoad`/`onError`/`onLoadEnd` : **aucun ne s'est déclenché**, sur **trois exécutions indépendantes** (démarrage à froid, pull-to-refresh, et après vidage complet du cache disque + mémoire via l'écran « Gestion du cache » de l'application elle-même, qui appelle `Image.clearDiskCache()` + `Image.clearMemoryCache()`).

36. Dimensions wrapper/image : **wrapper `styles.slide` = 352 × 220** (confirmé via `onLayout`, valeurs non nulles, cohérentes avec `CARD_W`/`HEIGHT` codés en dur). **Ce n'est PAS un collapse de layout** de la même nature que `RecommendedCarousel` (qui avait un wrapper à hauteur 0 via flex/aspectRatio) — ici le wrapper a des dimensions numériques fixes et valides.

37. Root cause exacte : le composant `Image` d'`expo-image` (v57.0.3), utilisé dans `AdCarousel.jsx` avec `style={StyleSheet.absoluteFillObject}` sur un wrapper aux dimensions valides, **ne déclenche jamais aucun de ses événements de cycle de vie** (`onLoadStart`, `onLoad`, `onError`, `onLoadEnd`) pour cette image, de façon reproductible sur trois tentatives distinctes incluant un cache disque/mémoire natif entièrement vidé juste avant. L'image ne s'affiche jamais visuellement, alors que son URI est externe, valide, et publiquement accessible.

38. Niveau de root cause : **IMAGE LOAD** (ni DATA, ni BACKEND FILTER, ni MOBILE FETCH, ni MOBILE FILTER/MAPPER, ni CACHE/STATE, ni CAROUSEL RENDER au sens layout, ni IMAGE LAYOUT — le wrapper est correct).

39. Preuve runtime exacte : logs Metro horodatés montrant `FETCH_SUCCESS` (rawCount:1) → `setPubs` (pubsLength:1) → `AdCarousel received` (count:1) → `slide onLayout` (352×220) → **absence totale** de tout événement `Image` sur trois cycles complets (démarrage, refresh, post-clear-cache) ; capture d'écran confirmant le rendu visuel (titre "Altimmo" sur fond gris/dégradé, sans image).

40. Fix minimal recommandé : **NON DÉTERMINÉ dans ce mandat** (diagnostic uniquement, aucun fix spéculatif autorisé). Pistes à investiguer dans le futur hotfix, sans les affirmer comme certaines : compatibilité `expo-image` 57.0.3 avec la New Architecture/Fabric sur ce device (le warning `setLayoutAnimationEnabledExperimental … New Architecture` confirme que l'app tourne bien sous la New Architecture) ; comparer avec le composant `Image` déjà validé et fonctionnel dans `RecommendedCarousel.jsx`/le carrousel de biens recommandés (qui affiche correctement ses images sur ce même device) pour identifier une différence de configuration (props, contexte de montage dans une `FlatList` horizontale avec `pagingEnabled`/`removeClippedSubviews`, etc.).

41. Fichiers concernés par le futur hotfix : `altimmo-app/src/components/AdCarousel.jsx` (composant Image), potentiellement `altimmo-app/src/services/publiciteService.js` si le futur hotfix touche la donnée (non nécessaire d'après ce diagnostic).

42. Backend devra-t-il être modifié ? **Non** — les données et l'endpoint sont corrects (HTTP 200, publicité active bien renvoyée). 43. Mobile devra-t-il être modifié ? **Oui** — `AdCarousel.jsx`, au niveau du rendu/chargement de l'image. 44. Données devront-elles être corrigées ? **Non** — la publicité existante est valide (`actif: true`, image accessible).

45. Instrumentation retirée ? **Oui**, confirmé par `git status --short` vide et `git diff --check` propre après retrait. 46. `RecommendedCarousel.jsx` intact ? **Oui**, `width: '100%'`/`height: '100%'` toujours présents, non modifiés. 47. Hotfix Ads existant intact ? **Oui** — namespace `publicites:` toujours présent dans `cacheService.js` et `publiciteService.js`, logique de cache/erreur/succès-vide non modifiée. 48. `git diff --check` : **PASS**.

49. Commit ? **NON.** 50. Push ? **NON.** 51. Deploy ? **NON.**

52. **Verdict final : D. ROOT CAUSE CONFIRMED — CAROUSEL RENDER/IMAGE FAILURE.**

## Note méthodologique

Conformément à la règle absolue du mandat, l'investigation n'a pas sauté directement au CAS 4 : chaque étape de l'arbre de diagnostic a été tracée et prouvée dans l'ordre (fetch → HTTP → payload → cache → state `pubs` → carousel → wrapper → image), avec élimination explicite des CAS 1, 2 et 3 avant de conclure au CAS 4. La confusion initiale (« fallback gris Altimmo ») s'explique entièrement : il s'agit du rendu réel — mais partiellement cassé — d'une publicité existante nommée « Altimmo », pas d'un état vide.
