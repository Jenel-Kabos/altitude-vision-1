# QA-1 — Isolation Mongo inter-suites et certification IAM-3

## 1. Résumé exécutif

Le défaut 81/82 suites et 860/861 tests a été reproduit, isolé et corrigé dans le seul lifecycle Mongo des tests. Deux exécutions complètes consécutives terminent avec `jest-exit=0`; la première confirme explicitement 82/82 suites et 861/861 tests. Les gates serveur, client, IAM-3, build, lint, health et verify sont verts.

## 2. Symptôme initial

Le gate Mongo complet échouait dans le premier test de `altimmoSearch.mongo.integration.test.js`: une recherche publique attendait un seul bien mais en recevait deux. Le document inattendu était `Accommodation finance B`.

## 3. Reproduction

Avant correction, une orchestration sur un replica set et une base partagés a exécuté successivement `tenantCert3Final.adversarial.mongo.integration.test.js` et `altimmoSearch.mongo.integration.test.js`. Résultat: 1 suite en échec sur 2 et 1 test en échec sur 24, avec exactement deux résultats au lieu d'un.

## 4. Test isolé

Les deux suites exécutées avec leur lifecycle Mongo local indépendant passaient. L'échec dépendait donc du partage séquentiel de la base globale, et non du comportement isolé d'une suite.

## 5. Exécution complète

`server/scripts/run-mongo-tests.js` démarre un unique `MongoMemoryReplSet`, crée une base `altitude_mongo_global_<pid>`, injecte son URI à toutes les suites puis lance Jest avec `--runInBand --detectOpenHandles`.

## 6. Bisection

La réduction du corpus a identifié la paire minimale ordonnée `tenantCert3Final` puis `altimmoSearch`. L'exécution est séquentielle; aucune concurrence Jest ne participe au défaut.

## 7. Suite polluante

`tenantCert3Final.adversarial.mongo.integration.test.js` créait des fixtures persistantes en `beforeAll`, supprimait uniquement les profils métier en `afterEach`, puis appelait `stopFinancialMongo()` en `afterAll` sans purge globale.

## 8. Fixture responsable

Le test « Accommodation Finance » créait une `Property` publique intitulée `Accommodation finance B` (`pole=Altimmo`, `status=hebergement`, `statusAdmin=Validée`, `isPublished=true`, `availability=Disponible`, `type=Villa`, `tenant=null`) et une `Accommodation` associée au tenant B, publiée et de type `appartement_meuble`.

## 9. Lifecycle Mongo

`startFinancialMongo()` réutilisait correctement l'URI globale externe. `clearFinancialMongo()` savait vider toutes les collections, mais l'ancien `stopFinancialMongo()` se limitait à déconnecter Mongoose lorsque l'URI externe était utilisée. La base globale conservait donc les fixtures entre suites.

## 10. Cause racine

La cause racine est l'absence de purge dans le teardown commun avant déconnexion d'une base externe partagée. `altimmoSearch` purgeait après chaque test mais pas avant son premier test; ce premier test observait donc les données laissées par la suite précédente.

## 11. Risque produit ou test-only

Le défaut est test-only: runner, helper et base en mémoire. Aucun contrôleur, modèle, filtre public, middleware IAM ni comportement de production n'a été modifié.

## 12. Tenant isolation

Il ne s'agissait pas d'une fuite inter-tenant en production. La recherche concernée est volontairement publique/globale; le résidu avait `Property.tenant=null` et une `Accommodation` liée au tenant B. L'échec provenait exclusivement du partage de la base de test entre suites.

## 13. Correction

`stopFinancialMongo()` appelle désormais `clearFinancialMongo()` avant `mongoose.disconnect()` lorsqu'une connexion est active. Le changement est central, minimal et symétrique pour toutes les suites; aucun retry, skip, changement d'ordre, `forceExit`, affaiblissement d'assertion ou `dropDatabase` n'a été ajouté.

