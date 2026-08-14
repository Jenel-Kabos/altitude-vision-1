# QA-1 — ÉTAT INITIAL DE L’ISOLATION MONGO

Date : 2026-08-14  
Branche/HEAD : `main` / `c523b3118549da770bc761d5e7b93de8deb58605`

## 1. État Git

Le worktree contient les changements IAM-2/IAM-3 attendus et non commitées. `git diff --check` passe. Aucun fichier n'a été reverté. QA-1 n'a encore modifié aucun helper ou test au moment de ce rapport.

## 2. Commande Mongo complète

`npm run test:mongo -- --runInBand` appelle `node scripts/run-mongo-tests.js`, qui crée un unique `MongoMemoryReplSet`, injecte son URI par `MONGODB_FINANCIAL_INTEGRATION_URI`, puis lance Jest avec `--runInBand --detectOpenHandles` sur les tests `.(mongo|replica).integration.test.js`.

## 3. Test échouant

`altimmoSearch.mongo.integration.test.js` — « hebergement ne retourne QUE des hébergements ». Attendu : 1 résultat (`Villa Meublée 1`). Reçu : 2 résultats.

## 4. Comportement isolé

La suite `altimmoSearch` seule passe. Sans URI externe, `startFinancialMongo` crée sa propre base datée et aucune fixture antérieure n'existe.

## 5. Comportement en suite complète

Le gate complet a produit 81/82 suites et 860/861 tests. Le premier test `altimmoSearch` observe une annonce créée par une suite précédente. Le même échec est reproduit avec le couple minimal et un replica set partagé explicitement.

## 6. Propriété résiduelle

- `_id` de la reproduction minimale : `6a7ebac3a6aa1145f61255ae` (variable à chaque run);
- titre : `Accommodation finance B`;
- `pole=Altimmo`, `status=hebergement`, `statusAdmin=Validée`;
- `isPublished=true`, `availability=Disponible`;
- type : `Villa`, owner : utilisateur B;
- `Property.tenant=null`;
- `Accommodation` associée : `publicationStatus=publie`, `tenant=tenantB`, type `appartement_meuble`.

Elle satisfait exactement les critères publics canoniques et ne doit pas être rendue invisible par modification du filtre produit.

## 7. Database/connection utilisée

Architecture démontrée : `run-mongo-tests.js → un ReplicaSet → une URI/database altitude_mongo_global_<pid> → Jest runInBand → connexion mongoose globale réutilisée séquentiellement par les suites`. `startFinancialMongo` réutilise l'URI externe; `stopFinancialMongo` déconnecte Mongoose mais ne nettoie pas la base partagée.

## 8. Lifecycle

`altimmoSearch` appelle `clearFinancialMongo` en `afterEach`, donc jamais avant son premier test. `tenantCert3Final` construit tenants/utilisateurs en `beforeAll`, crée Property/Accommodation pendant ses tests, ne supprime après chaque test que `UserBusinessProfile`, puis appelle seulement `stopFinancialMongo` en `afterAll`. Les collections métier restent donc présentes pour la suite suivante.

## 9. Suites suspectes

Suite responsable confirmée : `tenantCert3Final.adversarial.mongo.integration.test.js`. Une recherche transversale trouve aussi plusieurs suites utilisant `startFinancialMongo/stopFinancialMongo` sans nettoyage complet; elles constituent le même risque latent.

## 10. Hypothèses

Hypothèse confirmée : cleanup de fin de suite absent sur une database volontairement partagée. Hypothèses écartées : concurrence Jest (runInBand), écriture non awaitée et filtre public produit incorrect.

## 11. Méthode de bisection

La chaîne exacte a été obtenue par le titre reçu, `rg` vers sa fixture, audit des hooks, puis reproduction : `tenantCert3Final + altimmoSearch` sur le même URI → 1 échec/24 tests; les mêmes suites sans URI partagé → 24/24, car chaque suite crée sa propre base.

## 12. Classification sécurité

Scénario A, pollution test-only. La recherche Altimmo concernée est publique et globale; la propriété publiée du tenant B est normalement visible publiquement. `Property.tenant` est null tandis que l'Accommodation est tenant B, mais aucune requête tenant-scoped A n'est impliquée dans l'échec. Aucune fuite cross-tenant produit n'est démontrée.

Chaîne de cause : `tenantCert3Final → fixture Accommodation finance B → afterAll sans cleanup → database globale partagée → premier test altimmoSearch avant son afterEach → résultat N+1`.
