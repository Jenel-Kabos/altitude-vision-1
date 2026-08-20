# TENANT-SCOPE-AUDIT-2A — État initial

Date : 2026-08-20. Branche `main`.

## 1. Baseline Git

```
git status --short → travail non commité de TENANT-SCOPE-AUDIT-1 exclusivement (voir liste ci-dessous), rien de surprenant
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782 (inchangé depuis TENANT-SCOPE-AUDIT-1)
git log -5 --oneline → 3f7b59b Update Altimmo 32 / bfdd67c Update Altimmo 31 / f1bb85c Update Altimmo 30 / 2904469 Updqte HeroSlider / 800bc47 Update Altimmo 30
git diff --check → exit 0
git diff --stat → 6 fichiers modifiés, 85 insertions(+), 8 deletions(-)
```

Fichiers modifiés (non commités, tous du sprint précédent) :
`__tests__/rentalManagementActivation.test.js`, `controllers/propertyPortfolioController.js`, `controllers/rentalContractRegularizationController.js`, `controllers/rentalManagementController.js`, `controllers/userController.js`, `routes/userRoutes.js`.

Fichiers nouveaux (non commités, tous du sprint précédent) : tests des 4 sprints précédents + `docs/HOTFIX_OWNER_CONTRACT_RESEND1_*.md`, `docs/MICRO_HOTFIX_RENTAL_REG_SCOPE1_*.md`, `docs/TENANT_SCOPE_AUDIT1_*.md`.

Aucun changement externe de `HEAD`. Aucune action Git destructive envisagée ni exécutée.

## 2. Implémentation actuelle de `fromUser` (lue intégralement dans `services/platformTenant/tenantResourceAttributionService.js`)

```js
async function fromUser(userId, label = 'user') {
  if (!validId(userId)) return unresolved([`${label}:missing`]);
  const tenants = await resolveAvailableTenantsForUser(userId);
  if (tenants?.length === 1) return resolved(tenants[0]._id, [`${label}:${userId}→membership→${tenants[0]._id}`]);
  if (tenants?.length > 1) return { status: 'ambiguous', tenantId: null, proof: [`${label}:${userId}→${tenants.length}_tenants`], confidence: 0 };
  return unresolved([`${label}:${userId}→no_tenant`]);
}
```

- **Paramètres** : `userId` (ObjectId ou objet portant `_id`/`id`), `label` (préfixe de preuve, cosmétique).
- **Modèle interrogé** : aucun directement — délègue à `resolveAvailableTenantsForUser(userId)` (`tenantContextService.js`), qui interroge `OrgMembership.find({user: userId, status: 'active'})` puis résout les `OrgUnit` racines actives puis les `PlatformTenant` `trial`/`active` correspondants.
- **PlatformTenant lookup** : indirect, via `resolveAvailableTenantsForUser` → `PlatformTenant.find({rootOrgUnit: {$in: roots}, status: {$in: ['trial', 'active']}})`.
- **PlatformOperator lookup** : AUCUN — `fromUser` ne consulte jamais `PlatformOperator`. Un `PlatformOperator` actif sans `OrgMembership` propre serait donc `unresolved` par cette fonction (mais `resolveResourceTenant` n'est jamais appelée pour un PlatformOperator lui-même — hors périmètre direct).
- **Résultats possibles** :
  - `userId` invalide/absent → `unresolved([...':missing'])`.
  - Exactement 1 tenant résolu via `OrgMembership` → `resolved(tenantId, proof, confidence=1)`.
  - Plusieurs tenants résolus → `{status:'ambiguous', tenantId:null, confidence:0}` (fail-closed explicite, jamais un choix arbitraire).
  - Aucun tenant résolu (0 `OrgMembership` actif, OU 0 tenant `trial`/`active` associé) → `unresolved([...':no_tenant'])`.
- **Aucun fallback** : `fromUser` ne consulte JAMAIS `PlatformTenant.countDocuments()` ni aucune notion de "tenant unique" — contrairement à `expandScopeWithUnaffiliatedUsersIfSoleTenant` (userController.js), qui est un mécanisme totalement différent et n'est jamais appelé par cette chaîne.
- **Erreurs possibles** : aucune levée directement — `resolveAvailableTenantsForUser` peut lever si `userId` casse une requête Mongoose, mais `fromUser` ne catch pas ; l'appelant (`resolveResourceTenant`) ne catch pas non plus explicitement à ce niveau (delegated à l'appelant final, ex. `assertResourceTenant`, qui lui-même n'a pas de try/catch — c'est le contrôleur qui encadre l'appel dans son propre try/catch HTTP).
- **Callers connus (à date, avant inventaire exhaustif de ce sprint)** : `resolveResourceTenant` (même fichier), qui l'utilise directement pour `resourceType === 'User'`, et indirectement via `fromProperty` (`property.owner`), `fromHotel` (`hotel.manager`, `hotel.createdBy`), `fromContractsReferencing` (locataire/proprietaire — mais via `fromProperty`, pas `fromUser` directement pour ces deux), `Document` (`resource.createdBy`, `resource.client`), `Conversation` (participants), `Message` (sender/receiver), `AccommodationReservation` (owner/createdBy), `RentalManagement` (owner/manager), `Proprietaire` (`resource.user`).

## 3. Méthode de ce sprint

1. Inventaire exhaustif (grep, pas de supposition) de tous les points d'entrée qui appellent, directement ou transitivement, `fromUser`.
2. Pour chaque consommateur : caractériser par lecture de code ET par test Mongo réel (pas de mock) — acteur, ressource, source `User`, si public-signup est possible, si le métier exige `OrgMembership`, comportement actuel, risque cross-tenant.
3. Construire la matrice consommateurs + la matrice d'attribution par ressource.
4. Décider de l'architecture (Option A/B/C/D du mandat) UNIQUEMENT après cette caractérisation complète — jamais avant.
5. Reproduire le bug Document (test déjà existant, rouge) et documenter précisément le point de rejet.
6. Corriger au point le plus étroit démontré par la caractérisation.
7. Tests adversariaux + cross-tenant + non-régression complète (4 sprints précédents + tenantCore + cert + Property/Hotel/Accommodation/Conversation/Financial/Contrat-Rental pertinents).
8. Rapport + verdict + STOP.

Aucune modification de schéma, aucun backfill, aucune migration.