## 14. Test de non-régression

La paire minimale partageant le même replica set et la même base a été rejouée après correction. Elle passe avec 2/2 suites et 24/24 tests.

## 15. Exécutions répétées

La paire minimale a été rejouée trois fois consécutives sur la même base partagée: chaque passage termine à 2/2 suites et 24/24 tests. Le gate Mongo complet a ensuite été exécuté deux fois consécutivement sur deux replica sets éphémères neufs, avec code 0 à chaque fois.

## 16. Mongo ciblé

`altimmoSearch`, `rentalPaymentReceiptsAndCancellation` et `tenantCert2.adversarial` passent ensemble: 3/3 suites, 55/55 tests, en 166,049 s. Ce gate couvre notamment l'isolation tenant et `payments.reverse`.

## 17. Mongo complet

- Passage 1: 82/82 suites, 861/861 tests, 0 snapshot, 1 027,909 s, `jest-exit=0`.
- Passage 2: même corpus complet, `jest-exit=0`, 1 029,465 s, arrêt propre du replica set.

## 18. Serveur

Gate unitaire complet hors tests Mongo/replica: 116/116 suites, 1319/1319 tests, 0 snapshot, 124,339 s.

## 19. Client

Vitest complet: 79/79 fichiers, 533/533 tests, 30,50 s. Une première invocation locale avec l'option Jest non reconnue `--runInBand` a été immédiatement corrigée par la commande canonique `npm test`; elle ne constitue pas un échec produit.

## 20. IAM-3

Le gate ciblé IAM-3 passe: 8/8 suites et 184/184 tests. Les règles IAM-3 existantes, dont la mutation `payments.reverse` réservée à Admin, restent inchangées par QA-1.

## 21. AUTH/Tenant

Les scénarios AUTH, sélection de tenant, capabilities, ownership et refus 401/403 sont couverts par les 1319 tests serveur, les 184 tests IAM-3 ciblés et les 55 tests Mongo ciblés. Aucun assouplissement d'autorisation n'a été introduit.

## 22. Build

Le build de production Next.js 15.5.23 compile avec succès, effectue les contrôles de types/lint et génère les routes attendues. Les avertissements de données navigateur obsolètes sont non bloquants et préexistants.

## 23. Lint

- Serveur: 0 erreur, 110 avertissements.
- Client: 0 erreur, 269 avertissements.

Les avertissements sont une dette existante; QA-1 n'en ajoute pas dans le helper corrigé.

## 24. Health/Verify/CI/Release-check

`health` passe avec 28 OK, 0 avertissement et 0 erreur bloquante. `verify:server` et `verify:client` passent. Les scripts racine `ci` et `release-check` n'ont pas été exécutés car ils incluent explicitement les gates de l'application mobile, hors périmètre et interdite de modification par le mandat; leurs constituants serveur/client applicables ont été exécutés directement.

## 25. Dette restante

La stratégie conserve une base globale partagée pour la vitesse; son isolation repose désormais sur le teardown commun. Les avertissements lint et les avertissements Next/Vitest restent à traiter séparément. Aucun retry ou mécanisme masquant la flakiness n'a été introduit.

## 26. État Git

Branche `main`, HEAD `c523b3118549da770bc761d5e7b93de8deb58605`. Les changements IAM-2/IAM-3 préexistants ont été conservés. QA-1 ajoute les deux rapports et modifie uniquement `server/__tests__/helpers/financialMongoEnvironment.js`. `git diff --check` passe. Aucun commit, push, deploy, changement de credential, accès Cloudinary ni changement mobile n'a été effectué.

## 27. Verdict de certification

**QA-1 CERTIFIÉ VERT**

Cause racine prouvée avant correction, isolation inter-suites restaurée, reproduction minimale stabilisée, deux gates Mongo complets consécutifs verts et absence de régression sur les gates applicables.
