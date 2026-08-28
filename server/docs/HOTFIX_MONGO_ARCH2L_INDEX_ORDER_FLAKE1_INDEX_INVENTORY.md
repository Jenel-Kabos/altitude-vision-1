# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Inventaire des index

## RentalManagement

Le schéma déclare `property: { required:true, unique:true, index:true }`. Mongo matérialise `property_1` avec key `{property:1}`, `unique:true`, sans `sparse` ni `partialFilterExpression`. Le schéma déclare aussi les index simples `tenant`, `owner`, `active`, `managementActivated`, `occupancyStatus`, `availabilityStatus`, `publicationStatus`, puis `{owner:1,occupancyStatus:1}` et `{publicationStatus:1,availabilityStatus:1}`.

## Origine de l'état

- Déclaratif : `models/RentalManagement.js`.
- Initialisation globale : connexion `autoIndex:false`; le helper ne synchronise automatiquement que les modèles financiers et PaymentAllocation.
- Création impérative réelle : `rentalAssetOnboardingOptions.mongo.integration.test.js` appelle `RentalManagement.syncIndexes()` dans `beforeAll`.
- Fixture ARCH-2L avant fix : aucune synchronisation et deux documents `RentalManagement` avec le même `propertyA2`.
- Nettoyage : `clearFinancialMongo()` et `stopFinancialMongo()` font `deleteMany({})`; ils ne suppriment/restaurent aucun index.
- Aucun `dropIndex`, `dropIndexes`, `createIndex` manuel ou cache de modèle RentalManagement n'est impliqué. Les manipulations d'index Contrat/CRM sont étrangères à `property_1`.

Avant contamination : collection absente, liste d'index `[]`. Après contamination : `_id_` plus dix index déclarés, dont `property_1` unique. Après ARCH-2L rouge : état identique, car `deleteMany` conserve la structure.
