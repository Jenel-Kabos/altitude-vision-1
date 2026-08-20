# MICRO-HOTFIX-RENTAL-REG-SCOPE-1 — État initial

Date : 2026-08-20. Branche `main`.

## 1. Baseline Git

```
git status --short → M server/controllers/userController.js, M server/routes/userRoutes.js,
                      ?? __tests__/hotfixOwnerContractResend1.mongo.integration.test.js,
                      ?? docs/HOTFIX_OWNER_CONTRACT_RESEND1_ETAT_INITIAL.md,
                      ?? docs/HOTFIX_OWNER_CONTRACT_RESEND1_REPORT.md
                      (exactement le travail non commité de HOTFIX-OWNER-CONTRACT-RESEND-1,
                      rien de surprenant)
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782 (inchangé depuis
                      HOTFIX-OWNER-CONTRACT-RESEND-1)
git diff --check → exit 0
git diff --stat → server/controllers/userController.js | 9 +, server/routes/userRoutes.js | 15 +/-
```

Aucun changement externe de `HEAD` depuis le hotfix précédent.

## 2. Audit du fichier suspect (lecture complète)

`server/routes/rentalContractRegularizationRoutes.js` :
```js
const staff = [auth.protect, auth.restrictTo('Admin', 'GestionnaireImmobilier', 'Collaborateur'), requireTenantScope];
router.get('/', staff, controller.list);
router.post('/:contractId/decision', staff, controller.decide);
router.post('/:contractId/revert', auth.protect, auth.restrictTo('Admin'), requireTenantScope, controller.revert);
```
Aucun `router.param('id', …)`. La ressource ciblée par `:contractId` est un `Contrat`, PAS un `User` — différence structurelle majeure avec `userRoutes.js`.

`controllers/rentalContractRegularizationController.js` : passe `req.tenantScopeUserIds` tel quel (brut, posé par `requireTenantScope`) au service pour les 3 actions (`list`, `decide`, `revert`).

`services/rentalContractRegularizationService.js` : la fonction `isContractInScope(contract, tenantScopeUserIds)` :
```js
function isContractInScope(contract, tenantScopeUserIds) {
  const ownerUserId = contract.proprietaire?.user;
  if (!ownerUserId) return true; // pas de user lié → authentiquement non attribuable, reste visible
  return (tenantScopeUserIds || []).some((id) => String(id) === String(ownerUserId));
}
```
Utilisée par `getCases()` (filtre la liste) et `assertContractInScope()` (bloque `decide`/`revert` avec `409 CASE_NOT_PENDING` si hors scope).

**Différence fondamentale avec HOTFIX-USERS-COUNT-1 / RESEND-1** : ici, l'acteur qui appelle la route est TOUJOURS du staff (Admin/GestionnaireImmobilier/Collaborateur) — jamais le Proprietaire/Client lui-même. `req.tenantScopeUserIds` n'est PAS utilisé pour vérifier que l'ACTEUR a accès — `requireTenantScope` fait déjà ce travail en amont (403 si aucun tenant résolu pour l'acteur). Il est utilisé pour déterminer si la RESSOURCE (le contrat, via son `proprietaire.user`) appartient au MÊME tenant que l'acteur, avec un comportement "fail open" explicite pour les contrats sans owner lié.

## 3. Question centrale (mandat §3)

Si `contract.proprietaire.user` référence un compte Proprietaire créé par signup public, actif, sans `OrgMembership`, sur un déploiement à tenant unique — `isContractInScope` retourne `false` (l'ID n'est jamais dans le scope brut `OrgMembership`-only), donc :
- le dossier disparaît de `getCases()` (liste) pour TOUT le staff, y compris l'Admin légitime du tenant unique ;
- `decide()`/`revert()` sur ce dossier échouent avec `409 CASE_NOT_PENDING`.

C'est un FAUX NÉGATIF : sur tenant unique, ce owner appartient nécessairement au seul tenant existant — exactement le même défaut structurel que HOTFIX-USERS-COUNT-1, mais appliqué à la résolution d'appartenance d'une ressource tierce (`Contrat`) plutôt qu'à la visibilité de l'acteur lui-même.

## 4. Plan

1. Écrire un test de caractérisation AVANT toute modification : contrat lié à un Proprietaire non affilié, staff Admin (tenant unique), `GET /` (liste) et `POST /:contractId/decision`.
2. Constater précisément l'échec (contrat absent de la liste ? 409 sur decide ?).
3. Si confirmé : réutiliser `expandScopeWithUnaffiliatedUsersIfSoleTenant` (déjà exportée depuis `userController.js`) au point d'entrée du contrôleur (`list`/`decide`/`revert`), jamais dans `resolveTenantScope`.
4. Prouver la sécurité multi-tenant : dès qu'un second tenant existe, aucun élargissement, aucune fuite cross-tenant.
5. Non-régression : HOTFIX-USERS-COUNT-1, HOTFIX-OWNER-CONTRACT-RESEND-1, tests GL/tenant existants.
6. Rapport + STOP.
