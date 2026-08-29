# DIAG-MOBILE-ADS-EXPO-IMAGE-AB-1 — Rapport

**Verdict : A. ROOT CAUSE CONFIRMED — EXPO-IMAGE PROP/CONFIGURATION**
**Aucun fix permanent appliqué. Aucun commit, push ou déploiement.**

## Table des A/B

| Expérience | Changement | onLoadStart | onLoad | onError | Visible |
|---|---|---:|---:|---:|---:|
| Baseline | aucun (`style={StyleSheet.absoluteFillObject}`) | Non | Non | Non | Non |
| Source shape | Non testé — déjà identique (`{uri: string}`) dans les deux composants, confirmé par lecture de code | N/A | N/A | N/A | N/A |
| **Style** | `style={{ width: '100%', height: '100%' }}` (identique à `RecommendedCarousel`) | **Oui** | **Oui** | Non | **Oui** |
| Restore (style d'origine) | retour à `StyleSheet.absoluteFillObject` | Non | Non | Non | Non |
| Réapplication du changement | `style={{ width: '100%', height: '100%' }}` | **Oui** | **Oui** | Non | **Oui** |
| Props minimales | Non nécessaire — root cause déjà isolée de façon déterministe | N/A | N/A | N/A | N/A |
| Placeholder off | Non nécessaire (`AdCarousel` n'utilise aucun `placeholder`) | N/A | N/A | N/A | N/A |
| Transition off | Non nécessaire — root cause déjà isolée | N/A | N/A | N/A | N/A |
| CachePolicy | Non nécessaire — identique dans les deux composants (`memory-disk`) dès le départ | N/A | N/A | N/A | N/A |
| recyclingKey off | Non applicable — `AdCarousel` n'utilise pas `recyclingKey` | N/A | N/A | N/A | N/A |
| Known-good URI | Non nécessaire — la ressource elle-même n'a jamais été suspecte (déjà validée par `curl` dans le mandat précédent) | N/A | N/A | N/A | N/A |
| RN Image | Non nécessaire — root cause isolée sans avoir besoin de changer de composant de chargement | N/A | N/A | N/A | N/A |

**Stop early appliqué conformément au mandat (§41)** : dès que le cycle Baseline(FAIL) → Changement(PASS) → Restore(FAIL) → Réapplication(PASS) a produit une preuve déterministe sur la variable unique « style de l'Image », aucune expérience supplémentaire n'a été menée.

## Réponses aux questions obligatoires

1. HEAD : `36080a71eee31d417ba463391f6e7a2b9ddd3462`, inchangé. 2. Worktree initial : identique après nettoyage (`git status --short` ne montre que le rapport du mandat précédent, aucun autre résidu). 3. Samsung SM-S918B utilisé ? **Oui**, déjà connecté et autorisé (`R5CW821Y2JZ`). 4. Metro actuel confirmé ? **Oui**, bundle reconstruit à chaque relance (`Android Bundled … index.js`), logs d'instrumentation reçus en direct.

5. Version expo-image : **57.0.3** (inchangée, non mise à jour). 6. Import exact `AdCarousel` : `import { Image } from 'expo-image';`. 7. Import exact `RecommendedCarousel` : `import { Image } from 'expo-image';` — **identique**.

8. Même composant expo-image ? **Oui**, aucun wrapper maison, import direct identique dans les deux fichiers. 9. Même wrapper maison ? Sans objet (aucun wrapper maison). 10. Même source shape ? **Oui** — `{ uri: <string> }` dans les deux cas (`AdCarousel` : `{uri: item.media}` ; `RecommendedCarousel` : `imgUri ? {uri: imgUri} : PLACEHOLDER`, la branche pertinente ici étant identique).

11. Source `AdCarousel` exacte : `{ uri: item.media }` où `item.media` = URL Cloudinary. 12. Source `RecommendedCarousel` exacte : `{ uri: imgUri }` (même forme, valeur différente).

13. Props différentes entre les deux composants ? **Oui.** 14. Quelles différences : la **seule** différence structurelle pertinente identifiée est le **style de l'Image** — `AdCarousel` utilisait `style={StyleSheet.absoluteFillObject}` (positionnement absolu avec `top/left/right/bottom:0`), tandis que `RecommendedCarousel` utilise `style={{width:'100%', height:'100%'}}` (dimensionnement relatif). Toutes les autres props communes (`contentFit="cover"`, `cachePolicy="memory-disk"`, `transition`, `accessible={false}`) sont fonctionnellement équivalentes entre les deux composants (seule la durée de `transition` diffère : 300 vs 250, non testée séparément car non pertinente une fois la root cause isolée).

15. `AdCarousel` Image réellement montée ? **Oui**, confirmé par le mandat précédent (`onLayout` du wrapper à 352×220) et par ce mandat (le remplacement de la seule prop `style` suffit à faire fonctionner l'Image, prouvant qu'elle était bien montée mais bloquée avant tout démarrage de chargement). 16. Baseline : `onLoadStart` = Non, `onLoad` = Non, `onError` = Non, `onLoadEnd` = Non — reproduit à l'identique dans ce mandat avant toute expérience.

17. A/B source shape : **non testé isolément** (déjà prouvé identique par lecture de code — tester une shape déjà identique n'aurait aucune valeur probante). 18. Résultat : N/A.

19. A/B style : **Oui**, testé. 20. Résultat : `style={{width:'100%', height:'100%'}}` → `onLoadStart` ✓, `onLoad` ✓, `onLoadEnd` ✓, image visible à l'écran (« AGENCE IMMOBILIÈRE ALTITUDE-VISION » nettement affichée).

21. A/B props minimales : **non nécessaire** — root cause déjà isolée de façon déterministe au A/B précédent. 22. Résultat : N/A.

23. Placeholder impliqué ? **Non** — `AdCarousel` n'a jamais utilisé de prop `placeholder`. 24. Transition impliquée ? **Non** — la transition (300ms) était identique dans le test qui a échoué et celui qui a réussi ; seule la prop `style` a changé. 25. `cachePolicy` impliquée ? **Non** — `cachePolicy="memory-disk"` était identique dans les deux composants dès le départ et n'a jamais été modifiée pendant les tests. 26. `recyclingKey` impliquée ? **Non applicable** — jamais utilisé par `AdCarousel`. 27. React `key` impliquée ? **Non** — `keyExtractor` inchangé pendant toute la session, seule la prop `style` de l'`Image` a varié.

28-29. URI Recommended connue testée dans `AdCarousel` ? **Non testé** — devenu inutile une fois la root cause isolée sur la prop `style` avec l'URI publicitaire elle-même (test plus direct et suffisant). 30-31. URI publicité hors `AdCarousel` ? **Non testé séparément** — la ressource avait déjà été validée hors application par `curl` dans le mandat précédent (HTTP 200, JPEG réel) ; ce mandat a prouvé qu'elle se charge également **à l'intérieur** de `AdCarousel` dès que le style est corrigé, ce qui est une preuve strictement plus forte. 32-33. React Native Image A/B ? **Non nécessaire** — la root cause a été isolée sans changer de composant de chargement, evitant tout scope creep.

34. Resource-specific ou AdCarousel-context-specific ? **Ni l'un ni l'autre au sens strict du mandat** — la root cause est **prop-specific** (la valeur de la prop `style` passée au composant `Image` d'`expo-image`), reproductible de façon déterministe indépendamment de la ressource (l'URI Cloudinary n'a jamais changé pendant les tests) et sans changer de composant de chargement.

35. Root cause minimale confirmée ? **Oui.** 36. Expérience exacte, FAIL → PASS : changement de `style={StyleSheet.absoluteFillObject}` vers `style={{width:'100%', height:'100%'}}` sur le composant `Image` de `AdCarousel.jsx`, aucune autre prop modifiée. 37. Restore → repasse FAIL ? **Oui**, confirmé (retour à `absoluteFillObject` → zéro événement, reproduit à l'identique). 38. Réapplication → repasse PASS ? **Oui**, confirmé (retour à `{width:'100%',height:'100%'}` → cycle complet à nouveau, image visible).

39. Futur fix minimal recommandé : dans `AdCarousel.jsx`, remplacer `style={StyleSheet.absoluteFillObject}` par `style={{width:'100%', height:'100%'}}` sur le composant `Image` (le `View` wrapper `styles.slide` n'a besoin d'aucune modification, il a déjà des dimensions numériques valides). 40. Fichier(s) à modifier : uniquement `altimmo-app/src/components/AdCarousel.jsx`.

41. Peut-on conserver expo-image ? **Oui**, sans réserve — le composant fonctionne parfaitement une fois la prop `style` corrigée. 42. Faut-il réellement passer à React Native Image ? **Non, absolument pas nécessaire** — cela aurait été une régression architecturale inutile pour un problème qui se résume à une seule prop de style.

43. Backend modifié ? **NON.** 44. Mongo ? **NON.** 45. Cloudinary ? **NON.** 46. Dependencies ? **NON** — `expo-image` toujours en version 57.0.3, aucune commande d'installation exécutée. 47. Cache Ads modifié ? **NON** — `publiciteService.js`/`cacheService.js` non touchés dans ce mandat. 48. `RecommendedCarousel` permanent modifié ? **NON** — utilisé uniquement comme référence de lecture, jamais édité.

49. Instrumentation retirée ? **Oui**, confirmé — `AdCarousel.jsx` restauré exactement à son état d'origine (`style={StyleSheet.absoluteFillObject}`, sans handlers `onLoadStart`/`onLoad`/`onError`/`onLoadEnd`), `git status --short` ne montre plus que le rapport du mandat précédent. 50. `git diff --check` : **PASS**, propre.

51. Commit ? **NON.** 52. Push ? **NON.** 53. Deploy ? **NON.**

54. **Verdict final : A. ROOT CAUSE CONFIRMED — EXPO-IMAGE PROP/CONFIGURATION** (la prop `style` de l'`Image`, spécifiquement l'usage de `StyleSheet.absoluteFillObject` au lieu d'un dimensionnement relatif `{width:'100%', height:'100%'}`).

## Non-régression

Suite de tests mobile complète rejouée après restauration : **53 suites, 443/443 tests, PASS.** `RecommendedCarousel.jsx` et le hotfix Ads Fetch/Cache (`publicites:` namespace) vérifiés intacts par lecture directe.

## Recommandation pour le futur hotfix

Le correctif minimal identifié est trivial et à très faible risque : changer une seule ligne de style dans `AdCarousel.jsx`, en réutilisant exactement le pattern déjà certifié et fonctionnel de `RecommendedCarousel.jsx`. Aucune nouvelle architecture, aucune dépendance supplémentaire, aucun changement de composant de chargement n'est nécessaire.
