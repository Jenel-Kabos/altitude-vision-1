# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — MATRICE END-TO-END (mandat §52)

| Layer | Parcelle (vente) | Bureau (location) |
|---|---|---|
| Mongo (lecture directe) | **present** — `recommande:true`, filtre public satisfait, `images` = 5 chaînes valides | **present** — `recommande:true`, filtre public satisfait, `images` = 7 chaînes valides |
| Backend query (`getRecommendedProperties`, `propertyController.js:1146-1174`) | **present** — aucun filtre vente/location dans `publicFilter`, aucune exclusion par `type` | **present** — idem |
| HTTP JSON (vérifié en direct sur la production) | **present**, `images` = tableau de chaînes | **present**, `images` = tableau de chaînes |
| Mobile service (`getRecommendedProperties`, `annonceService.js`) | **present à l'appel réseau** — mais **résultat mis en cache mémoire 10 min**, potentiellement une capture antérieure à la marque `recommande`/à la correction des images | **present à l'appel réseau**, même remarque |
| Normalizer | **N/A — aucun normalizer n'existe sur ce chemin** (`RecommendedCarousel`/`ListeAnnoncesScreen.jsx` consomment `item.images`/`item.photos` bruts, sans passer par `propertyMapper.js`) | idem |
| Filter (mobile) | **present — aucun filtre vente/location appliqué** (`RecommendedCarousel.jsx` n'a aucun `.filter()`) | **present**, même constat |
| State (`recommended`) | **present si l'appel a eu lieu APRÈS que les deux biens soient devenus éligibles ; sinon bloqué à l'ancien contenu du cache/état, jamais rafraîchi (bug)** | idem |
| Render (`PropertyCard` dans `RecommendedCarousel.jsx`) | **present si `state` à jour** — `imgUri = item.images?.[0]`, une chaîne valide, s'affiche correctement | **present si `state` à jour** |

## Lecture de la matrice

La colonne "present/absent" est identique pour les deux biens à **chaque étape testable indépendamment de l'état du cache mobile** (Mongo, backend query, HTTP JSON) — confirmant qu'il n'existe aucune divergence de traitement entre un bien en vente et un bien en location, ni de perte d'image en base ou en transit HTTP. La seule étape où un décalage peut se produire est le **state mobile**, gelé par le cache 10 minutes et l'absence de tout mécanisme de rafraîchissement (pull-to-refresh, focus d'écran) pour ce state spécifique — voir `_FILTER_MATRIX.md`/`_REPORT.md`.
