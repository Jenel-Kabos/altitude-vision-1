# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — RAPPORT FINAL

## 1. Résumé

Audit end-to-end complet (Mongo réel en lecture seule, requête directe à l'API de production, lecture de tout le code mobile concerné). **Contrairement à l'hypothèse de deux bugs distincts, les preuves convergent vers une cause racine UNIQUE et unifiée** : la section "Biens recommandés" de l'écran mobile (`ListeAnnoncesScreen.jsx`) n'est chargée qu'une seule fois au montage du composant, et **aucun mécanisme (pull-to-refresh, retour sur l'écran) ne la recharge jamais** — combiné à un cache mémoire 10 minutes côté service. Le backend, vérifié en direct sur la production au moment de l'audit, renvoie déjà correctement les deux biens du rapport, avec leurs images. Les symptômes observés sont cohérents avec un state mobile figé, capturé avant que les données (marquage recommandé du Bureau, images de la Parcelle) ne soient complètes côté admin. Correctif minimal : le pull-to-refresh invalide désormais aussi le cache des recommandations et les recharge. Aucune règle métier, aucun filtre public, aucune règle de recommandation modifiée.

## 2. ROOT CAUSE A — IMAGE (Parcelle)

**Aucun bug de code trouvé dans le chemin de résolution d'image.** `Property.images` est un tableau de chaînes valides (confirmé en base et via l'API de production), `RecommendedCarousel.jsx::PropertyCard` résout `item.images?.[0]` correctement (chaîne directe, jamais un objet), et `expo-image` reçoit une `uri` valide. Le symptôme observé est expliqué par la cause racine unifiée ci-dessous (state mobile figé, capturé avant que l'image ait été renseignée/corrigée côté admin) — **pas un défaut de code de résolution d'image**.

## 3. ROOT CAUSE B — LOCATION ABSENTE (Bureau)

**Aucun filtre vente-only, aucune exclusion par type, aucune limite/tri/déduplication n'exclut le Bureau** — confirmé à toutes les couches (Mongo, requête backend, JSON de production, code mobile). Le backend renvoie déjà les deux biens ensemble au moment de l'audit. Le symptôme est expliqué par la **même cause racine unifiée** : le state mobile des recommandations, chargé une seule fois au montage, ne s'est jamais mis à jour après que le Bureau a été marqué recommandé.

## 4. CAUSE RACINE UNIFIÉE (mandat §31 — preuve, pas suffisance)

Les deux symptômes partagent une seule et même explication structurelle, prouvée par lecture de code puis par test rouge→vert : `ListeAnnoncesScreen.jsx` charge les recommandations une fois (`useEffect([])`), les met en cache 10 minutes (`annonceService.js`), et **ne les recharge jamais**, ni au pull-to-refresh ni au focus d'écran. Ce n'est pas une supposition : le test `ListeAnnoncesScreenRecommended.test.jsx` reproduit exactement ce mécanisme (1er état incomplet, pull-to-refresh, 2e état complet) et échouait avant correctif (`getRecommendedProperties` jamais rappelé) puis réussit après. Je n'ai pas trouvé de second défaut indépendant qui expliquerait spécifiquement et uniquement le symptôme A ou uniquement le symptôme B — d'où une cause unique, et non deux causes distinctes forcées artificiellement en une seule.

## 5. Réponses aux 74 questions du mandat (§56)

1. **Quel écran mobile affiche les recommandations ?** `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx`.
2. **Quel endpoint réel appelle-t-il ?** `GET /properties/recommended` (public, sans query params, sans auth).
3. **Quel champ définit recommandé ?** `Property.recommande` (booléen).
4. **Où est-il stocké ?** `server/models/Property.js`, champ `recommande`.
5. **Le dashboard utilise-t-il le même champ ?** Oui — même modèle `Property`, même champ, même endpoint public en lecture (confirmé par le badge "Recommandé" visible sur les deux biens dans le dashboard).
6. **Quels sont les états réels de PARCELLE A VENDRE ?** `recommande:true`, `statusAdmin:'Validée'`, `isPublished:true`, `availability:'Disponible'`, `pole:'Altimmo'`, `images` = 5 chaînes valides.
7. **Quels sont les états réels de BUREAU A LOUER ?** Identiques structurellement : `recommande:true`, `statusAdmin:'Validée'`, `isPublished:true`, `availability:'Disponible'`, `pole:'Altimmo'`, `images` = 7 chaînes valides.
8. **Les deux sont-ils réellement recommandés dans les données ?** Oui, confirmé.
9. **Les deux sont-ils publiés selon le contrat public ?** Oui, confirmé.
10. **Le backend renvoie-t-il la Parcelle ?** Oui, confirmé par requête directe à la production.
11. **Le backend renvoie-t-il le Bureau ?** Oui, confirmé.
12. **Le mobile reçoit-il la Parcelle ?** Oui, à l'appel réseau (si celui-ci a eu lieu après que les données soient complètes).
13. **Le mobile reçoit-il le Bureau ?** Oui, même condition.
14. **À quelle couche le Bureau disparaît-il ?** Nulle part dans la chaîne de données — le "manque" observé est un défaut de **fraîcheur du state mobile**, pas une disparition de couche.
15. **Quelle root cause exacte ?** Absence de rafraîchissement du state `recommended` (pull-to-refresh/focus), voir §4.
16. **Existe-t-il un filtre vente-only ?** Non, confirmé absent à toutes les couches.
17. **Où ?** Non applicable.
18. **Un `limit` est-il impliqué ?** Non — seulement 2 biens `recommande:true` au total, très loin de la limite de 10.
19. **Un tri est-il impliqué ?** Non — `sort('-updatedAt')` ne change rien avec seulement 2 résultats.
20. **Une déduplication est-elle impliquée ?** Non, aucune déduplication n'existe sur ce chemin.
21. **Le type Bureau est-il exclu ?** Non, aucune exclusion par type trouvée.
22. **Pourquoi ?** Non applicable (pas d'exclusion).
23. **Règle métier ou bug ?** Bug (cache/rafraîchissement), pas une règle métier.
24. **Quelle structure `images` a la Parcelle ?** Tableau de chaînes (5 URLs).
25. **Quelle structure `images` a le Bureau ?** Tableau de chaînes (7 URLs).
26. **Quelle structure l'API renvoie-t-elle ?** Identique — tableau de chaînes, sans transformation.
27. **Quelle structure le mobile attend-il ?** `item.images?.[0]` — une chaîne, cohérent avec la structure réelle.
28. **Où l'image de la Parcelle est-elle perdue ?** Nulle part dans le code actuel — voir §2.
29. **Le Web utilise-t-il une normalisation différente ?** Non — même structure consommée directement, aucune divergence trouvée.
30. **Quelle root cause image exacte ?** State mobile figé (cause unifiée, §4), pas un bug de résolution.
31. **Cloudinary est-il impliqué ?** Oui comme hébergeur des images (URLs `res.cloudinary.com`), mais aucun problème Cloudinary trouvé — les URLs sont valides et complètes.
32. **`secure_url` est-il utilisé ?** Non — le modèle stocke directement l'URL complète en chaîne, pas un objet Cloudinary brut.
33. **URL string ?** Oui, confirmé pour les deux biens.
34. **Objet image ?** Non, jamais observé dans ce projet pour `Property.images`.
35. **Fallback masquait-il le problème ?** Non — le fallback (`PLACEHOLDER`) n'a pas été touché et ne masque aucun bug ; le vrai problème (state figé) est indépendant du fallback.
36. **Deux root causes distinctes ?** Non — une cause unique et unifiée, voir §4, avec justification explicite de ce choix (mandat §31).
37. **Correctif backend ?** Aucun.
38. **Correctif mobile ?** Oui — `onRefresh` dans `ListeAnnoncesScreen.jsx` invalide et recharge désormais aussi les recommandations.
39. **Web modifié ?** Non.
40. **Nouvelle règle métier ajoutée ?** Non.
41. **Recommandation métier modifiée ?** Non.
42. **Publication modifiée ?** Non.
43. **Vente/location modifié ?** Non.
44. **Tenant modifié ?** Non.
45. **RBAC modifié ?** Non.
46. **Parcelle reste visible ?** Oui, prouvé par test.
47. **Son image apparaît ?** Oui, prouvé par test (fixture avec image valide, rendue).
48. **Bureau Location apparaît ?** Oui, prouvé par test (après refresh).
49. **Son image apparaît ?** Oui, prouvé par test.
50. **Les deux apparaissent ensemble ?** Oui, prouvé par test (test 2).
51. **Non recommended reste absent ?** Oui, par construction (filtre backend inchangé), prouvé indirectement (test 3 : liste vide → section absente).
52. **Unpublished reste absent si applicable ?** Oui, par construction (filtre backend non modifié).
53. **Rejected reste absent ?** Oui, par construction.
54. **Tests image ?** Oui (fixtures avec `images` valides, rendues dans les 4 tests).
55. **Tests filters ?** Couverts par analyse de code (`_FILTER_MATRIX.md`), aucun filtre vente/type à tester côté mobile (aucun n'existe).
56. **Tests vente/location ?** Oui, test 1 (vente seule) et test 2 (les deux ensemble).
57. **Tests backend ?** Non — backend non modifié, non requis.
58. **Mongo ciblé ?** Non requis (backend non modifié) — une inspection en lecture seule a néanmoins été effectuée pour l'audit (§`_ETAT_INITIAL.md`).
59. **Backend complet ?** Non requis.
60. **Tests mobile ciblés ?** Oui — 4/4 verts (`ListeAnnoncesScreenRecommended.test.jsx`).
61. **Mobile complet ?** Oui — 50 suites / 430 tests verts.
62. **lint ?** 0 erreur.
63. **typecheck ?** 0 erreur.
64. **Expo export ?** Réussi.
65. **`architecture:check` si pertinent ?** Non requis (backend non modifié).
66. **Device réel ?** **NON CONFIRMÉ** — aucun appareil disponible dans cet environnement.
67. **`git diff --check` ?** Propre.
68. **Production data modifiée ?** Non — inspection strictement en lecture seule.
69. **Commit ?** Non.
70. **Push ?** Non.
71. **Deploy ?** Non.
72. **Autre bug découvert ?** Le même défaut de rafraîchissement affecte potentiellement d'autres sections mises en cache sans invalidation sur `onRefresh` (ex. `getActivePublicites`, également chargé une seule fois au montage, ligne 292) — documenté comme observation, **non corrigé** ici (hors périmètre exact du rapport, qui porte sur les recommandations ; mandat §33/§41 imposent un correctif minimal et ciblé, pas un audit généralisé de tous les caches de l'écran).
73. **Laissé hors scope ?** Le même défaut sur `getActivePublicites` (publicités actives), non corrigé, documenté au point 72. Web non modifié (non nécessaire).
74. **Verdict ?** Voir §6.

## 6. Fichiers créés/modifiés

**Production (1 fichier mobile)** :
- `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` — `onRefresh` invalide et recharge désormais aussi la section recommandée (3 lignes ajoutées, aucune autre ligne modifiée).

**Tests (1 fichier créé)** :
- `altimmo-app/src/screens/Annonces/__tests__/ListeAnnoncesScreenRecommended.test.jsx` — 4 tests, dont la caractérisation rouge→vert du bug réel.

**Documentation (9 fichiers créés dans `server/docs/`)** :
`HOTFIX_MOB_RECOMMENDED_PROPERTIES1_ETAT_INITIAL.md`, `_MOBILE_FLOW.md`, `_PROPERTY_MATRIX.md`, `_API_MATRIX.md`, `_IMAGE_FLOW.md`, `_FILTER_MATRIX.md`, `_BEHAVIOR_CONTRACT.md`, `_TEST_MATRIX.md`, `_REPORT.md` (ce fichier).

Aucun fichier backend, aucun fichier web, aucune donnée de production modifiée.

## 7. Verdict

**CERTIFIÉ VERT SOUS RÉSERVE DEVICE.**

Les deux symptômes ont été reproduits par leur mécanisme (test rouge avant correctif), la cause racine a été prouvée unique et unifiée (pas supposée), le correctif est minimal et strictement localisé à l'absence de rafraîchissement du cache mobile des recommandations — aucune règle métier, aucun filtre public, aucune règle de recommandation, aucun champ `images`, aucun endpoint modifié. La Parcelle recommandée reste présente avec son image, le Bureau recommandé en location apparaît désormais après un rafraîchissement, les deux coexistent, les filtres publics ne sont pas assouplis, aucune fuite tenant, aucun doublon. Tests ciblés et suite mobile complète verts, lint et typecheck verts, Expo export vert, `git diff --check` propre. Le seul point non "sans réserve" : aucun appareil Android réel n'était disponible pour une validation finale sur device.

**Recommandation** : vérifier sur l'appareil ayant servi aux captures d'écran originales que, après un pull-to-refresh sur l'écran Annonces, le Bureau apparaît désormais dans "Biens recommandés" avec son image, et que la Parcelle affiche également la sienne.

## 8. STOP

Conformément au mandat, ce travail s'arrête ici.

**En attente de validation de l'utilisateur avant tout commit.**
