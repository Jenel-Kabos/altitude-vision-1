# DIAG-MOBILE-RECOMMENDED-IMAGE-DEBUG-RUNTIME-2 — Rapport final

## Verdict

**B. ROOT CAUSE CONFIRMED — IMAGE RENDERING LAYOUT COLLAPSE.**

Sur le Samsung SM-S918B avec un vrai development build relié à Metro, l'image `expo-image` de la première carte recommandée reçoit une URI Cloudinary HTTPS et une source `{ uri }`, mais sa hauteur runtime est **0** dans un wrapper de hauteur **115.2**. Dans cet état, aucun `onLoadStart`, `onLoad`, `onError` ni `onLoadEnd` ne se déclenche pour l'image recommandée.

L'expérience A/B temporaire a remplacé uniquement `StyleSheet.absoluteFillObject` par `{ width: '100%', height: '100%' }`. La même image est alors passée à **185.24 × 115.2**, puis a émis `onLoadStart → onLoad → onLoadEnd`, avec une ressource **521 × 347** chargée depuis le cache disque et sans `onError`. L'image est redevenue visible sur le Samsung.

La cause confirmée est donc l'effondrement à zéro de la hauteur calculée par `StyleSheet.absoluteFillObject` sur cette instance `expo-image` dans le runtime Android/New Architecture actuel. Le réseau, Cloudinary, l'URI, la forme de `source`, le cache, le DTO, `React.memo` et le clipping de la `FlatList` ne sont pas la cause du défaut observé.

Conformément au mandat, le changement A/B et toute l'instrumentation ont été retirés. Aucun fix permanent n'est laissé dans le code.

## Baseline

- Branche : `main`.
- HEAD : `5d605bbd8206088500560f286149c1114c1fb8f4`.
- Worktree initial : modifications préexistantes dans `altimmo-app/package.json`, `package-lock.json`, `src/screens/Annonces/ListeAnnoncesScreen.jsx`, `src/services/cacheService.js`, `src/services/publiciteService.js`; deux tests Publicités et trois rapports locaux non suivis.
- `HOTFIX-MOBILE-ADS-FETCH-CACHE-1` : préservé; aucun de ses changements n'a été modifié par ce diagnostic.
- `git diff --check` : vert avant et après nettoyage.

## Expo SDK 57

`npx expo-doctor` : **20/21** contrôles réussis. Le seul contrôle en échec est l'alignement des patchs SDK.

`npx expo install --check` : échec attendu de validation, sans installation ni mutation.

| Paquet | Trouvé | Attendu |
|---|---:|---:|
| `expo` | `57.0.17` | `~57.0.18` |
| `expo-font` | `57.0.1` | `~57.0.2` |
| `expo-updates` | `57.0.18` | `~57.0.19` |
| `eslint-config-expo` | `57.0.1` | `~57.0.2` |
| `jest-expo` | `57.0.4` | `~57.0.5` |

Ces cinq écarts n'ont pas empêché le build debug. Aucun `--force`, `--legacy-peer-deps`, changement de dépendance ou contournement n'a été utilisé.

## Device, APK et Metro

- Device ADB : Samsung `SM-S918B`, état `device`; numéro de série masqué dans ce rapport.
- Package : `com.altitudevision.altimmo`.
- APK remplacée : version `1.0.1`, versionCode `2`, précédemment sans flag `DEBUGGABLE` (constat certifié dans le diagnostic Runtime 1).
- Méthode : `npx expo run:android --no-bundler`, Gradle sous Temurin JDK 17.
- Build : `BUILD SUCCESSFUL` en 11 min 43 s; APK debug locale de 114 MiB.
- Le téléphone s'est déconnecté juste avant l'installation CLI; après reconnexion ADB, `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` a réussi.
- APK installée : `flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP KILL_AFTER_RESTORE ]`.
- Metro : `npx expo start --dev-client --localhost --clear`, tunnel `adb reverse tcp:8081 tcp:8081`.
- Preuve bundle local : `Android Bundled ... index.js (2379 modules)` puis log temporaire `[DiagRecommendedRuntime2] metro-local-bundle` émis par le Samsung.

## Matrice runtime contrôlée

