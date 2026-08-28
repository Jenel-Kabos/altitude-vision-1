# DIAG-MOBILE-RECOMMENDED-IMAGE-RUNTIME-1 — Rapport

## Verdict

**E. INCONCLUSIVE — DEVICE RUNTIME EVIDENCE REQUIRED.**

Le défaut est **reproduit visuellement sur le Samsung SM-S918B** : les cartes de « Biens recommandés » sont rendues, leurs badges et textes sont visibles, mais leur zone image reste blanche. La cause exacte n'est toutefois pas certifiable avec l'APK actuellement installé. Cet APK n'est pas `DEBUGGABLE`; il n'a donc pas chargé le bundle Metro instrumenté. Aucun événement `expo-image` (`onLoad`, `onError`, `onLayout`) ni objet/URI runtime provenant de l'exécution fautive n'a pu être capturé.

Les hypothèses réseau, URI, layout, cache, mémoïsation, clipping et rendu Android restent donc **NON CONFIRMÉES**. Aucun correctif spéculatif n'a été appliqué.

## Baseline et périmètre

- Branche : `main`.
- HEAD : `5d605bbd8206088500560f286149c1114c1fb8f4`.
- Worktree initial déjà modifié : `altimmo-app/package.json`, `altimmo-app/package-lock.json`, `ListeAnnoncesScreen.jsx`, `cacheService.js`, `publiciteService.js`; tests Publicités non suivis; rapports Audit/Hotfix Publicités non suivis.
- `HOTFIX-MOBILE-ADS-FETCH-CACHE-1` : préservé intégralement.
- Audit source préalable lu : `server/docs/AUDIT_MOBILE_HOME_IMAGE_PIPELINES1_REPORT.md`.
- Aucun backend, MongoDB, build, déploiement, commit ou push.
- `git diff --check` : vert avant et après le diagnostic.

## Chemins réellement présents

| Étape | À découvrir | Biens recommandés |
|---|---|---|
| Écran Home | `ListeAnnoncesScreen.jsx` | `ListeAnnoncesScreen.jsx` |
| Endpoint | liste publique des propriétés, déjà caractérisée dans l'audit source | `GET /properties/recommended` |
| Service / mapper | données consommées par la card Home | `getRecommendedProperties`; aucun mapper, tableau API retourné tel quel et mis en cache 10 min |
| Card | card interne de `ListeAnnoncesScreen.jsx` | `PropertyCard` dans `RecommendedCarousel.jsx` |
| Image | `expo-image` | `expo-image` |
| URI source | entrée de la galerie `images` | `item.images?.[0] || item.photos?.[0] || null` |
| Prop `source` | `{ uri }` | `{ uri: imgUri }`, sinon placeholder local |
| Dimensions déclarées | largeur/hauteur explicites de galerie | `StyleSheet.absoluteFillObject` dans un parent déclaré `185 × 115` |
| Cache | `memory-disk` | `memory-disk` |
| Liste | galerie horizontale, `removeClippedSubviews={false}` | `FlatList` horizontale, `removeClippedSubviews=true`, `getItemLayout` |

La card recommandée est enveloppée dans `React.memo`. Son parent image utilise `overflow: hidden`/rayon de bord; l'image et le gradient sont absolus. Les badges visibles sur la capture prouvent que le conteneur de carte et la couche supérieure sont montés, mais ne prouvent ni les dimensions natives de l'image ni qu'une couche masque une image chargée.

## Tentative de preuve runtime

Une instrumentation strictement `__DEV__` a temporairement été posée dans `RecommendedCarousel.jsx` pour journaliser un objet recommandé expurgé, l'URI/source finale, `onLoadStart`, `onLoad`, `onError`, `onLoadEnd` et les layouts du parent et de l'image. Elle a ensuite été entièrement retirée; le fichier ne présente plus aucun diff.

Le Samsung était connecté en ADB et le défaut a été reproduit. Le package observé est `com.altitudevision.altimmo`, version `1.0.1`, versionCode `2`. `adb reverse` exposait correctement `tcp:8081`, Metro répondait en mode localhost et le schéma `exp+altimmo-app` est déclaré. Cependant, les métadonnées Android du package indiquent :

```text
flags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP KILL_AFTER_RESTORE ]
```

Le flag `DEBUGGABLE` est absent. L'ouverture du deep link a ramené l'application sur son bundle embarqué; les logs d'instrumentation n'ont jamais été émis et le hotfix Publicités local n'était pas visible non plus. Ce second constat confirme que le code local n'était pas exécuté. Metro a été arrêté après ce constat.

La capture device contient des données de compte et n'est pas jointe au rapport. Elle a uniquement servi à confirmer la reproduction visuelle. Aucune donnée sensible, URL personnelle ou token n'est retranscrit.

## Réponses obligatoires

