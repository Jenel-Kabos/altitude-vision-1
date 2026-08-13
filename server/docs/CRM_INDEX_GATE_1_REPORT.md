# CRM-INDEX-GATE-1 — Rapport final

Date : 2026-08-13

## 1. Executive Summary

Le RCA CRM est établi et le correctif applicatif est validé : l'index unique indexait à tort les clients sans source. Les quatre rouges CRM initiaux ont disparu. L'index réel doit toutefois être remplacé par migration et le run Mongo global reste rouge sur quatre incidents non-CRM.

## 2. Initial Blocker

Quatre tests étaient bloqués par `E11000` sur `one_crm_customer_per_tenant_source` avant l'exécution de leur logique métier.

## 3. Four Failing Tests

| Test | Fixture | Attendu | Actuel initial | RCA |
|---|---|---|---|---|
| `tenantCert3Pre` — consolidation B→B | deux clients B sans source | succès | second insert E11000 | faux doublon nul |
| `platformAdminCert1.domains` — liste B | deux clients B sans source | 200 | `beforeAll` E11000 | même cause |
| même suite — merge cross-tenant | mêmes fixtures | refus contrôlé | `beforeAll` E11000 | même cause |
| même suite — merge intra-tenant | mêmes fixtures | succès | `beforeAll` E11000 | même cause |

## 4. CrmCustomer Model

`CrmCustomer` est tenant-scopé et utilise `identityKeys` pour l'identité métier et `sourceRefs` pour les liens canoniques externes.

## 5. sourceRefs Contract

C'est un tableau optionnel de sous-documents stricts. Une vraie entrée exige `entityType` enum, `entityId` ObjectId et `source`. Missing, `null` et `[]` représentent l'absence de source ; un élément partiel est invalide.

## 6. Index Definition

Avant : `{tenant:1, sourceRefs.entityType:1, sourceRefs.entityId:1}`, `unique:true`, nom stable, sans partial, sparse ni collation. Après : mêmes champs/nom/unicité, avec filtre `$type:string` + `$type:objectId`.

## 7. Mongo Null/Missing Behavior

La reproduction fraîche démontre que missing, `null` et tableau vide produisent une clé nulle concurrente sous l'index unique non partiel.

## 8. Minimal Reproduction

Avant fix : 3 échecs (missing/null/empty), 6 succès. Après fix : 1 suite, 9/9 succès.

## 9. Business Intent

Une vraie source canonique est unique par tenant. Plusieurs clients manuels sans source sont légitimes et restent distingués par leurs clés d'identité.

## 10. Root Cause

Divergence entre l'intention métier et un index unique trop large. Elle est indépendante de TENANT-DATA-REGULARIZATION-EXEC-1.

## 11. Chosen Fix

Index unique partiel, limité aux documents portant les deux composants typés d'une vraie source.

## 12. Why Alternatives Rejected

Supprimer l'unicité affaiblirait l'invariant ; modifier les fixtures masquerait un scénario légal ; normaliser seulement en `[]` ne change pas le comportement observé ; service/routes/consolidation ne créent pas le faux doublon.

## 13. Runtime Changes

Un seul point canonique : `models/CrmCustomer.js`.

## 14. Test Changes

Ajout de `__tests__/crmIndexGate1.mongo.integration.test.js`; aucune fixture legacy assouplie.

## 15. Index Changes

Ajout de `partialFilterExpression`; nom, clés et `unique:true` conservés.

## 16. Compatibility

Les requêtes `$elemMatch` et le format des données restent inchangés. Une base fraîche construit directement le bon index ; une base existante exige une migration.

## 17. Manual Customer Tests

Missing, `[]` et `null` : deux clients du même tenant coexistent, 3/3.

## 18. Duplicate Source Tests

Même vraie source + même tenant : E11000 conservé. Même source + tenants différents : permis. Plusieurs sources multikey : doublon protégé.

## 19. Cross-Tenant Tests

Le scope tenant de l'index et les interdictions d'accès/merge cross-tenant restent verts dans les suites ciblées.

## 20. Merge Tests

Consolidation B→B et refus A→B passent après correction.

## 21. Automation Tests

La suite CRM Automation ciblée passe ; aucune résolution source ou déduplication d'événement n'est modifiée.

## 22. CRM Targeted Results

4 suites ciblées, 76/76 tests passés en 95.225 s. Reproduction dédiée : 9/9 en 8.149 s.

## 23. Backend Unit

110 suites, 1265/1265 tests passés en 16.76 s.

## 24. Backend Mongo Global

**FULL RUN FAIL** : 76/80 suites, 844/848 tests, 4 échecs, 9176.201 s. Les quatre échecs CRM initiaux ne sont plus présents. Restent : un 401 Platform Admin, un E11000 `Litige.reference`, et deux timeouts (Socket, Rental Asset).

## 25. Flake Analysis

Les suites Platform Admin et attribution legacy repassent ensemble isolément : 2/2 suites, 32/32 tests en 30.32 s. Le résultat global demeure FAIL. Les deux timeouts n'ont pas été requalifiés en succès.

## 26. Tenant Regression

Audit A–F et moteur d'exécution : 2 suites, 30/30 tests passés en 69.547 s.

## 27. Regularization Recheck

Audit réel et dry-run sur `altitudevision`, tous deux read-only et `writes=0`.

## 28. A–F Recalculation

A=67, B=50, C=0, D=43, E=0, F=216 ; total 376 ; READY=67 ; exclus=309. Valeurs inchangées.

## 29. Manifest Hash Recalculation

`01a3fbe64b566d52ebf4219b7c97d976fc5704ae1383b4d2b678b58622ef882f`, strictement identique au manifeste gelé.

## 30. Production Index Impact

Lecture réelle : l'index existe sur `altitudevision`, mêmes clés, `unique:true`, `background:true`, sans filtre partiel.

## 31. Migration Requirement

Les options ne peuvent pas être ajoutées en place à l'index de même nom. Sprint séparé requis : préflight des doublons réels, procédure contrôlée de remplacement, vérification de définition et tests post-migration, avec rollback documenté. Aucun changement d'index réel ici.

## 32. Remaining Risks

Fenêtre de remplacement de l'index, concurrence d'écriture durant la migration, données sources invalides préexistantes, et quatre échecs non-CRM du run global.

## 33. Files Created

Test minimal, audit, présent rapport, snapshots locaux de recheck audit/manifeste.

## 34. Files Modified

`models/CrmCustomer.js` et mise à jour du rapport dry-run tenant. Aucun moteur d'attribution modifié par ce gate.

## 35. Commands Executed

Audit worktree, recherches/lectures, Jest minimal/ciblé/unit/global/tenant, audit réel read-only, dry-run réel, lecture read-only de `indexes()`, lint/diff checks.

## 36. Real Data Writes

Zéro. Aucun apply, backfill, drop/create index, Cloudinary, commit, push ou deploy. Les écritures de tests visent uniquement Mongo jetable ; les rapports sont locaux.

## 37. Final Verdict

**CRM GATE CLOSED WITH MIGRATION REQUIRED — APPLY STILL BLOCKED**

## 38. Exact Next Step

Ouvrir un sprint distinct de migration de `one_crm_customer_per_tenant_source`, exécuter la migration après autorisation explicite, obtenir un Backend Mongo complet vert, puis refaire le recheck manifeste avant toute demande d'apply tenant.