Les identifiants ci-dessous sont limités à huit caractères et ne permettent pas d'exposer une identité utilisateur. Les URI sont des ressources publiques Cloudinary déjà rendues par l'application.

| Signal | À découvrir — contrôle positif | Recommandé — état fautif | Recommandé — A/B temporaire |
|---|---|---|---|
| ID suffixe | `495d6591` | `0e727ec4` | identique |
| URI | HTTPS Cloudinary complète, dossier `altitude-vision/properties` | `https://res.cloudinary.com/dop8vzm5z/image/upload/v1787427247/xh0ghrcipywaqpg3xhsq.jpg` | identique |
| Source | `{ uri }` | `{ uri }` | `{ uri }` |
| Composant | `Image` de `expo-image` | `Image` de `expo-image` | identique |
| Cache policy | `memory-disk` | `memory-disk` | identique |
| Card layout | `344.18 × 382.22` | `184.89 × 228.62` | identique |
| Wrapper layout | `344.18 × 257.78` | `185.24 × 115.20` | identique |
| Image layout | environ `344.18 × 257.78` | **`185.24 × 0`** | **`185.24 × 115.20`** |
| `onLoadStart` | oui | **non** | **oui** |
| `onLoad` | oui | **non** | **oui**, source `521 × 347`, cache `disk` |
| `onError` | non | **non** | non |
| `onLoadEnd` | oui | **non** | **oui** |
| Visible | oui | non | **oui** |

L'objet recommandé observé avait `imagesType=array`, `imagesCount=5`, `photosType=undefined`. L'URI finale provenait bien de `images[0]`. Elle est accessible depuis le Samsung, preuve directe : après correction temporaire de la seule dimension, `expo-image` l'a chargée et rendue sans modifier l'URI ni la politique de cache.

## Classification causale

- Réseau / DNS / TLS / HTTP : écarté pour le cas capturé; la ressource est chargée sur le même Samsung lors de l'A/B.
- URI / DTO / source : écarté; URI HTTPS et `{ uri }` identiques avant/après.
- Décodage : écarté; JPEG décodé en `521 × 347`, aucun `onError`.
- Cache : écarté; même `memory-disk`, chargement réussi depuis `disk` après la seule modification de layout.
- State / `React.memo` : écarté pour le cas capturé; l'objet, l'URI et le composant sont montés avant l'A/B.
- `FlatList` / clipping / recycling : écarté pour le cas capturé; la card et le wrapper ont des dimensions non nulles, et seule la règle de dimension de l'image fait basculer le résultat.
- Layout : **confirmé**; hauteur image `0 → 115.2` avec la seule substitution d'`absoluteFillObject`.
- Android-specific : reproduction et preuve acquises sur Android Samsung/New Architecture; absence de comparaison iOS, donc portée iOS NON CONFIRMÉE.

## Réponses obligatoires

