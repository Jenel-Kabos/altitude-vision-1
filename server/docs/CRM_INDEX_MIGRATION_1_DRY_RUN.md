# CRM-INDEX-MIGRATION-1 — Dry-run Phase 1

Date : 2026-08-13  
Verdict : **READY FOR HUMAN INDEX MIGRATION AUTHORIZATION — PHASE 2 NOT EXECUTED**

## Cible et définitions

- Database : `altitudevision`
- Collection : `crmcustomers`
- Index : `one_crm_customer_per_tenant_source`
- Clés OLD et NEW, dans l'ordre Mongo : `{ tenant: 1, 'sourceRefs.entityType': 1, 'sourceRefs.entityId': 1 }`
- OLD réel : `unique:true`, aucun `partialFilterExpression`, sparse ou collation (`background:true` est présent mais exclu du fingerprint métier déterministe).
- NEW attendu : `unique:true`, `partialFilterExpression: { 'sourceRefs.entityType': { $type:'string' }, 'sourceRefs.entityId': { $type:'objectId' } }`, sans sparse ni collation.
- CURRENT_INDEX_FINGERPRINT : `417e9fb8902a0a3ba148a77fc2994dcdcfcb89166f117e5e9c804d7dff47f0ec`
- EXPECTED_INDEX_FINGERPRINT : `3ebb283a16e715301960c9e5c0a2dca155f1b7760fad8333fa4fafeea884a081`

## Audit CRM réel read-only

| Mesure | Nombre |
|---|---:|
| CrmCustomer total | 0 |
| sourceRefs absent | 0 |
| sourceRefs null | 0 |
| sourceRefs [] | 0 |
| sans vraie source | 0 |
| avec vraie source | 0 |
| sourceRefs partiel/invalide | 0 |
| doublon dans un document | 0 |
| vraie source dupliquée même tenant | 0 |
| vraie source partagée entre tenants | 0 |

Compatibilité : **READY**, aucun doublon bloquant et aucune donnée à transformer.

## Outil et migration jetable

`scripts/migrateCrmCustomerSourceIndex.js` est dry-run par défaut. L'apply exige cumulativement `--apply`, les confirmations exactes de base/index et les deux fingerprints. Il refuse l'index absent, ambigu, drifté, les doublons, la mauvaise base/collection et toute définition inattendue. Aucun `syncIndexes` global ni `--force`.

La matrice Mongo jetable passe 9/9 : collision OLD reproduite ; NEW autorise missing/null/[] ; doublon réel même tenant refusé ; cross-tenant permis ; multikey protégé ; documents/IDs inchangés ; deuxième exécution `ALREADY_MIGRATED`; crash après drop détecté `INDEX_STATE_UNEXPECTED`; échec create explicite ; deux migrations concurrentes donnent un seul remplacement.

## Maintenance, backup, ordre et recovery

Le remplacement sous le même nom n'est pas atomique : il existe une fenêtre sans index entre drop et create. Une **fenêtre de maintenance bloquant toutes les écritures CRM** est requise. Avant Phase 2, confirmer humainement un snapshot Atlas récent/restaurable ; aucune preuve locale ne permet d'affirmer qu'il existe.

Ordre recommandé : déployer d'abord le code compatible NEW avec auto-index/sync désactivé, ouvrir la maintenance CRM, refaire le preflight/fingerprint, migrer l'index, vérifier, puis rouvrir. `NEW code + OLD index` conserve la restriction historique pendant la courte transition ; `OLD code + NEW index` peut déjà autoriser des états que le rollback OLD ne supporterait plus.

Recovery après crash/drop ou create failure : maintenir les écritures CRM fermées, constater l'absence via `indexes()`, ne pas relancer automatiquement, refaire l'audit de doublons, puis créer NEW par procédure humaine dédiée et vérifier son fingerprint. Le script fail-closed sur l'absence. Le rollback OLD n'est possible que tant qu'aucun second client sans source d'un même tenant n'a été créé ; ce n'est pas un rollback de données.

## Résultats de tests

- Migration jetable : 1 suite, 9/9, 12.635 s.
- CRM ciblé, index, automation, merge/consolidation et adversarial : 5 suites, 85/85, 118.376 s.
- Backend Unit : 110 suites, 1265/1265, 18.073 s.
- Timeouts historiques Socket/Rental Asset : 4/4 en 23.927 s, puis 4/4 en 24.256 s ; aucun timeout reproduit.
- Backend Mongo FULL RUN : **FAIL**, 79/81 suites, 855/857 tests, 2 échecs non-CRM, 994.231 s. Les deux suites repassent isolément : 2/2, 29/29 en 35.379 s. Aucun PASS global n'est revendiqué.
- Tests tenant : 2 suites, 30/30, 68.667 s.

## Tenant et absence de mutation

Recheck réel : A=67, B=50, C=0, D=43, E=0, F=216, READY=67, exclus=309. Hash : `01a3fbe64b566d52ebf4219b7c97d976fc5704ae1383b4d2b678b58622ef882f`, strictement inchangé.

**NO REAL INDEX CHANGE** · **NO REAL DATA WRITE** · **NO CLOUDINARY CALL** · **NO COMMIT/PUSH/DEPLOY**.

La migration réelle et l'apply tenant restent bloqués jusqu'à autorisations humaines distinctes.
