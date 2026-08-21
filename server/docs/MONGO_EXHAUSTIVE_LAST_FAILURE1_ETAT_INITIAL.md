# MONGO-EXHAUSTIVE-LAST-FAILURE-1 — État initial

## Git

- Branche : `main`
- HEAD : `15506a7b113742ad266cc5977ff06164b6c04994` (`Update Altimmo 3`)
- Worktree déjà modifié par PAY-5/PAY-6/PAY-6.1, HOTFIX Conversations et micro-hotfix Litige ; tous ces changements sont préservés.
- `git diff --check` : vert.
- Aucun commit, push, déploiement, reset ou nettoyage destructif.

## Runner exact

- Script npm : `npm run test:mongo`.
- Implémentation : `node scripts/run-mongo-tests.js`.
- Mongo : un `MongoMemoryReplSet` WiredTiger, un membre, une base `altitude_mongo_global_<pid>` partagée séquentiellement.
- Jest : binaire local, `--runInBand`, `--detectOpenHandles`, `--verbose`, filtre `\.(mongo|replica)\.integration\.test\.js$`.
- Config : environnement `node`, `setupFiles=__tests__/setup.js`, `setupFilesAfterEnv=__tests__/externalIsolationAfterEnv.js`, aucun globalSetup/globalTeardown déclaré.
- URI injectée via `MONGODB_FINANCIAL_INTEGRATION_URI` après filtrage par `safeTestEnv`.

## Dernier état connu

Après correction Litige, le runner a encore retourné 1, mais la sortie de l'outil a été tronquée. La suite et l'erreur résiduelles sont donc NON CONFIRMÉES. La prochaine exécution écrit l'intégralité de stdout/stderr dans `/tmp/mongo-exhaustive-run1.log` et l'exit code dans un fichier temporaire séparé.
