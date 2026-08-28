# HOTFIX-MOB-GOOGLE-AUTH-2 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40").

**Constat** : HEAD a de nouveau avancé depuis le hotfix précédent de cette session (`91b40ee`), confirmant qu'un processus externe à cette conversation commite périodiquement le dépôt. Tous les documents RBAC/HOTFIX produits durant cette session restent présents sur le disque.

`git status --short` au démarrage de CE hotfix montre un travail en cours **non lié à cette session**, à préserver intégralement :
```
 M scripts/local-ci.js
 M server/__tests__/crmAutomation.mongo.integration.test.js
 M server/__tests__/notificationService.test.js
 M server/package.json
 M server/server.js
 M server/services/crmAutomationEngine.js
 M server/services/notificationService.js
?? altimmo-app/build-1787511872437.apk
?? server/__tests__/architectureBoundaries.test.js
?? server/__tests__/notificationObservationPort.test.js
?? server/architecture/
?? server/docs/ARCH2A_*.md (6 fichiers)
?? server/docs/ARCH2B_*.md (7 fichiers)
?? server/scripts/check-architecture.js
?? server/services/notificationObservationPort.js
```

Cela correspond à un chantier `ARCH2A`/`ARCH2B` (architecture backend, notification ports) visiblement en cours ailleurs, incluant un APK Android déjà construit (`build-1787511872437.apk`) — probablement lié à un test de build antérieur, sans rapport avec ce hotfix. **Rien de tout cela n'est touché ici.**

`git diff --check` : exit 0.

## Périmètre de CE hotfix

Diagnostiquer et corriger, avec le changement minimal prouvé, l'échec de connexion Google depuis l'application Android (`altimmo-app/`) — message générique observé : "Connexion Google indisponible. Veuillez réessayer." Aucune supposition de cause commune avec `HOTFIX-WEB-GOOGLE-AUTH-1` (NextAuth/`trustHost`, Web uniquement). Aucun changement RBAC, aucune refonte d'authentification, aucun deuxième système Google Auth créé.

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement — et en particulier, aucune action sur les fichiers ARCH2A/ARCH2B/APK non liés à ce mandat.
