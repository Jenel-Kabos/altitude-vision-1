# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Reproduction d'ordre

Le runner officiel crée un unique `MongoMemoryReplSet`, injecte une URI/database partagée à toutes les suites et lance Jest avec `--runInBand`. Il n'y a donc ni parallélisme inter-suite ni race démontrée.

Scénario minimal réel, exécuté dans deux processus Jest successifs sur la même URI :

1. index initiaux `[]` ;
2. `rentalAssetOnboardingOptions.mongo.integration.test.js` : 2/2 PASS et `RentalManagement.syncIndexes()` ;
3. index constaté : `property_1`, `{property:1}`, `unique:true` ;
4. `rentalReportQueryBoundary.mongo.integration.test.js` : FAIL 3/6, exactement les trois `E11000` historiques.

Après fix : ordre contaminant 8/8, ordre inverse 8/8. ARCH-2L a aussi été exécuté trois fois au total dans des processus/ordres contrôlés (isolé, après contaminant, avant contaminant), toujours 6/6. Le script diagnostic temporaire a été supprimé après capture ; aucun outil runtime n'est livré.
