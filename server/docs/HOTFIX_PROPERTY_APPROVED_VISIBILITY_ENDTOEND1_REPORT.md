# HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1

**Verdict : GO SOUS RÉSERVES.**

(Le code est prouvé correct sur les trois surfaces et tous les scénarios adversariaux testés ; la réserve porte exclusivement sur le document réel `PARCELLE A VENDRE`, qui reste invisible tant qu'il n'est pas manuellement re-validé — aucune mutation n'a été autorisée ni exécutée sur la base réelle dans ce sprint. Voir critère de sortie détaillé en fin de rapport.)

## 1. État exact du document réel

Requête en lecture seule (`Property.find({title: /PARCELLE A VENDRE/i}).lean()`, aucune mutation) contre la base Atlas configurée dans `server/.env` :

```json
{
  "_id": "6a887b6d3aebee9658c9e4ec",
  "title": "PARCELLE A VENDRE", "type": "Parcelle", "status": "vente",
  "statusAdmin": "Validée", "isPublished": false, "availability": "Disponible", "pole": "Altimmo",
  "price": 80000000, "owner": "6a84080352c6ffabafb26af7",
  "createdAt": "2026-08-21T16:23:09.616Z", "updatedAt": "2026-08-21T21:46:33.464Z", "reviewedAt": "2026-08-21T21:46:33.464Z"
}
```

Identique à l'état déjà documenté par `HOTFIX_PROPERTY_PUBLICATION_VISIBILITY1_REPORT.md` — **inchangé depuis**. Un seul document dans toute la base correspond au critère `status∈{vente,location} & statusAdmin='Validée' & isPublished≠true`.

## 2. Cause racine prouvée

**Dette de données historique, pas un bug de code.** Preuve temporelle directe :

- `git log -S "classicListing" -- controllers/propertyController.js` → commit `51f581e`, `2026-08-21T22:19:15Z` (introduction du correctif de publication atomique par HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1).
- `reviewedAt` du document réel : `2026-08-21T21:46:33.464Z` — **33 minutes avant** ce commit.

Le document a été validé par l'ANCIEN code (qui ne publiait pas atomiquement), avant que le correctif n'existe. Le code actuel, testé par un test d'intégration Mongo reproduisant fidèlement le workflow réel (`propertyApprovedVisibilityEndToEnd.mongo.integration.test.js`), publie correctement et atomiquement toute nouvelle validation, y compris une **re-validation** d'un document déjà `Validée` mais resté `isPublished=false` (réparation idempotente prouvée par test, y compris rejouée deux fois sans effet de bord).

## 3. Pourquoi Sales KPI voyait le bien alors que Sales list ne le voyait pas

`dashboardAnalyticsController.sales()` calcule `total`/`active`/`drafts` à partir de `Property.find({status:'vente', ...ownerScope})` — **sans aucun filtre de publication** (c'est une vue de gestion incluant délibérément les brouillons, pour que le staff sache ce qui reste à traiter). Seul le sous-champ `published` de ce même agrégat applique `{statusAdmin:'Validée', isPublished:true, availability:'Disponible', pole:'Altimmo'}` via un `$cond` — d'où `Valeur totale=80M / Total biens=1 / Actifs=1 / Brouillons=1` **et** `Publiés=0` simultanément, cohérent avec l'état réel du document. La liste (`/properties/portfolio`, `propertyPortfolioService.PROPERTY_PUBLICATION_FILTER`) applique en revanche `isPublished:true` de façon stricte et absolue — d'où son absence de la liste. Ce contraste est un contrat métier délibéré (KPI de gestion vs liste publique stricte), pas une incohérence de requête.

## 4. Pourquoi /dashboard/properties le rejetait

`/dashboard/properties` (`ManagePropertiesPage`, `readOnly`, sans `section`) utilise **le même endpoint** `GET /api/properties/portfolio` que Sales list — donc exactement le même filtre `PROPERTY_PUBLICATION_FILTER`, donc la même exclusion pour la même raison (`isPublished=false`). "Biens éligibles" est dérivé de cette même liste (`filteredProperties.length`), jamais d'une source différente — confirmé par lecture de code. "Tous les biens" est, par contrat déjà documenté depuis HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1, le "portefeuille publiable et dédupliqué", pas un inventaire brut de tous les documents `Property`.

## 5. Pourquoi Home le rejetait

`GET /api/properties/latest?pole=Altimmo` → `runPropertySearch` (chemin public, `optionalAuth`) → `baseFilter = {availability:'Disponible', statusAdmin:'Validée', isPublished:true, pole:'Altimmo'}` — même critère `isPublished:true`, même exclusion, même raison exacte.

## 6. Fichiers modifiés

**Aucun fichier de code (backend ou frontend) n'a été modifié** — aucune cause de code n'a été trouvée à corriger. Seul un fichier de test a été créé : `server/__tests__/propertyApprovedVisibilityEndToEnd.mongo.integration.test.js` (10 tests). Documentation créée : 6 fichiers dans `server/docs/` (`ETAT_INITIAL`, `DOCUMENT_MATRIX`, `QUERY_MATRIX`, `VISIBILITY_MATRIX`, `DATA_REPAIR_MATRIX`, ce rapport).

## 7. Contrat avant/après

**Inchangé — déjà correct avant ce sprint, confirmé par ce sprint.** `updatePropertyStatus` (validation Admin) publie atomiquement (`isPublished = (statusAdmin === 'Validée')`) pour tout `Property` classique (`status ∈ {vente, location}`), jamais pour les hébergements (`classicListing` faux → `Accommodation`/`Hotel` gardent leur cycle séparé, non touché).

## 8. Matrice Sales / Rentals / Properties / Home (preuve par test, voir `VISIBILITY_MATRIX.md`)

| | Sales | Rentals | Properties | Home |
|---|---:|---:|---:|---:|
| Vente approuvée + publiée | OUI | NON | OUI | OUI |
| Vente approuvée, non publiée (cas réel) | NON | NON | NON | NON |
| Location approuvée + publiée | NON | OUI | OUI | OUI |
| Rejetée / Brouillon | NON | NON | NON | NON |
| Après re-validation via le vrai workflow | OUI | NON | OUI | OUI |

## 9. Dette de données historiques

**Oui, confirmée et unique** : 1 document (`PARCELLE A VENDRE`, `_id=6a887b6d3aebee9658c9e4ec`) reste `statusAdmin='Validée', isPublished=false` car validé avant l'existence du correctif atomique. Stratégie de réparation idempotente documentée en détail dans `DATA_REPAIR_MATRIX.md` (rejouer `PATCH /admin/:id/validate` via le dashboard Admin, jamais une mutation directe) — **non exécutée sur la base réelle**, en attente d'autorisation explicite de l'utilisateur.

## 10. Résultats des tests/gates

| Gate | Résultat |
|---|---|
| Nouveau test de reproduction/réparation (Mongo) | 10/10 ✅ |
| Suites Mongo Property/tenant/publication rejouées (portfolio, propertyAsset, tenantHardening, tenantScopeAudit2a) | 5 suites, 62/62 ✅ |
| Tests backend ciblés Property/Sale/Rental/Parcelle | 6 suites, 98/98 ✅ |
| Suite backend unit complète | 127/127 suites, 1459/1459 ✅ |
| Lint backend | 0 erreur ✅ |
| Tests frontend Sales/Properties (ManagePropertiesPage, PropertyAssetComponents) | 2 fichiers, 42/42 ✅ |
| Suite client complète | 93/93 fichiers, 641/641 ✅ |
| Lint client | 0 erreur ✅ |
| Build production | ✅ |
| `git diff --check` | exit 0 ✅ |

## 11. Ce qui reste à faire en production

Ce sprint a travaillé contre la base configurée dans `server/.env` (Atlas, base `altitudevision`) en lecture seule pour l'audit, et contre une base éphémère isolée (`MongoMemoryReplSet`) pour les tests — **jamais contre https://altitudevision.agency directement**, et aucun commit/push/déploiement n'a été effectué. Il n'est donc **pas prouvé** que le code actuellement déployé sur `altitudevision.agency` contient le correctif atomique de HOTFIX-PROPERTY-PUBLICATION-VISIBILITY-1 — seul le code de ce dépôt local, à `HEAD=63880f5`, a été audité et testé. **NON CONFIRMÉ : état du commit réellement déployé en production.** Si le code déployé est bien à jour, la seule action restante est humaine : re-valider `PARCELLE A VENDRE` depuis le dashboard Admin de production pour corriger son `isPublished`. Si le code déployé est en retard sur ce dépôt, un déploiement (hors périmètre et hors autorisation de ce sprint) serait également nécessaire avant toute nouvelle validation.

## Drift architectural documenté (non corrigé, hors périmètre de cette cause)

Trois implémentations indépendantes du prédicat "Property publiquement visible" coexistent dans le code (`propertyPortfolioService.PROPERTY_PUBLICATION_FILTER`, `propertyController.runPropertySearch`'s `baseFilter` inline, `services/publicApi/publicPropertyService.js` pour l'API publique versionnée `/api/public/v1`, avec une différence mineure non liée à ce bug : `availability:{$ne:'Retiré'}` vs `availability:'Disponible'`). Aucune preuve que cette duplication cause un bug observé sur les trois surfaces auditées ici — documenté pour visibilité future, **non corrigé** (mandat §40 : pas d'abstraction sans preuve).

## Critères de sortie — non tous remplis

✓ Le contrat de code est prouvé correct sur les 3 surfaces + Rentals + tous les scénarios adversariaux, avec tests verts.
✗ **`PARCELLE A VENDRE` n'apparaît pas encore réellement sur Sales/Properties/Home**, car sa réparation (re-validation) n'a pas été autorisée/exécutée dans ce sprint.
✓ Aucune règle tenant/publication affaiblie. ✓ Aucun workflow Hotel/Accommodation cassé. ✓ Tests/gates complets verts.

**GO SOUS RÉSERVES** — cause exacte : dette de données historique sur un unique document, réparation idempotente documentée et testée mais non exécutée sans autorisation explicite ; état du déploiement production non confirmé.

## STOP

Conformément au mandat : aucun commit/push/déploiement, aucune mutation de la base réelle, `HotelModerationPage.jsx` et PAY-* non touchés, aucune nouvelle route/service créée. En attente de validation utilisateur — notamment sur l'autorisation de re-valider `PARCELLE A VENDRE` en conditions réelles.
