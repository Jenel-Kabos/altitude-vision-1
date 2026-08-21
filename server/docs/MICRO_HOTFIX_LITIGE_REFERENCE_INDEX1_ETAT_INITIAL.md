# MICRO-HOTFIX-LITIGE-REFERENCE-INDEX-1 — État initial

## Baseline

- Branche : `main`
- HEAD : `15506a7b113742ad266cc5977ff06164b6c04994`
- Worktree déjà modifié par PAY-5, PAY-6, PAY-6.1 et HOTFIX-CONVERSATIONS ; changements préservés.
- `git diff --check` : vert avant intervention.

## Reproduction disponible

Le runner exact `npm run test:mongo` a terminé à 93/94 suites et 937/938 tests. L'échec est :

- suite : `tenantAttributionLegacyExtension.mongo.integration.test.js` ;
- test : `Litige : bienConcerné tenant-resolved → resolved ; absent → unresolved` ;
- erreur : Mongo `E11000` (`code: 11000`) ;
- collection : `litiges` ;
- index : `reference_1` ;
- clé : `{ reference: null }`.

La même suite isolée passe à 14/14 avec `autoIndex:false`, ce qui ne prouve pas que le contrat d'index est correct : elle ne synchronise pas explicitement l'index Litige.

## Contrat constaté avant correction

- Schéma : `reference: { type: String, unique: true }` ; ni `required`, ni `default`, ni `sparse`, ni filtre partiel.
- API nominale : `createLitige` génère une chaîne `LIT-<année>-<compteur>` avant insertion.
- Données/flows legacy : les audits et tests créent légitimement des litiges sans référence ; le rapport de régularisation recense également un Litige historique non attribuable.
- Runner : une base unique est partagée séquentiellement ; le nettoyage efface les documents entre suites mais conserve les index. L'existence de l'index dépend donc des modèles synchronisés par les suites précédentes.

## Hypothèse à caractériser

L'unicité métier concerne les références textuelles réelles. Un index unique non partiel traite plusieurs champs absents ou explicitement `null` comme la même clé `null`. L'isolation verte est un faux négatif dû à l'absence d'index synchronisé ; le runner partagé révèle le défaut dès que `reference_1` existe.
