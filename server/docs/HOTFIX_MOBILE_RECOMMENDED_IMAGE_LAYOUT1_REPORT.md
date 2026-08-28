# HOTFIX-MOBILE-RECOMMENDED-IMAGE-LAYOUT-1 — Rapport final

## Verdict

**D. HOTFIX NOT CERTIFIED — validation Samsung post-fix bloquée par la déconnexion ADB.**

Le correctif minimal est implémenté, protégé par un RED→GREEN et tous les gates logiciels sont verts. Cependant, le Samsung SM-S918B s'est déconnecté avant la validation du bundle permanent corrigé et n'est pas réapparu après plusieurs contrôles `adb devices -l`. Les critères obligatoires de certification native post-fix — plusieurs cartes, scroll horizontal, navigation retour et refresh — ne peuvent donc pas être déclarés verts.

Ce verdict ne remet pas en cause la preuve A/B du diagnostic précédent : exactement la même règle `width: '100%', height: '100%'` avait produit une image `185.24 × 115.20`, `onLoad` et une image visible sur ce Samsung. Il distingue strictement cette preuve diagnostique de la certification du changement permanent exigée par le présent mandat.

## Baseline et périmètre

- Branche : `main`.
- HEAD initial et final : `5d605bbd8206088500560f286149c1114c1fb8f4`.
- Worktree initial déjà modifié : `altimmo-app/package.json`, `package-lock.json`, `ListeAnnoncesScreen.jsx`, `cacheService.js`, `publiciteService.js`; tests et rapports Publicités non suivis; rapports des diagnostics image non suivis.
- `HOTFIX-MOBILE-ADS-FETCH-CACHE-1` : préservé. Aucune ligne de son implémentation ou de ses tests n'a été modifiée.
- Aucun changement de dépendance, backend, MongoDB ou Cloudinary.
- Aucun commit, push ou déploiement.

## Fix minimal

Fichier : `altimmo-app/src/components/RecommendedCarousel.jsx`.

L'instance `Image` de `expo-image` utilisait `StyleSheet.absoluteFillObject`. Sur le runtime Android/New Architecture observé, ses offsets absolus n'ont pas produit une contrainte verticale exploitable pour cette vue native : le wrapper était bien mesuré à environ 115 px de haut, mais l'image était mesurée à 0 px. Une vue de hauteur nulle ne lançait aucun événement image.

Le fix remplace uniquement ce style par `styles.image`, défini ainsi :

```js
image: {
  width: '100%',
  height: '100%',
}
```

Le wrapper `imageWrap`, ses dimensions `185 × 115`, son overflow, la source `{ uri }`, le fallback local, `contentFit="cover"`, `cachePolicy="memory-disk"`, la transition, le gradient, la card et la `FlatList` sont inchangés.

## RED → GREEN permanent

Nouveau test : `altimmo-app/src/components/__tests__/RecommendedCarouselImageLayout.test.jsx`.

Le test exerce réellement la composition de `RecommendedCarousel` avec un mock ciblé de `expo-image`; il ne prétend pas reproduire le moteur de layout Android.

- RED avant fix : 1 suite en échec, 1 test échoué, 2 tests réussis. Assertion exacte : le style aplati de l'image devait contenir `{ width: '100%', height: '100%' }`; valeur reçue `undefined` avec `absoluteFillObject` dans le renderer Jest.
- GREEN après fix : 1 suite, 3/3 tests verts.
- Contrats protégés : surface explicite du wrapper, source distante `{ uri }`, fallback local lorsque l'image manque.
- Suite ciblée Home/Recommandations/Publicités : 4 suites, 17/17 tests verts.
- Suite mobile complète : 53 suites, 443/443 tests verts.

## Gates

| Gate | Résultat |
|---|---|
| Syntaxe | Vert : 197 fichiers |
| TypeScript | Vert |
| Lint mobile | Vert : 0 erreur, 118 avertissements préexistants |
| Tests ciblés | Vert : 4 suites, 17 tests |
| Tests mobiles complets | Vert : 53 suites, 443 tests |
| Publicités | Vert dans les suites ciblée et complète |
| « À découvrir » | Non modifié; Home et suite complète vertes |
| Expo Doctor | 20/21, sans dégradation |
| Architecture | Non applicable : aucun checker couvrant ce changement local de présentation identifié |
| `git diff --check` | Vert |
| Instrumentation temporaire | Entièrement retirée |

Expo Doctor conserve exactement les cinq écarts patch préexistants :

- `expo` 57.0.17, attendu `~57.0.18`;
- `expo-font` 57.0.1, attendu `~57.0.2`;
- `expo-updates` 57.0.18, attendu `~57.0.19`;
- `eslint-config-expo` 57.0.1, attendu `~57.0.2`;
- `jest-expo` 57.0.4, attendu `~57.0.5`.

## Validation device

La build debug/dev-client installée lors du diagnostic précédent est toujours la stratégie prévue. Une instrumentation DEV temporaire avait été préparée sur le code permanent pour mesurer chaque card, wrapper, image et les événements de chargement. Avant le démarrage de Metro, ADB a signalé `no devices/emulators found`. Plusieurs redémarrages/vérifications non destructifs ont ensuite retourné une liste vide.

L'instrumentation a été retirée sans attendre et aucun log de diagnostic ne demeure. Par conséquent :

