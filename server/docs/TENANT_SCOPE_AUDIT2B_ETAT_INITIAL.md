# TENANT-SCOPE-AUDIT-2B — État initial

Date : 2026-08-20. Branche `main`.

## 1. Baseline Git

```
git status --short → travail non commité de TENANT-SCOPE-AUDIT-2A exclusivement, rien de surprenant
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782 (inchangé depuis AUDIT-2A)
git log -5 --oneline → 3f7b59b Update Altimmo 32 / bfdd67c Update Altimmo 31 / f1bb85c Update Altimmo 30 / 2904469 Updqte HeroSlider / 800bc47 Update Altimmo 30
git diff --check → exit 0
git diff --stat → 10 fichiers, 156 insertions(+), 18 deletions(-)
```

Aucun changement externe de `HEAD`. Aucune action Git destructive envisagée.

## 2. Rappel de la conclusion architecturale d'AUDIT-2A

`tenantResourceAttributionService.fromUser` n'est pas défectueux — son contrat ("cet utilisateur a-t-il une `OrgMembership` active traçant un tenant ?") est cohérent. Deux primitives existent et sont toutes deux légitimes selon le contexte :
- `assertResourceTenant` (STRICTE) : refuse si la ressource n'est pas attribuable OU si elle est attribuée à un autre tenant. À utiliser quand l'absence d'attribution EST ELLE-MÊME un signal invalide.
- `assertResourceTenantOrUnattributed` (FAIL-OPEN) : refuse seulement si la ressource est attribuée à un AUTRE tenant ou ambiguë ; une absence d'attribution ne bloque rien à ce niveau. À utiliser quand la ressource peut légitimement n'avoir aucune frontière tenant traçable.

4 bugs ont été prouvés et corrigés dans AUDIT-2A (documentController, userController.downloadContractDocument, propertyController, rentalMaintenanceController) — tous par le remplacement local `assertResourceTenant` → `assertResourceTenantOrUnattributed`, jamais une modification de `fromUser`/`resolveTenantScope`.

3 zones restent volontairement non auditées : `hotelAccessScopeService.js`, `financialAuthorizationService.js`, `userBusinessProfileRoutes.js`. Ce sprint les traite séparément, phase par phase, sans supposer que le même remède s'applique.

## 3. Méthode

Trois sous-audits strictement cloisonnés (Phase A Hotel, Phase B Finance, Phase C Business Profiles). Pour chaque phase : lecture complète du contrat actuel → caractérisation par test Mongo réel (jamais de mock seul pour les règles dépendant d'OrgMembership/PlatformTenant/ownership) → classification stricte → correction UNIQUEMENT si bug prouvé par un test rouge avant/vert après → preuve cross-tenant obligatoire pour tout fix → sweep de non-régression complet (4 sprints précédents + Hotel + Financial Core + PAY-3/PAY-4 + businessProfiles + tenantCore + Property public catalog + Conversation).

Interdictions absolues : aucune modification de `resolveTenantScope`, `fromUser`, `expandScopeWithUnaffiliatedUsersIfSoleTenant`, IAM, schémas. Aucun remplacement mécanique `assertResourceTenant → assertResourceTenantOrUnattributed` sans preuve domaine par domaine — l'inverse même de la méthode d'AUDIT-2A serait une erreur ici : chaque domaine a potentiellement des invariants différents.
