# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — État initial

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645`
- Arbre de travail : **non propre** — nombreuses modifications non commitées provenant de mandats antérieurs de cette même session marathon (fichiers `docs/*`, tests, contrôleurs Accommodation/tenant déjà audités et certifiés dans des hotfixes précédents : HZ-01→HZ-04, ARCH2*, HOTFIX_TENANT_SCOPE_*, etc.). Aucun commit/push n'a été effectué à aucun moment de la session — conforme à la contrainte permanente de l'utilisateur.
- `git diff --check` : 3 avertissements CRLF pré-existants, sans rapport avec ce mandat.
- `npm run architecture:check` (depuis `server/`) : **PASS**, 0 nouvelle violation, dette légale identique aux mandats précédents.

## Symptôme rapporté

Sur `/dashboard/hebergements`, après création d'un hébergement :
- compteur "Hébergements" = 1
- compteur "Publiés" = 0
- liste principale : "Aucun hébergement validé"
- message : "Les hébergements apparaîtront ici après leur validation dans l'onglet Modération Hébergements."

## Portée de l'audit

Tracer end-to-end : formulaire → POST → modèle → valeurs par défaut → GET dashboard → filtres backend → filtres frontend → rendu, sans supposer que le workflow de modération est un bug. Corriger uniquement si une cause racine est prouvée, avec le correctif le plus étroit possible, sans toucher RBAC, tenant isolation, PlatformOperator ni ownership.
