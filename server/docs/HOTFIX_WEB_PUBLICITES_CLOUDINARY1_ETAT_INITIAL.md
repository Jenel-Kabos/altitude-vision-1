# HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé.
- `git status --short` : 361 lignes — travail parallèle déjà documenté (`ARCH2*`) plus mes hotfix non commités des sprints précédents. Aucun écrasement.
- `git diff --check` : propre.

## Symptôme confirmé

`POST https://api.cloudinary.com/v1_1/undefined/image/upload` → 401, depuis `/dashboard/publicites`, à la création d'une publicité avec média.

## Preuve directe — production réelle (lecture seule, aucune mutation)

Le chunk JS réellement servi par `https://altitudevision.agency/_next/static/chunks/app/dashboard/publicites/page-0e8bd006b1088a7d.js` (récupéré en direct pendant cet audit) contient :
```
fetch("https://api.cloudinary.com/v1_1/".concat(y.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,"/image/upload"), ...)
```
**`y.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` est un accès RUNTIME à une propriété, jamais une chaîne littérale intégrée par le compilateur Next.js.**

## Contre-preuve — build local avec `.env.local` renseigné

Un build de production local (`npm run build:next`, avec le `.env.local` du dépôt qui contient déjà `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dop8vzm5z` et `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=lqwel6X6`) produit, pour le même point du code :
```
t="dop8vzm5z", r="lqwel6X6"
```
**Chaînes littérales intégrées directement par le compilateur** — comportement radicalement différent de la production.

## Conclusion immédiate

Cette comparaison directe, chunk réel de production contre build local reproductible, est une preuve concluante que **le code source est correct** (mêmes noms de variables, même logique, compile correctement dès que les variables sont présentes à la construction) et que **l'environnement de build Netlify de production ne disposait pas de `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`/`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` au moment du dernier déploiement**. Voir `_ROOT_CAUSE.md` pour l'analyse complète.
