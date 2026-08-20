# HOTFIX-USERS-COUNT-1 — Rapport final

Date : 2026-08-19. Branche `main`. `HEAD` inchangé depuis `HOTFIX_USERS_COUNT1_ETAT_INITIAL.md` (`bfdd67c8f8293c690640fab799b2aae062196d7a`) — aucun commit créé pendant ce hotfix.

Aucun accès à la base MongoDB de production n'a été utilisé à aucun moment. Tout ce document distingue explicitement ce qui est **prouvé par le code/tests** de ce qui reste **NON CONFIRMÉ** faute d'accès à la donnée réelle.

## Réponses aux 20 questions du mandat

**1. Combien de `User` existaient réellement en production ?**
NON CONFIRMÉ — aucun accès à la base de production. Ce que le code prouve : le compte "huinlogistics" est un `User` authentifiable et fonctionnel (accède à `/mes-biens`), donc au moins 2 `User` existent (Admin Altitude Vision + huinlogistics), très probablement davantage.

**2. huinlogistics était-il bien un `User` ?**
Oui, nécessairement — un compte non-`User` ne peut pas passer `authController.protect` (vérification JWT contre la collection `User`), qui est le seul garde sur `/api/properties/my-properties`.

**3. Quel est son rôle ?**
`Proprietaire` — déduit de l'interface "Patrimoine" affichée (spécifique aux propriétaires) et de l'accès fonctionnel à `/mes-biens`. Exact rôle en base : NON CONFIRMÉ à 100 % (pas de lecture directe), mais cohérent avec toutes les preuves disponibles.

**4. A-t-il un document `Proprietaire` lié ?**
NON CONFIRMÉ. Non nécessaire de toute façon : `GET /api/properties/my-properties` ne lit jamais le modèle `Proprietaire`, seulement `authController.protect` + un filtre sur `Property.owner`.

**5. Quel tenant ?**
Aucun — un `User` sans `OrgMembership` et qui n'a pas créé lui-même la racine `OrgUnit`/`PlatformTenant` ne résout aucun tenant via `resolveEffectiveTenantContext`. C'est structurellement prouvé par le code (`tenantContextService.js`), pas une supposition.

