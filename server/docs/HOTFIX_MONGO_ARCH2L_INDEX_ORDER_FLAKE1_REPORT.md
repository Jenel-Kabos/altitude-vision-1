# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Rapport final

## Verdict

**CERTIFIÉ VERT.** Cause reproduite, correctif test-only minimal, premier Mongo exhaustif post-fix 102/102 suites et 1026/1026 tests. La dernière réserve de `HOTFIX-ACCOMMODATION-RESERVATION-TENANT-SCOPE-1` peut être levée : ses autres gates restent verts.

## Réponses obligatoires 1–120

1–4. HEAD `a04055f62952c782b92aeef2f100824a17a5f645`, branche `main`, worktree initial fortement dirty et préservé ; inventaire dans `ETAT_INITIAL`.

5–15. Trois tests exacts : Owner A complet, multi-owner, PlatformOperator global, tous dans `rentalReportQueryBoundary.mongo.integration.test.js`. Erreur `MongoBulkWriteError E11000`, code 11000, model RentalManagement, collection `rentalmanagements`, index `property_1`, key `{property:1}`, unique oui, sparse non, partial filter non.

16–21. Index déclaré dans `models/RentalManagement.js` sur le champ schema `property`; matérialisé par le test `rentalAssetOnboardingOptions` via `syncIndexes`, pas par setup global. ARCH-2L verrouille les KPI locatifs read-only et l'isolation owner/global.

22–30. Isolé avant fix : 6/6, confirmé. Répété après fix : trois passages/ordres, tous 6/6. Dépendance d'ordre prouvée. Contaminant : `rentalAssetOnboardingOptions.mongo.integration.test.js`, identifié par recherche exhaustive des appels `RentalManagement.syncIndexes`, puis reproduction minimale sur URI partagée. Commande : script Node diagnostic temporaire lançant successivement les deux fichiers Jest sur un Replica Set commun ; script supprimé après preuve.

31–47. Avant contamination : aucun index/collection. Après : `_id_` et les dix index RentalManagement, dont `property_1` unique. DB et collection partagées par le runner ; un seul MongoMemoryReplSet. `deleteMany` oui, `dropDatabase` non pour ces suites, `dropIndexes` non, `syncIndexes` oui par contaminant, `createIndexes` indirect via Mongoose, `autoIndex:false`. Cache modèle non impliqué. Jest parallèle non ; race non démontrée.

48–58. Cause principale JEST_ORDER_DEPENDENCY, mécanisme INDEX_STATE_LEAK et fixture non conforme. Pas GLOBAL_SETUP_DEFECT principal, pas MODEL_CACHE_LEAK, pas CONCURRENCY_RACE, pas REAL_PRODUCTION_BUG. Le 6/6 passait faute d'index. Rouge déterministe réel obtenu, sans fabriquer d'état impossible.

59–71. Fix : synchroniser RentalManagement dans la suite cible et ajouter `propertyA3` pour le préavis. Un seul fichier test modifié. Production non, métier non, index production non, contrainte supprimée non, skip non, retry non, timeout non, assertion affaiblie non. Setup déterministe car le test matérialise toujours le schéma réel et chaque dossier a un bien distinct.

72–85. ARCH-2L post-fix 6/6. Ordre contaminant 8/8. Ordre inverse 8/8. Runs contrôlés déterministes. Mongo exhaustif officiel : 102 suites, 1026 tests, tous verts ; premier run post-fix vert.

86–105. Backend complet : 141 suites, 1566 tests, tous verts. Matrice tenant 25/25. Lifecycle/finance 14/14. PlatformOperator global/scoped vert dans la matrice. Checker 7/7. Architecture PASS : service→controller 2, controller→controller 1, route→model 12, cycles 0, unresolved 0, violations nouvelles 0. Lint 0 erreur/108 warnings. Diff-check : mêmes trois CRLF connus. Frontend/mobile/production Accommodation non modifiés.

106–113. Frontend non, mobile non, code production Accommodation non, logique métier ARCH-2L non, DB production non, commit non, push non, deploy non.

114–120. Flake fermé par invariant auto-vérifié et confirmé dans l'ordre officiel ; il ne dépend plus de l'ordre testé. Gate officiel fiable sur ce mécanisme. Réserve Accommodation levable car Mongo exhaustif et tous ses gates dédiés sont verts. Verdict micro-hotfix : CERTIFIÉ VERT. Verdict recommandé AccommodationReservation : CERTIFIÉ VERT.

## Fichiers du micro-hotfix

- `server/__tests__/rentalReportQueryBoundary.mongo.integration.test.js`.
- Les neuf documents `HOTFIX_MONGO_ARCH2L_INDEX_ORDER_FLAKE1_*`.
- Mise à jour documentaire du verdict final AccommodationReservation.

Aucun commit, push ou déploiement.
