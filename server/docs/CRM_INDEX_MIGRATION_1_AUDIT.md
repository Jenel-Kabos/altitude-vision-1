# CRM-INDEX-MIGRATION-1 — Audit Phase 1

Date : 2026-08-13  
Portée : audit, outil, tests et dry-run réel read-only uniquement.

## Garde-fous

Le worktree contient de nombreux changements de sprints antérieurs ; aucun reset, stash ou clean n'est effectué. La Phase 1 interdit tout `dropIndex`, `createIndex`, `syncIndexes` ou changement de document sur `altitudevision`. L'outil sera dry-run par défaut et l'apply cumulera des confirmations exactes, sans option force.

## Contrat audité

- Base attendue : `altitudevision`.
- Collection Mongoose attendue : `crmcustomers`.
- Index : `one_crm_customer_per_tenant_source`.
- Clés ordonnées : `tenant`, `sourceRefs.entityType`, `sourceRefs.entityId`, toutes ascendantes.
- OLD : unique, sans filtre partiel, sparse ou collation ; l'instance réelle auditée porte aussi `background:true`.
- NEW : unique, filtre partiel exigeant `sourceRefs.entityType` de type `string` et `sourceRefs.entityId` de type `objectId`, sans sparse ni collation.

Une vraie source est exactement une entrée satisfaisant ces deux types. Le champ `source` reste requis par le schéma pour les nouvelles écritures, mais ne fait pas partie de la clé ni du filtre Mongo.

## Plan de preuve

L'outil canonisera uniquement `name`, `key`, `unique`, `partialFilterExpression`, `sparse` et `collation`, puis calculera SHA-256. Il refusera l'absence, l'ambiguïté, le drift, une base/collection inattendue, un doublon bloquant ou une définition attendue divergente.

Le test jetable couvrira OLD puis NEW, données intactes, multikey, cross-tenant, idempotence, crash après drop, échec create et concurrence. Sur le réel, seuls `indexes()`, lectures de documents et agrégations sont permis.

## Risques opérationnels initiaux

MongoDB ne fournit pas de remplacement atomique des options d'un index sous le même nom. Entre drop et create, l'unicité n'est plus protégée. Une fenêtre de maintenance bloquant les écritures CRM est donc une précondition probable. La disponibilité d'un snapshot Atlas récent et restaurable doit être confirmée humainement ; aucune sauvegarde n'est supposée. Un rollback OLD peut devenir impossible dès que NEW autorise plusieurs clients sans source dans un tenant.
