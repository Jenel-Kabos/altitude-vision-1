# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — MATRICE DES PRÉDICATS (mandat §54)

| Prédicat | Couche | Valeur/logique | Concerne les deux biens également ? |
|---|---|---|---|
| `recommande: true` | BACKEND (`propertyController.js:1154`) | Filtre exact de la requête | Oui — les deux le satisfont |
| `statusAdmin: 'Validée'` | BACKEND (`publicFilter`) | Filtre public standard | Oui — les deux le satisfont |
| `isPublished: true` | BACKEND (`publicFilter`) | Filtre public standard | Oui — les deux le satisfont |
| `availability: 'Disponible'` | BACKEND (`publicFilter`) | Filtre public standard | Oui — les deux le satisfont |
| `pole: 'Altimmo'` | BACKEND (`publicFilter`) | Exclut MilaEvents/Altcom | Oui — les deux sont `Altimmo` |
| Tri `-updatedAt` | BACKEND | Les plus récemment mis à jour en premier | Oui — n'exclut personne ici (seulement 2 résultats au total) |
| `limit(10)` | BACKEND | Maximum 10 résultats | **Non impliqué** — seulement 2 biens marqués `recommande:true` au total, jamais assez pour atteindre la limite |
| Fallback top-10 par prix | BACKEND | Ne s'active que si `recommande:true` ne renvoie aucun résultat | **Non déclenché** — `recommande:true` renvoie déjà 2 résultats, `isFallback: false` confirmé sur la réponse réelle |
| Filtre vente/location | **AUCUN** | — | Confirmé absent à toutes les couches (backend ET mobile) — la section "Biens recommandés" est bien mixte par contrat existant (aucune règle ne restreint à un seul type de transaction) |
| Déduplication | **AUCUNE** | — | Confirmée absente — `RecommendedCarousel.jsx` n'a aucune logique de déduplication, `keyExtractor` utilise `item._id`, sans filtrage préalable |
| Type de bien (`Parcelle`/`Bureau` exclus) | **AUCUN** | — | Confirmé absent — aucune liste `allowedTypes`/`residentialTypes` n'existe sur ce chemin ; le type physique n'a jamais été un discriminant |
| Rafraîchissement du state mobile | **MOBILE** (`ListeAnnoncesScreen.jsx`, avant correctif) | `useEffect([])` au montage uniquement, jamais réinvoqué | **C'est le seul prédicat implicite qui peut faire varier le résultat observé dans le temps** — pas un filtre au sens propre, mais un défaut de fraîcheur des données affichées |

## Conclusion

Aucun filtre vente-only, aucune limite, aucun tri, aucune déduplication, aucune exclusion par type n'explique les symptômes. Le seul point de la chaîne qui peut produire un écart entre "ce que le backend sait" et "ce que l'utilisateur voit" est l'absence de rafraîchissement du state mobile des recommandations.
