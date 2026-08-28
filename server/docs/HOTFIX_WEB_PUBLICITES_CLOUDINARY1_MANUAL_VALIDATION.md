# HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — VALIDATION MANUELLE / CONFIGURATION REQUISE

## READY FOR MANUAL ENV FIX

Le code est correct et ne nécessite aucune autre modification pour que l'upload fonctionne. **Une action manuelle dans le tableau de bord Netlify est requise**, hors de portée de cet agent (aucun accès Netlify direct dans cet environnement).

### Procédure exacte

1. **Nom de variable 1** : `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
2. **Nom de variable 2** : `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
3. **Contexte** : Production (et Preview/Branch deploys si des previews sont utilisées pour tester cette fonctionnalité)
4. **Valeur à reprendre** : depuis `client/.env.local` (fichier local du dépôt, non commité) ou depuis la configuration `CLOUDINARY_CLOUD_NAME` déjà utilisée côté backend (`server/.env`, Render) — **la même identité `cloud_name` doit être utilisée partout dans le projet** (déjà le cas côté serveur et mobile). Le preset (`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`) doit être le preset **unsigned** déjà configuré côté Cloudinary pour ce cloud — celui déjà utilisé par l'application mobile pour ses propres uploads directs (même mécanisme unsigned, cohérence déjà établie entre Web et Mobile pour ce cloud). Je n'invente aucune valeur : je désigne uniquement la source déjà autorisée où la retrouver.
5. **Rebuild nécessaire** : **Oui, indispensable.** Les variables `NEXT_PUBLIC_*` de Next.js sont intégrées de façon statique au moment du build (confirmé empiriquement, voir `_ROOT_CAUSE.md`) — ajouter la variable dans Netlify sans redéclencher un nouveau build/déploiement n'aura **aucun effet** sur le bundle déjà déployé.
6. **Validation Network après déploiement** : sur `/dashboard/publicites`, ouvrir les DevTools → Network, créer une publicité avec une image, vérifier que la requête part vers `https://api.cloudinary.com/v1_1/<cloud_name réel>/image/upload` (jamais `/undefined/`) et retourne un statut 200 avec un `secure_url`.

## Validation navigateur réelle — NON EFFECTUÉE dans cet environnement

Aucun navigateur interactif n'est disponible dans cet environnement pour naviguer vers le dashboard déployé avec une session authentifiée réelle et déclencher un upload de bout en bout. La preuve produite (§`_ROOT_CAUSE.md`) repose sur :
- la récupération directe et l'inspection du bundle JavaScript **réellement servi en production** (requête HTTP directe, pas une simulation) ;
- un build de production **local** reproduisant fidèlement le même point de code avec une configuration valide, confirmant le mécanisme exact.

C'est une preuve technique forte et directe, mais **ce n'est pas une validation de bout en bout effectuée dans un vrai navigateur avec une session utilisateur réelle** contre l'environnement de production après correction de la variable Netlify (qui n'a pas encore été appliquée). Le mandat §69 autorise ce cas de figure : validation via harnais/preuve technique en l'absence de navigateur, verdict à qualifier en conséquence.

## Ce qui reste à faire, hors de portée de cet agent

1. Ajouter les deux variables dans Netlify (Site settings → Environment variables), contexte Production.
2. Redéclencher un déploiement (`git push` sur la branche de production, ou "Trigger deploy" manuel dans Netlify).
3. Refaire le test Network décrit ci-dessus sur le site déployé.
4. Confirmer qu'une publicité créée avec image apparaît correctement, avec son média, dans le dashboard.
