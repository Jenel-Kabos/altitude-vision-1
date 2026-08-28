ROOT CAUSE: Netlify production environment missing `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` at the time of the last build (build-time env var, not a code defect).

## Preuve (pas une supposition)

1. **Le code source est structurellement correct** : `publiciteService.js::uploadToCloudinary` lit `process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`/`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — exactement les noms documentés dans `.env.example`, exactement le préfixe `NEXT_PUBLIC_` requis par Next.js pour un accès client-side, aucune faute de frappe, aucune variable serveur-only lue par erreur.

2. **Le chunk JS réellement servi en production** (`https://altitudevision.agency/_next/static/chunks/app/dashboard/publicites/page-0e8bd006b1088a7d.js`, récupéré en direct pendant cet audit) contient :
   ```
   fetch("https://api.cloudinary.com/v1_1/".concat(y.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,"/image/upload"), ...)
   ```
   — un **accès runtime à une propriété d'objet**, jamais une valeur intégrée par le compilateur.

3. **Un build de production local**, avec le `.env.local` du dépôt (qui contient déjà les deux variables), produit pour le MÊME point de code :
   ```
   t="dop8vzm5z", r="lqwel6X6"
   ```
   — des **chaînes littérales intégrées directement**, comportement de compilation radicalement différent.

4. **Comparaison de contrôle** : `NEXT_PUBLIC_API_URL`, une variable connue pour fonctionner en production, apparaît dans le chunk de production sous forme de chaîne littérale intégrée (`baseURL:"https://altitude-vision.onrender.com/api"`), confirmant que le compilateur Next.js DE CE PROJET intègre bien correctement les variables `NEXT_PUBLIC_*` quand elles sont présentes au build — le comportement différent observé pour les variables Cloudinary n'est donc pas une limitation générale de la configuration Next.js, mais spécifique à ces deux variables.

## Conclusion

Ces quatre preuves, prises ensemble, établissent de façon concluante (Next.js intègre statiquement les `NEXT_PUBLIC_*` présentes au build ; la variable Cloudinary ne l'est pas en production alors qu'une autre l'est ; le code source est identique et correct ; le même code compile correctement localement dès que la variable existe) que **la seule explication cohérente est l'absence de ces deux variables dans l'environnement de build Netlify au moment du dernier déploiement de production**. Aucune autre couche (code frontend, backend, Cloudinary lui-même) n'est en cause.

## Cas retenu (mandat §54)

**CAS C — NETLIFY MANQUANT.** Conformément au mandat, aucun code n'a été modifié pour "corriger" cette variable (elle est déjà correcte). Voir `_MANUAL_VALIDATION.md` pour la procédure exacte de configuration Netlify requise.

## Amélioration additionnelle apportée (distincte de la root cause)

Un garde-fou fail-fast a été ajouté dans `uploadToCloudinary` (voir `_BEHAVIOR_CONTRACT.md`) : si `cloud_name`/`upload_preset` sont absents, la fonction lève désormais une erreur claire **avant** tout appel réseau, au lieu d'envoyer silencieusement une requête vers `/v1_1/undefined/image/upload`. Ceci ne corrige pas la cause racine (la variable d'environnement doit toujours être configurée dans Netlify pour que l'upload fonctionne) — cela empêche seulement la manifestation confuse du problème (401 Cloudinary) de se reproduire à l'identique si une variable venait à manquer à nouveau à l'avenir, et donne un message exploitable côté utilisateur.
