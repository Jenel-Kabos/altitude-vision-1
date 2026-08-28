# AUDIT-MOBILE-HOME-IMAGE-PIPELINES-1 — Rapport

## Verdict

**ROOT CAUSE GLOBALE NON CONFIRMÉE — aucun verdict A, B, C ou D n'est démontré avec l'état courant.**

Les trois payloads publics contrôlés le 2026-08-28 fournissent une URI HTTPS Cloudinary sous forme de chaîne et les trois ressources répondent `200 image/jpeg`. Les dimensions React Native sont non nulles et les trois surfaces utilisent `expo-image` avec une source de forme `{ uri: string }`. Il n'existe donc, dans l'état observé, ni bug de projection backend, ni URL relative/HTTP/privée, ni mismatch objet-chaîne, ni défaut de dimensions expliquant les images absentes.

Deux constats sont néanmoins démontrés :

- le bloc supérieur « Altimmo » visible quand les publicités manquent est le **hero de fallback**, rendu uniquement lorsque `pubs.length === 0`; ce n'est pas une slide de `AdCarousel` dont l'image aurait échoué ;
- le flux publicités est chargé une seule fois, masque toute erreur avec `.catch(() => {})`, n'est pas rechargé au pull-to-refresh, et utilise la clé `publicites:active` alors que la catégorie de cache déclare le préfixe `publicite:`. Une valeur vide mise en cache reste donc visible jusqu'au TTL de 15 minutes et l'invalidation déclarée ne la cible pas. Cette dette explique mécaniquement un hero persistant, mais l'état exact du cache lors de la capture est **NON CONFIRMÉ**.

Pour les recommandations, le payload actuel, l'URI calculée et la ressource distante sont valides. L'état runtime ayant produit la capture (ancienne donnée en cache, erreur native, ou autre) est **NON CONFIRMÉ** faute de device/log `onError`.

## 1. Baseline

- Branche : `main`.
- HEAD : `5d605bbd8206088500560f286149c1114c1fb8f4`.
- Worktree initial : `altimmo-app/package.json` et `altimmo-app/package-lock.json` modifiés avant l'audit (mise à niveau Expo/React Native en cours).
- `git diff --check` initial : vert.
- Aucun code, backend, document Mongo ou cache distant modifié. Aucun test persistant, commit, push, build ou déploiement.

## 2. Cartographie exacte

| Surface | Écran/composant | Endpoint | Extraction mobile | Source image |
|---|---|---|---|---|
| À découvrir | `ListeAnnoncesScreen.jsx` → `AnnonceCard` | `GET /api/altimmo/search?...` | `(item.images || item.photos || []).filter(Boolean)` | `<Image source={{ uri }}>` |
| Biens recommandés | `ListeAnnoncesScreen.jsx` → `RecommendedCarousel.jsx` → `PropertyCard` | `GET /api/properties/recommended` | `item.images?.[0] || item.photos?.[0] || null` | `<Image source={imgUri ? { uri: imgUri } : PLACEHOLDER}>` |
| Publicités | `ListeAnnoncesScreen.jsx` → `AdCarousel.jsx` | `GET /api/publicites/active` | aucune transformation, `item.media` | `<Image source={{ uri: item.media }}>` |

L'écran Home immobilier exact est `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx`. `propertyMapper.js` n'intervient dans aucun de ces trois flux et ne contient actuellement aucune responsabilité de normalisation d'image. Ses consommateurs applicatifs relevés sont les écrans de détail, pour le type d'annonce, les permissions, les conditions, les paramètres de navigation et le prix.

## 3. Payloads réels et URI finales

Les identifiants et chemins sont réduits dans ce rapport ; aucune donnée personnelle, aucun token et aucun secret n'ont été consignés.

| Surface | Objet réel contrôlé | Champ API | URI finale | HTTP | Résultat |
|---|---|---|---|---|---|
| À découvrir | ID suffixé `…495d6591`, 10 images | `images[0]`, chaîne de longueur 113 | `https://res.cloudinary.com/…/properties/tinlup…jpg` | `200 image/jpeg` | OK |
| Recommandés | ID suffixé `…0e727ec4`, 5 images | `images[0]`, chaîne de longueur 86 | `https://res.cloudinary.com/…/xh0ghr…jpg` | `200 image/jpeg` | OK |
| Publicités | ID suffixé `…9cad3586` | `media`, chaîne de longueur 86 | `https://res.cloudinary.com/…/yzsezs…jpg` | `200 image/jpeg` | OK |

