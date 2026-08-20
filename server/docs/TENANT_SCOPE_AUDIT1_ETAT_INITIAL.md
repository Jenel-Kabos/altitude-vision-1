# TENANT-SCOPE-AUDIT-1 — État initial

Date : 2026-08-20. Branche `main`.

## 1. Baseline Git

```
git status --short → M controllers/rentalContractRegularizationController.js,
                      M controllers/userController.js, M routes/userRoutes.js,
                      ?? __tests__/hotfixOwnerContractResend1.mongo.integration.test.js,
                      ?? __tests__/microHotfixRentalRegScope1.mongo.integration.test.js,
                      ?? docs/HOTFIX_OWNER_CONTRACT_RESEND1_ETAT_INITIAL.md,
                      ?? docs/HOTFIX_OWNER_CONTRACT_RESEND1_REPORT.md,
                      ?? docs/MICRO_HOTFIX_RENTAL_REG_SCOPE1_ETAT_INITIAL.md,
                      ?? docs/MICRO_HOTFIX_RENTAL_REG_SCOPE1_REPORT.md
                      (exactement le travail non commité de MICRO-HOTFIX-RENTAL-REG-SCOPE-1,
                      rien de surprenant)
git branch --show-current → main
git rev-parse HEAD → 3f7b59bfb92f51c7ccc6e73c57636affc8cb7782 (inchangé depuis le hotfix précédent)
git diff --check → exit 0
git diff --stat → 3 fichiers, 43 insertions(+), 5 deletions(-)
```

Aucun changement externe de `HEAD` depuis MICRO-HOTFIX-RENTAL-REG-SCOPE-1.

## 2. Rappel des trois hotfixes précédents (lus intégralement)

- **HOTFIX-USERS-COUNT-1** : `/dashboard/users` (`getAllUsers`/`getAllOwners`) excluait les comptes public-signup (Client/Proprietaire) sans `OrgMembership`. Correctif local : `expandScopeWithUnaffiliatedUsersIfSoleTenant` (dans `userController.js`), appliqué UNIQUEMENT à ces deux contrôleurs. Une première tentative d'élargir `resolveTenantScope` globalement a provoqué une fuite réelle constatée par test dans `tenantCore.mongo.integration.test.js` (property catalog, hotel catalog, reporting via API Gateway) — revertée avant tout commit.
- **HOTFIX-OWNER-CONTRACT-RESEND-1** : les actions `/api/users/:id/*` (renvoyer-contrat, contract-document, verify, suspend, activate, role, GET/PUT/DELETE) restaient 404 pour ces mêmes comptes, car `router.param('id', …)` (userRoutes.js) utilisait encore le scope brut. Correctif : réutilisation de la même fonction canonique dans ce garde.
- **MICRO-HOTFIX-RENTAL-REG-SCOPE-1** : `rentalContractRegularizationRoutes.js` — l'acteur est TOUJOURS du staff (jamais le Proprietaire), mais le service comparait `Contrat.proprietaire.user` au scope brut, bloquant à tort le staff légitime sur les dossiers liés à un Proprietaire non affilié. Correctif local dans le contrôleur, réutilisation de la même fonction.

## 3. Pourquoi `resolveTenantScope` ne doit jamais être élargi globalement

Preuve directe (HOTFIX-USERS-COUNT-1) : une première tentative d'ajouter l'extension "tenant unique" au niveau de `resolveTenantScope` (la couche partagée utilisée par `getScopeUserIds`, elle-même consommée par le catalogue public de biens/hôtels via `listPublicProperties`/`getPublicPropertyById`/`listPublicHotels`/`getPublicAccommodationById` et par le reporting) a fait échouer 6 tests de `tenantCore.mongo.integration.test.js` : des biens/hôtels appartenant à des propriétaires non affiliés (tiers concurrents, non liés au tenant demandeur) devenaient visibles dans le catalogue public tenant-scopé d'un tenant unique — une fuite de données réelle. Ce risque structural gouverne toute la méthodologie de cet audit : chaque correction doit rester locale au domaine, jamais dans la couche de résolution partagée.

## 4. Méthode

1. Inventaire exhaustif de tous les usages de `tenantScopeUserIds` (et motifs équivalents `owner:{$in:…}`, `createdBy:{$in:…}`, `manager:{$in:…}`) dans `server/`.
2. Pour chaque occurrence : identifier acteur, ressource, champ comparé, si l'identité peut légitimement être publique-signup sans `OrgMembership`, et si un faux négatif est démontrable par test.
3. Classification stricte (CORRECT / BUG CONFIRMÉ+FIXÉ / BUG CONFIRMÉ NON FIXÉ / RISQUE THÉORIQUE / NON CONFIRMÉ / LEGACY-DEAD).
4. Correction uniquement des bugs prouvés par test AVANT/APRÈS, avec preuve cross-tenant obligatoire.
5. Sweep de régression complet après chaque fix (domaine + tenantCore + cross-tenant + 3 hotfixes précédents).
6. Rapport final + matrice + STOP.

Aucune modification de `resolveTenantScope`, IAM, schémas, frontend, mobile.