1. **HEAD ?** `5d605bbd8206088500560f286149c1114c1fb8f4`.
2. **Worktree initial ?** Sale, changements préexistants listés dans la baseline et préservés.
3. **Hotfix Ads préservé ?** Oui.
4. **Expo Doctor ?** 20/21; un contrôle d'alignement patch en échec.
5. **Expo install --check ?** Échec de validation avec cinq paquets à mettre à jour; aucune modification.
6. **Quels écarts SDK restent ?** Les cinq lignes du tableau Expo ci-dessus.
7. **Samsung détecté ?** Oui, ADB `device`.
8. **Modèle confirmé SM-S918B ?** Oui.
9. **APK précédent non-debug confirmé ?** Oui; flag `DEBUGGABLE` absent avant remplacement, puis présent sur l'APK debug.
10. **Quelle méthode debug utilisée ?** Build local `expo run:android --no-bundler`, JDK 17, installation ADB, dev-client + Metro localhost via `adb reverse`.
11. **Dev client installé ?** Oui, APK `DEBUGGABLE` contenant `expo-dev-client`/`expo-dev-launcher`.
12. **Metro démarré ?** Oui, avec cache nettoyé.
13. **Samsung exécute bundle Metro ?** Oui.
14. **Preuve ?** Bundle Android reçu et marqueur DEV unique émis depuis `App.js`.
15. **URI Discover ?** HTTPS Cloudinary complète; contrôle capturé dans `altitude-vision/properties`.
16. **URI Recommended ?** `https://res.cloudinary.com/dop8vzm5z/image/upload/v1787427247/xh0ghrcipywaqpg3xhsq.jpg`.
17. **Discover onLoadStart ?** Oui.
18. **Discover onLoad ?** Oui; plusieurs images, cache `disk`/`memory`, dimensions natives valides.
19. **Discover onError ?** Non.
20. **Discover onLoadEnd ?** Oui.
21. **Recommended onLoadStart ?** Non dans l'état fautif; oui après A/B dimensionnel.
22. **Recommended onLoad ?** Non dans l'état fautif; oui après A/B (`521 × 347`, cache `disk`).
23. **Recommended onError ?** Non avant et après A/B.
24. **Message exact ?** Aucun message d'erreur; aucun événement de chargement lorsque la hauteur vaut zéro.
25. **Dimensions Discover ?** Image environ `344.18 × 257.78`.
26. **Dimensions Recommended ?** Fautif `185.24 × 0`; A/B `185.24 × 115.20`; wrapper `185.24 × 115.20`.
27. **Même composant image ?** Oui, `expo-image`.
28. **Même cachePolicy ?** Oui, `memory-disk`.
29. **Même source shape ?** Oui, `{ uri }`.
30. **URI Recommended accessible depuis Samsung ?** Oui, chargée par `expo-image` après le seul changement temporaire de dimensions.
31. **Image charge mais invisible ?** Dans l'état fautif, elle ne démarre pas le chargement car sa hauteur vaut zéro; après A/B, elle charge et devient visible.
32. **Image échoue réellement ?** Non; aucun `onError`.
33. **Aucun event ?** Oui dans l'état fautif pour la recommandation.
34. **FlatList/clipping impliqué ?** Non démontré et écarté par l'A/B ciblé.
35. **Cache impliqué ?** Non.
36. **State/memo impliqué ?** Non.
37. **Layout impliqué ?** Oui, cause confirmée.
38. **Decode impliqué ?** Non.
39. **Network impliqué ?** Non.
40. **Root cause confirmée ?** Oui.
41. **Preuve runtime exacte ?** `height 0` avec `absoluteFillObject`; `height 115.2`, événements complets et image visible avec `width/height 100%`, toutes les autres entrées inchangées.
42. **Fix minimal futur ?** Donner à l'`Image` recommandée des dimensions explicites héritées du wrapper au lieu de `StyleSheet.absoluteFillObject`; conserver `contentFit="cover"` et `memory-disk`.
43. **Fichiers futur hotfix ?** `altimmo-app/src/components/RecommendedCarousel.jsx` uniquement, sous réserve du test ciblé.
44. **Test RED futur ?** Caractériser que la source distante recommandée reçoit une surface non nulle égale au wrapper et que le chemin n'emploie pas la règle fautive.
45. **Test GREEN futur ?** Même test après dimension explicite, plus validation device `onLoad` et visibilité sur Samsung.
46. **Instrumentation retirée ?** Oui; aucun marqueur `DiagRecommendedRuntime2`, callback diagnostic ou A/B ne demeure.
47. **Hotfix Ads intact ?** Oui.
48. **Backend modifié ?** Non.
49. **Mongo ?** Aucune opération.
50. **Commit ?** Non.
51. **Push ?** Non.
52. **Deploy ?** Non.
53. **Verdict ?** **B. ROOT CAUSE CONFIRMED — IMAGE RENDERING LAYOUT COLLAPSE.**

## Futur hotfix minimal proposé, non appliqué

Dans `RecommendedCarousel.jsx`, remplacer uniquement le style `StyleSheet.absoluteFillObject` de l'instance `expo-image` recommandée par une surface explicite couvrant le wrapper, puis ajouter le test de caractérisation et refaire la preuve Samsung. Ne pas modifier le gradient, la `FlatList`, le cache, l'URI, le backend ou Cloudinary.

Metro a été arrêté après capture. La capture d'écran temporaire n'est pas jointe au rapport. Aucun commit, push ni déploiement n'a été effectué.
