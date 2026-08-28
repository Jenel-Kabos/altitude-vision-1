# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — FLUX MOBILE RÉEL

## Écran réel

`altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` (929 lignes) — section "Biens recommandés" (`ListHeader`, ligne 574-582), rendue en `ListHeaderComponent` du `FlatList` principal de l'écran "Annonces".

## Chaîne complète (avant correctif)

1. **Hook de chargement** — `useEffect(() => { getRecommendedProperties().then(setRecommended)... }, [])` (ligne 290-293) — appelé **une seule fois**, au montage du composant, jamais réinvoqué ensuite.
2. **Service** — `altimmo-app/src/services/annonceService.js::getRecommendedProperties()` :
   ```js
   export async function getRecommendedProperties() {
     const KEY = 'recommended:properties';
     const hit = cache.get(KEY);
     if (hit) return hit;
     const res = await api.get('/properties/recommended');
     const data = res.data?.data?.properties || res.data?.properties || [];
     cache.set(KEY, data, 10 * 60 * 1000); // cache mémoire 10 minutes
     return data;
   }
   ```
3. **Endpoint réel** — `GET /properties/recommended` (public, sans auth, sans query params).
4. **State** — `recommended` (React state), jamais remis à jour hors de l'effet de montage.
5. **Composant carte** — `RecommendedCarousel.jsx` → `PropertyCard` interne : `const imgUri = item.images?.[0] || item.photos?.[0] || null;` puis `<Image source={imgUri ? { uri: imgUri } : PLACEHOLDER} .../>` — **aucun filtre vente/location, aucune déduplication, aucune classification par type** dans ce composant.
6. **Rafraîchissement (pull-to-refresh)** — `onRefresh` (ligne 358-364, avant correctif) : `cache.invalidate('properties:'); ... chargerPage(1, activeFilters, false);` — **ne touche jamais le préfixe `'recommended:'`, ne rappelle jamais `getRecommendedProperties()`.**
7. **Rafraîchissement au focus d'écran** — `useFocusEffect` (ligne 349-356) : ne vérifie/recharge que le cache `'properties:...'` de la liste principale, jamais les recommandations.

## Conclusion du traçage

**Aucune étape 1 à 5 ne contient de bug** — le service, l'endpoint, le composant carte et sa résolution d'image (`item.images?.[0]`, une chaîne simple, cohérente avec la structure réelle des deux biens en base) sont corrects et fonctionnent pour les deux types de transaction sans distinction. **Le défaut se situe exclusivement aux étapes 6 et 7** : aucun mécanisme ne redéclenche `getRecommendedProperties()` après le montage initial, qu'il s'agisse d'un pull-to-refresh explicite de l'utilisateur ou d'un retour sur l'écran. Voir `_REPORT.md` pour la cause racine unifiée.
