# TENANT-SCOPE-HOTFIX-3 — État initial

Date : 2026-08-20. Branche `main`.

## 1. Baseline Git

```
git status --short → travail non commité de TENANT-SCOPE-AUDIT-2B exclusivement, rien de surprenant
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782 (inchangé depuis AUDIT-2B)
git log -5 --oneline → 3f7b59b Update Altimmo 32 / bfdd67c Update Altimmo 31 / f1bb85c Update Altimmo 30 / 2904469 Updqte HeroSlider / 800bc47 Update Altimmo 30
git diff --check → exit 0
git diff --stat → 11 fichiers, 169 insertions(+), 20 deletions(-)
```

Aucun changement externe de `HEAD`.

## 2. Rappel de la conclusion AUDIT-2B

Deux bugs confirmés, non corrigés :
- **Hotel** : `routes/hotelRoutes.js` monte `router.use(auth.protect, requireTenantScope)` avant TOUTES les routes, y compris `/mine` (self-service). Un exploitant public-signup sans `OrgMembership` reçoit 403 avant même d'atteindre `hotelAccessScopeService.js`, qui contient pourtant déjà le bypass ownership nécessaire (code mort).
- **Financial** : même schéma dans `routes/financialRoutes.js` (ligne 9), bloquant `GET /hotel/:hotelId/documents` et les autres routes lecture-seule ouvertes au rôle `Proprietaire`, avant `financialAuthorizationService.assertFinancialScope` (qui a lui aussi déjà le bypass ownership).

Piste explicitement rejetée par AUDIT-2B : remplacer `requireTenantScope` par `attachTenantContext` — cassé pour le staff car `attachTenantContext` ne peuple ni `req.user.platformTenant` ni `req.user.tenantScopeUserIds`, dont dépendent `resolveHotelAccessScope`/`assertFinancialScope` pour la branche staff/Admin.

## 3. Méthode

1. Reproduire les deux 403 sur le code actuel (déjà fait en AUDIT-2B, rejoué ici pour preuve fraîche).
2. Cartographier intégralement `hotelRoutes.js` et `financialRoutes.js` (toutes les routes, pas seulement celles qui échouent).
3. Concevoir la correction au plus petit rayon d'action : très probablement un nouveau middleware `attachTenantScopeOptionalForSelfService` (ou nom équivalent) qui — pour les SEULES routes explicitement self-service — attache le contexte tenant s'il existe (même enrichissement `req.user.platformTenant`/`tenantScopeUserIds` que `requireTenantScope` quand résolu) mais ne bloque jamais en son absence, laissant `hotelAccessScopeService`/`financialAuthorizationService` faire la vraie vérification d'ownership. Les routes staff-only gardent `requireTenantScope` inchangé.
4. Ne jamais modifier `hotelAccessScopeService.js`, `financialAuthorizationService.js`, `fromUser`, `resolveTenantScope` — sauf preuve extraordinaire qu'AUDIT-2B se trompait (non anticipé).
5. Tests Mongo réels (pas de mocks seuls) : owner légitime, cross-owner, staff bon tenant, staff mauvais tenant, Client, Admin, forgery de body (ownerId/hotelId/userId), MTN/PAY-3/PAY-4 non-régression, checkout policy, businessProfiles non-régression, catalogue public, invariant Conversation.
6. Deux matrices (routes avant/après, sécurité) + rapport répondant aux 41 questions + verdict.

Interdictions : aucune modification de schéma, IAM, provider registry, checkout policy, capacités financières ; aucun fichier frontend/mobile sauf justification explicite (non anticipée).
