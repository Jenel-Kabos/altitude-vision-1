# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Matrice des portes de qualité

| Gate | Commande | Résultat |
|---|---|---|
| Reproduction rouge | `git stash` du correctif + `npx jest __tests__/accommodationCreatedVisibility.mongo.integration.test.js` | **2/3 tests échouent** avec le message exact attendu (`Received: "brouillon"`) — reproduction confirmée |
| Test ciblé (après correctif) | `npx jest __tests__/accommodationCreatedVisibility.mongo.integration.test.js` | **3/3 PASS** |
| Suite unitaire complète (server, sans Mongo) | `npm run test:unit` | **141 suites / 1579 tests — PASS** (aucune régression) |
| Suite Mongo ciblée (Accommodation + HZ-04 + mobile) | `npx jest --runInBand accommodationCreatedVisibility, accommodationAdminListsTenantScope, mobileAccommodationPublicationService` | **3 suites / 37 tests — PASS** — HZ-04 (tenant) et le flux mobile analogue restent verts sans aucune adaptation |
| Suite Mongo complète du projet | `npm run test:mongo` | **106/108 suites, 1097/1111 tests — PASS**. **2 suites en échec, toutes deux sans rapport avec ce hotfix** (voir ci-dessous) |
| Architecture | `npm run architecture:check` (depuis `server/`) | **PASS**, 0 nouvelle violation |
| Lint | `npm run lint` (depuis `server/`) | **0 erreur**, 108 warnings — tous pré-existants, aucun sur les fichiers de ce mandat |
| Diff whitespace | `git diff --check -- server/services/accommodationService.js server/__tests__/accommodationCreatedVisibility.mongo.integration.test.js` | Propre, aucun avertissement |
| Frontend | Aucun fichier `client/` modifié par ce mandat | `npm run build:next` / suite client non requis (mandat §36-37, conditionnels à une modification frontend) |

## Les 2 suites en échec de `npm run test:mongo` — analyse d'indépendance

| Suite en échec | Domaine | Dépendance à `Accommodation`/`accommodationService.js` ? | Fichier modifié par ce mandat ? |
|---|---|---|---|
| `propertyModerationTenantScope.mongo.integration.test.js` | Modération/tenant-scope de **Property** (vente/location/parcelle) | Aucune (`grep` confirmé) | Non — fichier **non tracké**, présent dans l'arbre de travail avant ce mandat (travail en cours d'un mandat antérieur non lié) |
| `tenantScopeAudit2bFinancial.mongo.integration.test.js` | Accès financier **Hôtel** (documents), timeout à 180000ms | Aucune (`grep` confirmé) | Non — fichier déjà commité (`9b5cec9 Update Altimmo 33`), inchangé par ce mandat |

**Ces deux suites échouaient déjà avant toute intervention de ce mandat** (aucun fichier qu'elles exercent n'a été touché par le correctif `HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1`). Elles sont documentées ici par transparence, conformément au mandat, mais **hors périmètre** : les corriger reviendrait à une refonte Property/Financial non demandée par ce mandat, qui porte exclusivement sur la visibilité d'un Accommodation nouvellement créé.

## Verdict des gates

Toutes les portes **du périmètre de ce mandat** sont vertes. Les deux échecs observés dans la suite Mongo globale sont préexistants, indépendants, et documentés pour transparence — non causés par, et non aggravés par, ce hotfix.