Les trois URI finales sont HTTPS, publiques, absolues, sans redirection, et ne requièrent aucune authentification. Aucun cas `{ url, publicId }`, `public_id`, tableau d'objets, chemin relatif, `http://`, `undefined` ou `null` n'a été observé sur ces trois objets réels.

## 4. Backend, Cloudinary et mapping

- `Property.images` est défini par Mongoose comme `[String]`.
- `Publicite.media` est défini comme `String` requis.
- `getRecommendedProperties` utilise `Property.find(...).sort(...).limit(10)` sans `.select()` : `images` n'est pas exclu.
- `getActivePublicites` utilise `Publicite.find(...).sort(...)` sans `.select()` : `media` n'est pas exclu.
- Les endpoints renvoient directement les documents dans `data.properties` et `data.publicites`.
- La création web d'une publicité envoie dans `media` le `secure_url` retourné par Cloudinary.
- Le cloud observé et le format de livraison sont cohérents entre les trois échantillons.
- Les recommandations contournent effectivement `propertyMapper.js`, mais « À découvrir » le contourne aussi et fonctionne avec le même contrat `[String]`; ce contournement n'est donc pas une cause démontrée de l'incident.
- Les publicités ont leur propre service de transport/cache, mais aucun mapper.

## 5. Rendu et dimensions

| Surface | Composant | Dimensions | `contentFit` | Cache | Fallback |
|---|---|---|---|---|---|
| À découvrir | `expo-image` | `CARD_IMG_W × CARD_IMG_H` | `cover` | `memory-disk` | logo local si tableau vide |
| Recommandés | `expo-image` | parent `185 × 115`, image `absoluteFill` | `cover` | `memory-disk` | logo local si URI absente |
| Publicités | `expo-image` | slide `CARD_W × 220`, image `absoluteFill` | `cover` | `memory-disk` | aucun dans la slide ; hero externe si liste vide |

Aucun `height: 0`, `width: 0`, `opacity: 0`, `display: none` ou z-index masquant l'image n'a été trouvé. Les gradients sont superposés mais transparents en haut et ne peuvent expliquer une surface entièrement vide. Les composants n'ont aucun `onError`; aucune erreur native image ne peut donc être attribuée rétrospectivement. ADB ne listait aucun appareil pendant l'audit, donc le résultat `onError` est **NON CONFIRMÉ**.

## 6. Findings démontrés

### MI-F01 — AD HERO IS EMPTY-STATE FALLBACK, NOT A FAILED AD IMAGE

`ListeAnnoncesScreen` rend `AdCarousel` seulement si `pubs.length > 0`. Sinon il rend le hero avec le logo Altimmo. L'apparence rapportée démontre donc un état `pubs=[]`, pas un échec de chargement de `item.media` dans `AdCarousel`.

### MI-F02 — AD LOAD FAILURE IS SILENT AND NOT REFRESHED

`getActivePublicites().then(setPubs).catch(() => {})` est exécuté uniquement au montage. Une erreur laisse `pubs=[]` sans diagnostic. Le pull-to-refresh recharge les annonces et recommandations, mais pas les publicités.

### MI-F03 — AD CACHE PREFIX MISMATCH

Le service stocke `publicites:active`; la catégorie Cache Management déclare `publicite:`. Une invalidation utilisant la catégorie documentée ne touche donc pas la vraie entrée. Le service met également en cache un tableau vide pendant 15 minutes. C'est un défaut déterministe, mais sa présence dans le runtime de la capture reste **NON CONFIRMÉE**.

### MI-F04 — NO IMAGE ERROR OBSERVABILITY

Les trois composants image n'exposent aucun `onError`. Les rejets `expo-image` éventuels sont invisibles et les erreurs de chargement des recommandations/publicités sont également avalées au niveau service/écran.

### Non-findings importants

- **MI-F01 field mismatch recommandé : non confirmé.** `images[0]` est une chaîne valide.
- **MI-F03 ad URL not normalized : non confirmé.** `media` est déjà une URL canonique valide.
- **MI-F04 projection backend : exclu sur le code et les réponses contrôlées.**
- **MI-F05 relative URL : exclu sur les objets contrôlés.**
- **MI-F06 invalid image source : exclu statiquement et par fixture.**
- **Rendering/layout bug : non confirmé.**

## 7. Reproduction par fixtures

Trois fixtures éphémères ont été évaluées sans créer de fichier :

- `PROPERTY_DISCOVER.images[0]` → chaîne HTTPS → `{ uri: string }` ;
- `PROPERTY_RECOMMENDED.images[0]` → chaîne HTTPS → `{ uri: string }` ;
- `ADVERTISEMENT.media` → chaîne HTTPS → `{ uri: string }`.