- bundle Metro du worktree permanent corrigé : NON CONFIRMÉ sur cette session;
- dimensions runtime post-fix permanent : NON CONFIRMÉES;
- visibilité de plusieurs cartes, scroll horizontal, navigation retour, refresh et smoke Publicités device : NON CONFIRMÉS.

La preuve native antérieure reste : lors de l'A/B diagnostique sur le même Samsung, la règle désormais permanente a donné wrapper `185.24 × 115.20`, image `185.24 × 115.20`, `onLoadStart → onLoad → onLoadEnd`, aucun `onError`, JPEG `521 × 347` depuis le cache disque et image visible. Elle justifie le fix, mais ne remplace pas le gate post-fix demandé.

## Réponses obligatoires

1. **HEAD initial ?** `5d605bbd8206088500560f286149c1114c1fb8f4`.
2. **Worktree initial ?** Sale, changements préexistants documentés et préservés.
3. **Hotfix Publicités préservé ?** Oui.
4. **Fichier exact de la carte recommandée ?** `altimmo-app/src/components/RecommendedCarousel.jsx`.
5. **Composant image exact ?** `Image` de `expo-image`.
6. **Style responsable exact ?** `StyleSheet.absoluteFillObject` sur cette instance image.
7. **Pourquoi height=0 ?** Dans ce runtime Android/New Architecture, les offsets absolus de cette vue `expo-image` n'ont pas résolu une hauteur depuis le wrapper; mesure native certifiée `185.24 × 0`. La preuve A/B montre que des dimensions en pourcentage explicites ferment le contrat. Aucune généralisation à `absoluteFillObject` globalement.
8. **Wrapper modifié ?** Non.
9. **URI modifiée ?** Non.
10. **Mapper modifié ?** Non.
11. **Cloudinary modifié ?** Non.
12. **Backend modifié ?** Non.
13. **Fix permanent exact ?** `style={styles.image}` avec `width: '100%'`, `height: '100%'`.
14. **Utilise-t-il width/height 100% ?** Oui.
15. **RED permanent créé ?** Oui.
16. **RED exact ?** 1 suite, 1 échec/3 tests; contrat de surface explicite absent.
17. **GREEN exact ?** 1 suite, 3/3 tests verts; ciblé global 4 suites, 17/17.
18. **Tests ciblés ?** Nouveau test, recommandations Home, Publicités Home, service Publicités.
19. **Nombre suites/tests ?** Ciblé 4/17; complet 53/443.
20. **Tests Publicités toujours verts ?** Oui.
21. **À découvrir non régressé ?** Tests Home/complets verts et renderer non modifié; validation device post-fix NON CONFIRMÉE.
22. **Samsung SM-S918B utilisé ?** Il avait fourni la preuve A/B; indisponible pour le gate post-fix.
23. **Bundle Metro corrigé confirmé ?** NON CONFIRMÉ, appareil absent d'ADB.
24. **Wrapper runtime après fix ?** Post-fix permanent NON CONFIRMÉ; A/B identique antérieure `185.24 × 115.20`.
25. **Image runtime après fix ?** Post-fix permanent NON CONFIRMÉ; A/B identique antérieure `185.24 × 115.20`.
26. **Image height > 0 ?** Dans l'A/B identique oui; post-fix permanent NON CONFIRMÉ.
27. **onLoadStart ?** A/B identique oui; post-fix permanent NON CONFIRMÉ.
28. **onLoad ?** A/B identique oui; post-fix permanent NON CONFIRMÉ.
29. **onLoadEnd ?** A/B identique oui; post-fix permanent NON CONFIRMÉ.
30. **onError ?** Aucun dans l'A/B; post-fix permanent NON CONFIRMÉ.
31. **Image visuellement affichée ?** Oui dans l'A/B identique; post-fix permanent NON CONFIRMÉ.
32. **Plusieurs recommandations testées ?** En Jest oui; sur device post-fix NON CONFIRMÉ.
33. **Scroll horizontal testé ?** NON CONFIRMÉ post-fix.
34. **Retour navigation testé ?** NON CONFIRMÉ post-fix.
35. **Refresh testé ?** Test Home vert; device post-fix NON CONFIRMÉ.
36. **Instrumentation retirée ?** Oui.
37. **Syntaxe ?** PASS, 197 fichiers.
38. **TypeScript ?** PASS.
39. **Lint ?** PASS, 0 erreur et 118 warnings préexistants.
40. **Expo Doctor ?** 20/21, baseline inchangée.
41. **Architecture si applicable ?** Non applicable.
42. **diff-check ?** PASS.
43. **Cinq écarts Expo inchangés ?** Oui.
44. **Fichiers exacts modifiés par ce hotfix ?** `RecommendedCarousel.jsx`, `RecommendedCarouselImageLayout.test.jsx`, ce rapport.
45. **Modifications préexistantes intactes ?** Oui.
46. **Commit ?** Non.
47. **Push ?** Non.
48. **Deploy ?** Non.
49. **HEAD final ?** `5d605bbd8206088500560f286149c1114c1fb8f4`.
50. **Verdict final ?** **D. HOTFIX NOT CERTIFIED**, uniquement faute de gate Samsung post-fix.

## Gate restant pour certification A

Reconnecter le SM-S918B, démarrer Metro sur le worktree actuel, réintroduire temporairement les callbacks DEV de mesure, puis confirmer plusieurs images avec hauteur non nulle, événements complets et visibilité après scroll, navigation retour et refresh. Retirer ensuite l'instrumentation et refaire `git diff --check`. Aucun autre changement fonctionnel n'est requis à ce stade.
