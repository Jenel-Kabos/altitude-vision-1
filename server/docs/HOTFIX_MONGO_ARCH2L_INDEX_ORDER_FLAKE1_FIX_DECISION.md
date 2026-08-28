# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Décision de correction

Options examinées : supprimer/affaiblir l'index (rejeté), désactiver les index (rejeté), dropper les index en teardown (rejeté, masque le contrat), modifier la query métier (rejeté), retry/skip/timeout (rejeté), rendre la fixture et son setup conformes au schéma (retenu).

Correction unique dans `__tests__/rentalReportQueryBoundary.mongo.integration.test.js` :

- `beforeAll` attend `startFinancialMongo()` puis `RentalManagement.syncIndexes()` ;
- ajout de `propertyA3`, même owner A ;
- le dossier `preavis` référence `propertyA3` au lieu de dupliquer `propertyA2`.

Les KPI attendus restent strictement identiques : Owner A possède toujours un disponible, un occupé et un préavis ; Owner B reste inchangé. Aucun service, controller, modèle, index production, règle locative, assertion ou timeout n'est modifié. Cette solution expose immédiatement toute future fixture non conforme, même isolément.
