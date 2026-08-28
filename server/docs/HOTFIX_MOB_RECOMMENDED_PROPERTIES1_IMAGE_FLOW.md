# HOTFIX-MOB-RECOMMENDED-PROPERTIES-1 — FLUX IMAGE (mandat §53)

## Structure canonique confirmée

`Property.images` est un tableau de **chaînes** (URLs Cloudinary complètes, `https://res.cloudinary.com/...`), pour les deux biens, confirmé par lecture directe de la base — **pas un tableau d'objets `{url, secure_url, public_id}`**. Aucun champ `photos`/`image`/`coverImage`/`thumbnail`/`media` alternatif présent sur ces deux documents.

## Parcours pour PARCELLE A VENDRE

| Étape | Forme | Résultat |
|---|---|---|
| DB (`Property.images`) | `["https://res.cloudinary.com/.../xh0ghr....jpg", ...]` (5 chaînes) | OK |
| JSON HTTP (`/properties/recommended`, vérifié en direct) | Même tableau de chaînes, sans transformation (aucun `toJSON` custom sur `Property`, seulement `{virtuals: true}`) | OK |
| Mobile (`RecommendedCarousel.jsx::PropertyCard`) | `const imgUri = item.images?.[0] \|\| item.photos?.[0] \|\| null;` → chaîne valide | **OK — résolution correcte, aucun bug de code trouvé** |
| React Native `Image` (`expo-image`) | `source={imgUri ? { uri: imgUri } : PLACEHOLDER}` | **OK — devrait s'afficher correctement avec les données actuelles** |

## Comparaison avec le Web (dashboard)

Le dashboard web résout `item.images[0]` de façon strictement équivalente (chaîne directe, aucune transformation spécifique) — confirmé par la structure identique des données consommées (même endpoint public, même modèle). **Aucune divergence de normalisation entre Web et Mobile n'a été trouvée** ; les deux consomment directement la même forme de données, sans logique de résolution différente à auditer/réconcilier (mandat §12 : rien à comparer, les deux font la même chose).

## Root cause de l'absence d'image observée (symptôme A)

**Aucun bug de code n'explique une perte de l'image dans le chemin actuel.** Avec les données actuelles (tableau de chaînes valides à toutes les étapes), l'image de la Parcelle devrait s'afficher. L'observation originale du symptôme A est cohérente avec un état antérieur du bien (avant que ses `images` ne soient renseignées/corrigées côté admin — `updatedAt` très récent, voir `_ETAT_INITIAL.md`), capturé et gelé par le cache mobile 10 minutes + l'absence de rafraîchissement (voir `_REPORT.md`, cause racine unifiée avec le symptôme B). **NON CONFIRMÉ** : l'état exact des données au moment précis de la capture d'écran originale (avant l'audit) n'est pas vérifiable rétroactivement — seule la structure actuelle a pu être auditée.

## Fallback (mandat §15)

Le fallback (`PLACEHOLDER`, logo de l'agence) reste fonctionnel et n'a pas été modifié — il continue de s'afficher si `imgUri` est `null`, sans masquer un défaut réel : le correctif appliqué (voir `_BEHAVIOR_CONTRACT.md`) porte sur le rafraîchissement du state, pas sur la logique de résolution d'image (déjà correcte).