**6. A-t-il un `OrgMembership` ?**
Non — prouvé structurellement : `authController.signup` (inscription publique, le seul chemin de création d'un `User` role `Proprietaire`/`Client`/`User`) ne crée jamais d'`OrgMembership` (grep exhaustif, zéro occurrence dans tout `authController.js`).

**7. Pourquoi peut-il se connecter et utiliser `/mes-biens` malgré cela ?**
Parce que `authController.protect` (authentification) ne dépend d'aucun scope tenant, et que `GET /api/properties/my-properties` n'est protégé que par `authController.protect` — aucun `requireTenantScope` sur cette route (confirmé par lecture de `propertyRoutes.js`).

**8. Pourquoi `/dashboard/users` l'excluait-il ?**
Parce que `userController.getAllUsers` interroge `User.find({_id:{$in: req.tenantScopeUserIds}})`, et `req.tenantScopeUserIds` (posé par `requireTenantScope`) est calculé par `getScopeUserIds` = purement `OrgMembership.find({...}).distinct('user')`. Sans `OrgMembership`, huinlogistics n'apparaît jamais dans ce tableau, et n'est jamais poussé explicitement (contrairement à l'Admin, voir Q9).

**9. Quelle est la requête Mongo exacte derrière `/dashboard/users` ?**
```js
// server/controllers/userController.js — getAllUsers (avant correctif)
const users = await User.find({ _id: { $in: req.tenantScopeUserIds || [] } }).select('-password');
```
Et en amont (`middleware/tenantContext.js`, `createRequireTenantScope`) :
```js
const scope = await resolveTenantScope(req.platformTenant._id, { allowAnyStatus: isPlatformOperator });
req.tenantScopeUserIds = Array.from(scope.scopeUserIds || []);
if (context.source === 'legacy_fallback' && !req.tenantScopeUserIds.includes(userId)) {
  req.tenantScopeUserIds.push(userId); // seul cas d'auto-inclusion — explique pourquoi l'Admin SE voit lui-même
}
```
Et `resolveTenantScope` → `getScopeUserIds(tenant.rootOrgUnit)` = `OrgMembership.find({orgUnit:{$in:[...]}, status:'active'}).distinct('user')`.

**10. Quel filtre exact excluait huinlogistics ?**
Le filtre `OrgMembership`-only dans `getScopeUserIds` (via `resolveTenantScope`/`requireTenantScope`), catégorie **D — tenant scoping** du mandat.

**11. Bug ou comportement intentionnel ?**
Un **gap architectural**, pas une frontière de sécurité intentionnelle. `OrgMembership` a été conçu pour le flux d'invitation organisationnelle (staff) et n'a jamais été étendu aux comptes clients/propriétaires créés par inscription publique — aucune trace dans le code d'une volonté délibérée d'exclure ces comptes de la vue admin.

**12. Quelle correction a été appliquée ?**
Une extension **locale au contrôleur** `userController.js` (`getAllUsers` et `getAllOwners`), pas à la couche partagée `resolveTenantScope` (voir Q19 pour l'historique de la tentative initiale, revertée). La fonction `expandScopeWithUnaffiliatedUsersIfSoleTenant(scopeUserIds)` :
- Compte les `PlatformTenant` `trial`/`active` — si ≠ 1, **ne fait rien** (aucune supposition en cas d'ambiguïté multi-tenant réelle).
- Si exactement 1 tenant existe : ajoute au scope tous les `User` actifs, non techniques, non suspendus/bannis/supprimés, qui n'ont ni `OrgMembership` ni entrée `PlatformOperator` — c'est-à-dire les comptes structurellement orphelins qui, sur un déploiement à tenant unique, appartiennent sans ambiguïté à ce tenant.

**13. La sécurité tenant est-elle préservée ?**
Oui — vérifié par 3 niveaux de preuve : (a) le correctif se désactive intégralement dès qu'un second `PlatformTenant` `trial`/`active` existe (aucune supposition en contexte multi-tenant) ; (b) 114/114 tests des suites de certification cross-tenant existantes (`platformAdminCert1.vulnerabilities`, `platformAdminCert1.domains`, `tenantCert.audit`, `tenantCert2.adversarial`, `tenantCert3Pre.adversarial`, `tenantCert3Final.adversarial`) passent sans régression après le correctif ; (c) le nouveau test dédié prouve explicitement qu'un second Admin (Tenant B) ne voit jamais les comptes du Tenant A, affiliés ou non.

**14. Les compteurs sont-ils cohérents après correction ?**
Oui, par construction — les compteurs (`UsersPanel.jsx`) sont un pur calcul frontend (`.filter().length`) sur le même tableau `users` reçu de `GET /api/users` ; ils reflètent donc automatiquement toute correction de ce tableau, sans code frontend à modifier.

**15. Le filtre "Propriétaires" fonctionne-t-il ?**
Oui — c'est un filtre `User.role === 'Proprietaire'` sur le tableau reçu (confirmé par lecture de `UsersPanel.jsx`). Une fois huinlogistics inclus dans la réponse de `GET /api/users` avec son rôle réel `Proprietaire`, il apparaît automatiquement dans cet onglet — vérifié explicitement par le test `le Proprietaire apparaît avec son vrai rôle`.

**16. Les autres rôles sont-ils non régressés ?**
Oui — testé explicitement : `Collaborateur` et `Proprietaire non affilié` reçoivent toujours `403` sur `GET /api/users` (seul `Admin` y accède, `restrictTo('Admin')` inchangé) ; la suite unit complète (1425/1425) et la suite client (588/588) passent sans régression.

**17. L'isolation cross-tenant a-t-elle été testée avec deux tenants réels ?**
Oui — fixtures Tenant A / Tenant B dédiées : Admin A ne voit plus les comptes non affiliés dès que Tenant B existe (repli sûr documenté, pas une fuite) ; Admin B (tenant distinct, staff explicitement rattaché) ne voit jamais aucun compte du Tenant A, affilié ou non.

**18. Quels fichiers ont été modifiés ?**
- `server/controllers/userController.js` — ajout de `expandScopeWithUnaffiliatedUsersIfSoleTenant` + application dans `getAllUsers` et `getAllOwners`.
- `server/__tests__/hotfixUsersCount1.mongo.integration.test.js` (nouveau).
- `server/docs/HOTFIX_USERS_COUNT1_ETAT_INITIAL.md`, `HOTFIX_USERS_COUNT1_USER_MODEL_MATRIX.md`, `HOTFIX_USERS_COUNT1_REPORT.md` (nouveaux).
Aucun autre fichier (routes, middleware, modèles, frontend, mobile) n'a été touché par ce hotfix.

**19. Quels tests ont été ajoutés ?**
`hotfixUsersCount1.mongo.integration.test.js` (7 tests : reproduction du scénario réel tenant unique + inclusion du Proprietaire non affilié + rôle correct ; 2 tests de sécurité cross-tenant avec Tenant A/B ; 2 tests IAM non-régression Collaborateur/Proprietaire → 403). Tous 7/7 verts.
Note d'audit honnête : une première version du correctif modifiait `tenantContextService.resolveTenantScope` (couche partagée). Le balayage de régression précautionneux exigé par le mandat (16 fichiers `*.mongo.integration.test.js` liés au tenant/OrgMembership) a détecté 6 échecs réels dans `tenantCore.mongo.integration.test.js` : l'extension partagée faisait fuiter des propriétaires non affiliés dans le catalogue public tenant-scopé (biens, hôtels, reporting). Cette version a été immédiatement revertée (`git checkout`) avant tout commit, et le correctif déplacé au niveau du contrôleur `userController.js` uniquement — son rayon d'effet est désormais strictement borné à la liste d'utilisateurs, jamais aux ressources métier tierces. Le balayage des 16 fichiers a ensuite été rejoué intégralement : 224/225 verts, le seul échec restant (`Conversations unread 403 signal distinct`) étant reproduit à l'identique sur le code AVANT tout correctif de ce hotfix (`git stash` de vérification) — c'est un défaut préexistant, sans rapport avec ce hotfix, hors périmètre.

**20. Verdict final ?**
**CORRECTIF CERTIFIÉ — cause racine D (tenant scoping / gap architectural OrgMembership) démontrée et corrigée au niveau minimal (contrôleur `userController.js`), sécurité tenant préservée et testée adversairement, aucune régression détectée sur 1425 tests unit serveur + 588 tests client + 339 tests d'intégration Mongo tenant/cert (114 cert + 225 balayage) + build production client.**

## Gates exécutées

| Gate | Résultat |
|---|---|
| Test dédié `hotfixUsersCount1` | 7/7 ✅ |
| Suites certification cross-tenant (6 fichiers) | 114/114 ✅ |
| Balayage régression tenant/org (16 fichiers) | 224/225 ✅ (1 échec préexistant, confirmé identique sans le hotfix) |
| Server unit (`npm run test:unit`) | 1425/1425 ✅ |
| Server lint | 0 erreur (warnings baseline inchangés) ✅ |
| Client tests (`npm test -- --run`) | 588/588 (89 suites) ✅ |
| Client lint | 0 erreur (warnings baseline inchangés) ✅ |
| Client build production (`npm run build:next`) | ✅ succès |
| `git diff --check` | exit 0 (aucun conflit) ✅ |

## Ce qui reste explicitement NON CONFIRMÉ

- Le nombre exact et l'identité des `User` en production.
- L'existence d'un document `Proprietaire` spécifique pour huinlogistics.
- Le rôle exact stocké en base pour huinlogistics (déduit avec un haut degré de confiance, jamais lu directement).
- L'effet visuel réel de la correction sur l'UI `/dashboard/users` en production (rafraîchissement, changement d'onglet) — non testable sans session navigateur/appareil réel ; la preuve apportée est backend/intégration Mongo uniquement.

## STOP

Conformément au mandat (§26) : aucune action supplémentaire n'est engagée au-delà de ce correctif et de ce rapport. Pas de refonte IAM, pas de migration `User`, pas de fusion `User`/`Proprietaire`, pas de nouveau dashboard. En attente de validation explicite avant toute suite.
