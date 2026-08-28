# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Cause racine

Classification principale : **JEST_ORDER_DEPENDENCY**, mécanisme **INDEX_STATE_LEAK** révélant une **TEST_FIXTURE_LEAK**.

- **WHAT STATE LEAKED?** L'index Mongo `rentalmanagements.property_1`, unique.
- **WHO CHANGED IT?** `rentalAssetOnboardingOptions.mongo.integration.test.js` via `RentalManagement.syncIndexes()`.
- **WHY DID ISOLATED PASS?** `autoIndex:false`, base fraîche, aucun `syncIndexes()` ARCH-2L : Mongo acceptait illégalement deux dossiers pour un même bien.
- **WHY DID EXHAUSTIVE FAIL?** La base est partagée séquentiellement et `deleteMany` conserve les index ; l'index unique existait avant ARCH-2L.
- **WHY DID 6/6 RERUN PASS?** Le rerun isolé démarrait une base fraîche sans matérialiser `property_1`.
- **WHAT MAKES THE FIX DETERMINISTIC?** ARCH-2L synchronise lui-même l'index et sa fixture respecte l'invariant schéma en utilisant un bien distinct pour le préavis.

Ce n'est pas un bug production : la contrainte production est cohérente avec la source de vérité (un RentalManagement par Property). Le défaut était le test qui représentait quatre états KPI avec quatre dossiers mais seulement trois biens. Model cache : non impliqué. Replica Set : oui. DB/collection : partagées dans le runner officiel. Concurrence/race : non, `--runInBand`.