Les trois résolutions sont valides. Aucun test applicatif n'a été lancé, conformément à la consigne de ne pas lancer toute la suite ; aucune fixture ni instrumentation n'a été laissée dans le dépôt.

## 8. Fix minimal recommandé — non implémenté

1. Ajouter des tests RED ciblés sur la résolution de source des trois surfaces avec chaîne, absence, objet inattendu et URL relative ; conserver le contrat actuel `[String]`/`media: String` comme cas canonique.
2. Pour les publicités, aligner la clé et le préfixe de cache (`publicites:` de manière cohérente), invalider/recharger les publicités au pull-to-refresh et ne plus avaler silencieusement l'échec en développement.
3. Ajouter une instrumentation `onError` expurgée et DEV-only aux trois composants pendant le hotfix/device test, puis la retirer ou la convertir en télémétrie sûre.
4. Reproduire sur Samsung avec le runtime exact, caches données et images vidés, puis capturer l'URI finale et `onError`. Tant que cette preuve manque, ne pas modifier la normalisation des propriétés.
5. Si une forme hétérogène est alors observée, étendre `propertyMapper.js` avec une résolution canonique réutilisée par `AnnonceCard` et `RecommendedCarousel`; ne pas créer un troisième helper. Aucun besoin actuel de modifier le backend n'est démontré.

Fichiers candidats du futur hotfix :

- `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` ;
- `altimmo-app/src/components/RecommendedCarousel.jsx` ;
- `altimmo-app/src/components/AdCarousel.jsx` ;
- `altimmo-app/src/services/publiciteService.js` ;
- `altimmo-app/src/services/cacheService.js` ;
- tests ciblés associés.

## 9. Réponses obligatoires

1. HEAD : `5d605bbd8206088500560f286149c1114c1fb8f4`.
2. Worktree : deux fichiers package mobile pré-modifiés ; ce rapport ajouté.
3. Home exact : `ListeAnnoncesScreen.jsx`.
4. « À découvrir » : `AnnonceCard` interne.
5. « Recommandés » : `RecommendedCarousel` / `PropertyCard`.
6. Publicité : `AdCarousel`; lorsque la liste est vide, hero interne à `ListeAnnoncesScreen`.
7. Endpoint découverte : `/api/altimmo/search?...`.
8. Endpoint recommandations : `/api/properties/recommended`.
9. Endpoint publicités : `/api/publicites/active`.
10. Payload découverte : `images: string[]`.
11. URI découverte : chaîne HTTPS Cloudinary, `200 image/jpeg`.
12. Payload recommandations : `images: string[]`.
13. URI recommandations : chaîne HTTPS Cloudinary, `200 image/jpeg`.
14. Pourquoi elle échoue : **NON CONFIRMÉ** dans l'état courant.
15. Payload publicité : `media: string`.
16. URI publicité : chaîne HTTPS Cloudinary, `200 image/jpeg`.
17. Pourquoi elle échoue : l'écran rapporté est le fallback dû à `pubs=[]`; pourquoi le state était vide : **NON CONFIRMÉ**. Chargement silencieux/cache non rafraîchi démontrés.
18. `propertyMapper` utilisé où : détail/navigation/permissions/conditions/prix, pas Home.
19. Recommandations le contournent : oui.
20. Mapper publicités : non ; service/cache dédié seulement.
21. Projection backend en cause : non.
22. URL relative : non sur les objets contrôlés.
23. Objet vs chaîne : chaîne.
24. HTTP/HTTPS : HTTPS.
25. Auth image : non.
26. Cloudinary : oui, public, ressources accessibles.
27. Dimensions : correctes et non nulles.
28. `onError` : **NON CONFIRMÉ**, callback absent et aucun device ADB.
29. Root cause recommandations : **NON CONFIRMÉE**.
30. Root cause publicités : state vide/fallback confirmé ; cause amont exacte **NON CONFIRMÉE**.
31. Cause commune : **NON CONFIRMÉE**.
32. Fix minimal : observabilité + correction cache/refresh publicités, puis reproduction device avant toute normalisation.
33. Fichiers concernés : liste ci-dessus ; backend non justifié.
34. Tests RED→GREEN : source image des trois fixtures, cache publicités, invalidation et pull-to-refresh publicités, erreur/fallback.
35. Code modifié : non.
36. Backend modifié : non.
37. Mongo : non.
38. Commit : non.
39. Push : non.
40. Build : non.
41. Verdict : **ROOT CAUSE GLOBALE NON CONFIRMÉE — état courant sain, défauts de state/cache/observabilité publicités démontrés.**

