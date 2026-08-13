# CRM-INDEX-GATE-1 — Audit avant correction

Date : 2026-08-13

## Worktree

Le worktree contient de nombreux changements non commités des sprints précédents. Aucun reset, stash ou clean n'a été effectué. Les seuls fichiers propres à CRM-INDEX-GATE-1 seront le test minimal, les deux rapports et, si le RCA le confirme, `models/CrmCustomer.js`.

## Blocker isolé

Les quatre tests rouges sont :

| Test | Fixture | Attendu | Actuel |
|---|---|---|---|
| `tenantCert3Pre` — B→B consolidation | 2 Customers tenant B, `sourceRefs` absent | 201 | second insert E11000 |
| `platformAdminCert1.domains` — liste tenant B | 2 Customers tenant B, `sourceRefs` absent | 200 et isolation | `beforeAll` E11000 |
| même suite — merge cross-tenant | mêmes fixtures | refus contrôlé | `beforeAll` E11000 |
| même suite — merge intra-tenant | mêmes fixtures | 201 | `beforeAll` E11000 |

Les trois derniers sont trois tests rapportés rouges mais une seule panne de fixture `beforeAll` empêche leurs scénarios de démarrer.

## Modèle et contrat métier

`sourceRefs` est un tableau optionnel de `sourceRefSchema`. Chaque élément réel exige `entityType`, `entityId` et `source`; `entityType` est borné par enum. `[]` est l'état normal d'une fiche manuelle ou d'une fiche de consolidation sans source. `null` et missing sont hydratés comme tableau vide par Mongoose. Les éléments partiels sont invalides.

L'intention documentée par CRM-CORE-1 est : une même source canonique réelle ne peut appartenir qu'à un seul Customer d'un tenant. Le service recherche précisément avec `$elemMatch(entityType, entityId)`. Plusieurs Customers sans source externe sont légitimes et doivent être distingués par `identityKeys`, pas collisionner sur une pseudo-source nulle.

## Index actuel

Nom : `one_crm_customer_per_tenant_source`. Champs : `{ tenant: 1, 'sourceRefs.entityType': 1, 'sourceRefs.entityId': 1 }`. Options : `unique:true`; aucun `partialFilterExpression`, aucun `sparse`, aucune collation.

Le manque de filtre est le candidat RCA : Mongo matérialise une clé nulle pour les chemins absents/vides, ce qui fait du second Customer sans source un faux doublon. La reproduction jetable doit confirmer ce comportement avant modification.

## Reproduction et RCA confirmés

Le test jetable `crmIndexGate1.mongo.integration.test.js` a d'abord échoué exactement sur les trois variantes légitimes `missing`, `[]` et `null`, avec une clé dupliquée `{ tenant, sourceRefs.entityType: null, sourceRefs.entityId: null }`. Les six contrôles portant une vraie source, le scope tenant, le multikey et la validation des sous-documents passaient déjà. Le défaut est donc reproductible sans le moteur de régularisation et se situe dans l'index runtime, pas dans les fixtures.

La correction retenue conserve le même triplet de champs et `unique:true`, mais ajoute un `partialFilterExpression` exigeant un `entityType` de type string et un `entityId` de type ObjectId. Après correction, les 9/9 cas passent : plusieurs clients manuels coexistent, un doublon de vraie source dans le même tenant reste refusé, et la même source dans deux tenants reste permise.

## Constat production read-only

Sur `altitudevision`, l'index réel `one_crm_customer_per_tenant_source` existe encore avec `unique:true`, les trois mêmes champs et aucun filtre partiel. Cette lecture n'a effectué aucune mutation. Comme les options d'un index existant ne sont pas modifiables en place, une migration séparée de remplacement contrôlé est requise ; aucun `dropIndex` ni `createIndex` n'a été exécuté ici.