1. **HEAD ?** `5d605bbd8206088500560f286149c1114c1fb8f4`.
2. **Worktree initial ?** Sale, avec les fichiers listés dans la baseline; changements préexistants préservés.
3. **Hotfix Ads préservé ?** Oui, aucune de ses lignes modifiée.
4. **Home component ?** `ListeAnnoncesScreen.jsx`.
5. **Recommended component ?** `RecommendedCarousel.jsx`, card interne `PropertyCard`.
6. **Image component ?** `Image` de `expo-image`.
7. **Endpoint recommandations ?** `GET /properties/recommended`.
8. **Mapper ?** Aucun; extraction `res.data?.data?.properties || res.data?.properties || []`, cache 10 minutes.
9. **Objet runtime reçu ?** NON CONFIRMÉ sur le bundle fautif; instrumentation non chargée.
10. **Champ image réel ?** Code : `images[0]`, repli `photos[0]`; valeur runtime NON CONFIRMÉE.
11. **URI finale ?** NON CONFIRMÉE sur cette exécution.
12. **URI HTTPS valide ?** Des exemples avaient été validés HTTPS/200/JPEG dans l'audit préalable; identité avec la propriété fautive NON CONFIRMÉE.
13. **onLoad déclenché ?** NON CONFIRMÉ.
14. **onError déclenché ?** NON CONFIRMÉ.
15. **Message exact ?** Aucun événement capturé.
16. **Image mounted ?** Le chemin React et son conteneur sont attendus; montage natif de l'image NON CONFIRMÉ.
17. **Dimensions runtime ?** NON CONFIRMÉES. Dimensions statiques du parent : `185 × 115`.
18. **opacity ?** Aucune opacité restrictive dans le chemin inspecté; état runtime NON CONFIRMÉ.
19. **zIndex ?** Aucun zIndex explicite déterminant observé; état runtime NON CONFIRMÉ.
20. **overflow/clipping ?** Parent avec clipping visuel et liste avec `removeClippedSubviews=true`; responsabilité NON CONFIRMÉE.
21. **overlay présent ?** Oui, gradient absolu transparent vers noir et badges; masquage de l'image NON CONFIRMÉ.
22. **FlatList/ScrollView ?** `FlatList` horizontale.
23. **removeClippedSubviews ?** Oui sur les recommandations; `false` dans la galerie « À découvrir ».
24. **Memoization ?** `PropertyCard` est sous `React.memo`; styles sous `useMemo`.
25. **rerender observé ?** NON CONFIRMÉ.
26. **CachePolicy ?** `memory-disk` pour les deux chemins.
27. **Différence avec « À découvrir » ?** Card et structure de liste différentes; recommandés : image absolute-fill, liste par cards avec clipping actif. Découvrir : dimensions image explicites, galerie interne avec clipping désactivé. Aucune différence n'est démontrée causale.
28. **Reproduit sur Samsung ?** Oui, visuellement sur SM-S918B.
29. **Reproduit sur autre Android ?** NON CONFIRMÉ.
30. **Reproduit iOS ?** NON CONFIRMÉ.
31. **Cause réseau ?** NON CONFIRMÉE.
32. **Cause URI ?** NON CONFIRMÉE.
33. **Cause layout ?** NON CONFIRMÉE.
34. **Cause cache ?** NON CONFIRMÉE.
35. **Cause memo/state ?** NON CONFIRMÉE.
36. **Cause Android-specific ?** NON CONFIRMÉE; seule la reproduction Samsung est acquise, sans comparaison contrôlée.
37. **Root cause CONFIRMÉE ?** Non.
38. **Preuve exacte ?** Preuve du symptôme sur Samsung et preuve que l'APK non-debuggable n'exécutait pas l'instrumentation; aucune preuve causale image.
39. **Fix minimal recommandé ?** Aucun avant capture causale. Étape suivante : installer un vrai development build de la même révision, sans effacer les données du package actuel sans autorisation, puis répéter l'instrumentation.
40. **Fichiers concernés par futur hotfix ?** NON CONFIRMÉ. Candidat d'investigation seulement : `altimmo-app/src/components/RecommendedCarousel.jsx`.
41. **Test RED futur ?** À définir uniquement après preuve runtime; aucun test artificiel créé.
42. **Test GREEN futur ?** À définir avec la cause confirmée et le correctif minimal.
43. **Instrumentation temporaire retirée ?** Oui; diff nul sur `RecommendedCarousel.jsx`.
44. **Code applicatif modifié ?** Non au terme du diagnostic.
45. **Backend modifié ?** Non.
46. **Mongo ?** Aucune lecture/mutation.
47. **Commit ?** Non.
48. **Push ?** Non.
49. **Build ?** Non.
50. **Deploy ?** Non.
51. **Verdict final ?** **E. INCONCLUSIVE — DEVICE RUNTIME EVIDENCE REQUIRED.**

## Condition de reprise

La prochaine session doit utiliser un APK réellement `DEBUGGABLE`/development build correspondant au code local. Une fois le bundle Metro confirmé par l'apparition des traces `RecommendedImageRuntime`, capturer une seule propriété expurgée, l'URI exacte, les quatre événements image et les deux layouts. Ce n'est qu'après cette preuve qu'un verdict A, B, C ou D et un hotfix minimal pourront être proposés.
