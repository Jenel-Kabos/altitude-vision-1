# HOTFIX-MOBILE-ADCAROUSEL-IMAGE-LAYOUT-1 — Rapport final

## Verdict

**A. MOBILE ADCAROUSEL IMAGE LAYOUT HOTFIX CERTIFIED GREEN.**

Le contrat de surface de l'image `expo-image` de `AdCarousel` utilise désormais une largeur et une hauteur explicites à `100%`. Le test permanent RED → GREEN protège cette régression exacte et la publicité réelle a été validée sur Samsung SM-S918B au démarrage à froid, après actualisation et après reprise de focus.

## Réponses obligatoires

1. **HEAD initial :** `36080a71eee31d417ba463391f6e7a2b9ddd3462` sur `main`.
2. **Worktree initial :** deux rapports non suivis préexistants : `server/docs/DIAG_MOBILE_ADS_EXPO_IMAGE_AB1_REPORT.md` et `server/docs/DIAG_MOBILE_ADS_RUNTIME_FINAL1_REPORT.md`. Ils ont été préservés.
3. **Hotfix Ads Fetch/Cache intact :** oui ; aucun changement du service, namespace, traitement d'erreur, revalidation ou pull-to-refresh.
4. **Hotfix Recommended intact :** oui ; `RecommendedCarousel.jsx` n'a pas été modifié.
5. **Fichier fonctionnel modifié :** `altimmo-app/src/components/AdCarousel.jsx`.
6. **Style problématique exact :** `style={StyleSheet.absoluteFillObject}` sur l'`Image` publicitaire.
7. **RED créé :** oui, `altimmo-app/src/components/__tests__/AdCarouselImageLayout.test.jsx`.
8. **RED exact :** l'assertion attendait `{ width: '100%', height: '100%' }` ; le style reçu ne portait pas ce contrat explicite.
9. **Résultat RED :** 1 suite exécutée, 1 test en échec sur 3 ; les 2 autres tests étaient verts.
10. **Fix exact :** remplacement du style de l'image par `styles.image`, défini avec `width: '100%'` et `height: '100%'`.
11. **Une seule variable fonctionnelle modifiée :** oui, uniquement le contrat de dimensions de l'image.
12. **Source modifiée :** non ; `{ uri: item.media }` est inchangé.
13. **URI modifiée :** non.
14. **`expo-image` remplacé :** non.
15. **Wrapper modifié :** non.
16. **`cachePolicy` modifiée :** non ; `memory-disk` est conservé.
17. **Backend modifié :** non.
18. **Mongo modifié :** non.
19. **Cloudinary modifié :** non.
20. **GREEN ciblé :** oui.
21. **GREEN ciblé étendu :** 5 suites, 20/20 tests verts : contrat AdCarousel, Home/Publicités, Ads Fetch/Cache, contrat RecommendedCarousel et Home/Recommended.
22. **Suite mobile complète :** oui, verte.
23. **Résultat complet :** 54 suites, 446/446 tests verts. L'écart au baseline 53/443 correspond uniquement à la nouvelle suite permanente de 3 tests.
24. **Syntaxe :** verte, 198 fichiers vérifiés sans erreur ; le fichier supplémentaire explique l'écart au baseline 197.
25. **TypeScript :** vert, `tsc --noEmit` retourne 0.
26. **Lint :** vert, 0 erreur et 118 avertissements préexistants.
27. **Expo Doctor :** observation à 20/21, sans dégradation.
28. **Cinq écarts identiques :** oui : `expo`, `expo-font`, `expo-updates`, `eslint-config-expo` et `jest-expo`, uniquement sur leurs versions patch SDK 57.
29. **Samsung utilisé :** oui, SM-S918B, état ADB `device`.
30. **Worktree actuel chargé :** oui ; Metro contrôlé a été démarré avec `--dev-client --localhost --clear`, a reconstruit le bundle Android (2 379 modules), puis le dev-client a été ouvert via `127.0.0.1:8081` avec reverse ADB.
31. **Publicité réelle visible :** oui ; l'image rouge « AGENCE IMMOBILIÈRE ALTITUDE-VISION » était réellement affichée, au-delà du titre/overlay « Altimmo ».
32. **Cold start :** OK, image chargée et visible.
33. **Pull-to-refresh :** OK, image toujours visible ; rechargement depuis le cache mémoire observé.
34. **Refocus :** OK ; navigation vers l'onglet Carte puis retour Home, image toujours visible.
35. **`onLoadStart` :** observé.
36. **`onLoad` :** observé, source native `1627 × 619`, cache disque au cold start puis mémoire.
37. **`onLoadEnd` :** observé.
38. **`onError` :** non observé.
39. **Dimensions instrumentées :** valides et strictement positives ; wrapper environ `312.18 × 220.09`, slide et image `352 × 220.09`.
40. **Recommended intact :** oui ; plusieurs images « Biens recommandés » étaient visibles après cold start et refocus.
41. **À découvrir intact :** oui ; les images ont été contrôlées visuellement après le pull-to-refresh.
42. **Instrumentation retirée :** oui ; aucun marqueur `AdCarouselLayoutGreen` ni callback de diagnostic ne reste dans le composant.
43. **`git diff --check` :** vert.
44. **Fichiers exacts du hotfix :** `altimmo-app/src/components/AdCarousel.jsx`, `altimmo-app/src/components/__tests__/AdCarouselImageLayout.test.jsx` et ce rapport. Les deux rapports de diagnostic non suivis étaient antérieurs et sont restés intacts.
45. **Commit :** non.
46. **Push :** non.
47. **Deploy :** non.
48. **HEAD final :** `36080a71eee31d417ba463391f6e7a2b9ddd3462`, inchangé.
49. **Verdict :** **A. MOBILE ADCAROUSEL IMAGE LAYOUT HOTFIX CERTIFIED GREEN.**

## Preuve RED → GREEN

- RED avant le correctif : 1 suite, 3 tests, 1 échec sur le contrat de surface explicite.
- GREEN après le correctif : 1 suite, 3/3 tests verts.
- Le test Jest protège le contrat responsable ; il ne prétend pas reproduire le moteur de layout Android. La preuve native provient du cycle A/B antérieur et de la validation permanente ci-dessus.

## Diff et périmètre

Le changement de production remplace une seule affectation de style et ajoute un style local de deux propriétés. Aucun wrapper, cadrage, gradient, animation, pagination, source, URI, cache, fallback ou pipeline image n'a changé. Une seule publicité active a été observée ; aucun défilement multi-publicité n'était donc applicable et aucune donnée n'a été créée.

Aucune dépendance n'a été installée, aucun build release n'a été lancé et aucune action backend, MongoDB, Cloudinary, commit, push ou déploiement n'a été effectuée.
