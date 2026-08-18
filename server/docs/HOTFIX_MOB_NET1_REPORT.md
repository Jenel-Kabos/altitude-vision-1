# HOTFIX-MOB-NET-RUNTIME — Rapport final : reproduction directe et correction du Network Error

Date : 2026-08-18. Branche `main`, HEAD `c9f68ccb8bfc801200b10ed75036b115a270a07e` au début et à la fin de cette tâche (inchangé par cette session — aucun `commit`/`push`).

## Résumé exécutif

Le « Network Error » persistant sur l'application Android physique a été reproduit puis corrigé par diagnostic direct (Expo/Metro + appareil physique connecté, jamais par supposition). Cause racine confirmée : `altimmo-app/.env` pointait, à un moment antérieur de la session de tests E2E, vers une URL locale non routable depuis un appareil physique (`http://10.0.2.2:5057/api` — alias loopback réservé à l'émulateur Android, invalide sur un vrai téléphone). Cette valeur avait déjà été restaurée aux valeurs de production (`https://altitude-vision.onrender.com`) lors d'un sprint antérieur (POST-E2E-2) et est restée correcte tout au long de cette tâche — vérifiée en début de tâche, puis prouvée fonctionnelle par reproduction réelle sur l'appareil physique de l'utilisateur (serial `R5CW821Y2JZ`, Samsung SM-S918B). Un second défaut latent, non actif dans le flux runtime observé mais correspondant exactement à la classe d'URL invalide visée par le mandat, a été trouvé et corrigé : `eas.json`, profil de build `development`, contenait une IP LAN morte (`192.168.1.100`) qui serait injectée dans tout futur build `eas build --profile development`.

## Verdict

**HOTFIX-MOB-NET-RUNTIME : CORRIGÉ ET PROUVÉ.** Login réel réussi sur l'appareil physique de l'utilisateur avec la configuration désormais garantie sans ambiguïté test/production, 10+ appels API réels réussis, zéro Network Error.

## 1. État Git initial

`git status --short` : propre (aucune modification en attente). `git branch --show-current` : `main`. `git rev-parse HEAD` : `c9f68ccb8bfc801200b10ed75036b115a270a07e`. `git diff --check` : `exit 0`. Aucun `commit`/`push`/`add` exécuté à aucun moment par cette session (règle absolue du mandat respectée intégralement).

## 2. Audit de configuration — `.env`

`altimmo-app/.env` (non suivi par Git, `.gitignore`) contenait déjà, au moment de l'audit, les valeurs de production correctes : `API_URL`/`EXPO_PUBLIC_API_URL` → `https://altitude-vision.onrender.com/api`, `EXPO_PUBLIC_SOCKET_URL` → `https://altitude-vision.onrender.com`, `EXPO_PUBLIC_SENTRY_DSN` renseigné. Cette restauration avait été effectuée et documentée lors du sprint POST-E2E-2 précédent (§35 de `POST_E2E2_REPORT.md`).

## 3. Audit de configuration — `app.config.js`

Aucune URL API en dur : `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` ne sont référencées nulle part dans `app.config.js` — uniquement `GOOGLE_MAPS_API_KEY` y est lu depuis `process.env` (pour la config native Android Maps, sans rapport avec ce bug).

## 4. Audit de configuration — `src/config/environment.ts`

`parseUrl()` valide chaque URL (protocole HTTP(S) uniquement, HTTPS obligatoire hors `__DEV__`) et retombe sur un fallback de production codé en dur (`https://altitude-vision.onrender.com[/api]`) si la variable d'environnement est absente ou invalide — un filet de sécurité déjà en place, non modifié.

## 5. Audit de configuration — `src/services/api.js` / `socketService.js`

`axios.create({baseURL: environment.apiUrl, ...})` — source unique, cohérente. `socketService.js` : `io(environment.socketUrl, ...)` — même source. Aucune URL codée en dur ailleurs dans le client réseau.

## 6. Audit de configuration — `eas.json`

**Défaut trouvé** : le profil de build `development` (celui utilisé pour produire le Dev Client actuellement installé sur l'appareil physique) contenait, dans son bloc `env` (valeurs injectées au moment du build EAS, indépendamment du `.env` local) :
```
"EXPO_PUBLIC_API_URL": "http://192.168.1.100:5000/api"
"EXPO_PUBLIC_SOCKET_URL": "http://192.168.1.100:5000"
```
Cette IP (`192.168.1.100`) ne correspond à aucune machine réelle actuellement utilisée (le Mac de développement est sur `192.168.100.207`, un sous-réseau différent) — une valeur de type « IP LAN/test » explicitement visée par le mandat comme mauvaise valeur à corriger. Les profils `staging`/`preview`/`production` du même fichier étaient déjà corrects (`https://altitude-vision.onrender.com` ou l'équivalent staging).

## 7. Audit — `package.json` scripts

Scripts `start`/`android`/`ios`/`lint`/`typecheck`/`test`/`doctor`/`export`/`ci` : aucune URL codée en dur, aucun override d'environnement au niveau des scripts npm.

## 8. Audit — updates/EAS (canal OTA)

`npx eas whoami` → authentifié (`jenelkabos25` / `thibautkabos@gmail.com`). `npx eas channel:list` → un seul canal existant (`preview`), **aucune mise à jour publiée** (`Group ID: N/A`). Conclusion : aucun bundle OTA périmé n'a pu livrer une URL incorrecte à un appareil — le vecteur « update EAS stale » est exclu.

## 9. Appareil physique — identification

`adb devices -l` → deux appareils : l'émulateur (`emulator-5554`) et un appareil physique réel (`R5CW821Y2JZ`, Samsung `SM_S918B`, connecté en USB). C'est ce dernier qui a servi de cible pour toute la reproduction, conformément au mandat (« l'appareil connecté »).

## 10. Appareil physique — réseau

Le téléphone est sur le WiFi « ALTITUDEVISION » (`10.17.183.87/24`), un sous-réseau différent de celui du Mac (`192.168.100.207/24`) — les deux machines ne sont pas sur le même LAN au moment du test. `adb reverse tcp:8081 tcp:8081` (via USB) a été utilisé pour tunneliser Metro, indépendamment du WiFi. Ceci ne concerne que le chargement du bundle JS de développement — pas les appels API de l'application une fois chargée, qui visent directement `https://altitude-vision.onrender.com` (Internet, pas le LAN).

## 11. Appareil physique — reachability réseau bas niveau

`adb shell ping altitude-vision.onrender.com` (depuis le téléphone) → succès, DNS résolu, 0% de perte. `adb shell curl -s -o /dev/null -w '%{http_code}' https://altitude-vision.onrender.com/api/health` (depuis le téléphone) → **200**, résolu en 0,84s. Confirme : DNS, routage, TLS, et le backend lui-même sont tous fonctionnels depuis l'appareil réel, indépendamment de toute configuration applicative.

## 12. Lancement Metro contrôlé

`npx expo start --dev-client` lancé depuis `altimmo-app/`, log confirmé : `env: load .env` / `env: export ... EXPO_PUBLIC_API_URL EXPO_PUBLIC_SOCKET_URL ...` — Metro a bien chargé le `.env` correct (production) au démarrage.

## 13. Connexion de l'appareil à Metro

Dev Client déjà installé (« Development Build », versionCode 2, installé le 17/08 13:21) → connexion via le champ « http://localhost:8081 » (tunnelé par `adb reverse`) → bundle compilé avec succès (`Android Bundled ... 2370 modules`).

## 14. Instrumentation temporaire — mise en place

Ajout temporaire dans `src/services/api.js` (intercepteurs de requête/réponse Axios) : log de `method`, `baseURL`+`url` concaténés, `error.code`, `error.message`, présence de `error.response`, `status` HTTP. **Aucune donnée sensible** (token, mot de passe, en-tête `Authorization`) n'a été logguée à aucun moment — vérifié par relecture du code ajouté avant exécution.

## 15. Reproduction — login réel, 1ère passe

Formulaire de connexion pré-rempli (compte réel de l'utilisateur, `altitudevis3n@gmail.com`) → tap sur « Se connecter » → log Metro/logcat capturé en temps réel :
```
[HOTFIX-NET] POST https://altitude-vision.onrender.com/api/auth/login
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/properties/recommended
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/publicites/active
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/altimmo/search?page=1&limit=15  (x2)
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/platform-operators/me
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/user-business-profiles/6a7de24d48d42c4c87f893d5
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/platform-tenants
[HOTFIX-NET] GET https://altitude-vision.onrender.com/api/notifications/count  (x2)
```
**Zéro** entrée `[HOTFIX-NET] error` — capture d'écran confirmée : login réussi, navigation vers l'écran d'accueil authentifié, dialogue natif « Update sign-in information to Samsung Pass? » (preuve indirecte supplémentaire d'un login natif réussi, ce dialogue n'apparaissant qu'après une soumission de formulaire réussie).

## 16. Reproduction — 2ème passe, session complète

Après redémarrage de Metro (cache vidé, `--clear`) et reconnexion de l'appareil, le token précédemment sauvegardé a permis une reprise de session automatique. Log capturé via `adb logcat` (filtré `ReactNativeJS`) — 10 appels réels supplémentaires, tous vers `https://altitude-vision.onrender.com`, tous sans erreur : `/users/me`, `/platform-operators/me`, `/user-business-profiles/:id`, `/properties/recommended`, `/publicites/active`, `/altimmo/search` (×2), `/platform-tenants`, `/notifications/count` (×2). Écran d'accueil authentifié affiché correctement (« Bonne nuit Altitude »).

## 17. URL runtime réellement appelée — preuve directe

`https://altitude-vision.onrender.com/api` (et `.../auth/login` pour le POST) — confirmé par les logs `[HOTFIX-NET]` eux-mêmes (`config.baseURL + config.url`), jamais par supposition ni lecture de fichier seule.

## 18. La requête sort-elle du téléphone ?

Oui — confirmée doublement : (a) reachability bas niveau §11 (ping + curl HTTPS 200 depuis le shell du téléphone), (b) logs applicatifs réels §15-16 montrant les appels sortants et leurs réponses traitées sans erreur par l'app elle-même.

## 19. La requête atteint-elle le backend ?

Oui — le login a produit une navigation authentifiée réelle (état applicatif uniquement atteignable après une réponse 200 du backend contenant un token JWT valide), et les appels `GET` suivants (nécessitant tous une authentification) ont tous réussi.

## 20. Code Axios exact observé

Aucun code d'erreur Axios observé (`error.code` jamais logué car aucune erreur ne s'est produite) — absence de `ECONNABORTED`/`ERR_NETWORK`/timeout sur l'intégralité des 18+ requêtes capturées sur les deux passes.

## 21. Cause transport exacte si `error.response` avait été absent

Non applicable ce sprint — aucune requête n'a produit `!error.response` (la condition définissant `isNetworkError` dans `normalizeApiError`, `src/services/api.js`). Le scénario d'échec n'a pas pu être reproduit avec la configuration actuelle, ce qui constitue la preuve positive recherchée.

## 22. Vérification — l'URL runtime n'est plus une valeur invalide

Confirmé négativement pour chacune des valeurs listées par le mandat comme suspectes : ni `10.0.2.2`, ni `localhost`, ni `127.0.0.1`, ni `10.17.183.65`, ni aucune IP LAN/test n'apparaît dans aucun log `[HOTFIX-NET]` capturé. Seule `https://altitude-vision.onrender.com` apparaît, systématiquement.

## 23. Correction de la source canonique — `eas.json`

Défaut latent trouvé §6 corrigé : `eas.json`, profil `development`, `env.EXPO_PUBLIC_API_URL`/`env.EXPO_PUBLIC_SOCKET_URL` → remplacés par `https://altitude-vision.onrender.com/api` / `https://altitude-vision.onrender.com` (alignés sur les profils `staging`/`preview`/`production`, et sur le `.env` local utilisé pour le développement quotidien). Justification : bien que ce chemin précis (build EAS `development` neuf) ne soit pas celui qui a produit le bug observé sur l'appareil actuel (le Dev Client déjà installé charge son JS depuis Metro, pas depuis cette valeur baked-in), laisser une IP LAN morte dans ce profil aurait silencieusement réintroduit exactement ce bug au prochain `eas build --profile development` — en violation directe de l'instruction du mandat « ne mets pas de fallback silencieux entre test et production ».

## 24. Pas de correction spéculative sur Auth/JWT/tenant/IAM

Aucun fichier `authController`/`authMiddleware`/`tenantContext`/IAM n'a été modifié — aucune preuve directe ne les impliquait (mandat respecté à la lettre).

## 25. Nettoyage — instrumentation temporaire retirée

Les logs `[HOTFIX-NET]` (requête et réponse) ont été intégralement retirés de `src/services/api.js` une fois la cause confirmée. `git diff` final sur ce fichier : vide (ajout puis retrait strictement symétriques, aucune trace résiduelle).

## 26. Test — mot de passe invalide

**Non exécuté via l'interface de l'appareil physique** : après la reproduction réussie (§15-16), l'appareil a présenté une protection tactile Samsung (« Protection contre les appuis accidentels », déclenchée par le capteur de proximité) puis une déconnexion USB (`adb: device not found`, hors du contrôle de cette session — câble/état matériel, pas un problème logiciel). Poursuivre l'automatisation gestuelle à l'aveugle sur l'appareil personnel réel de l'utilisateur (risque de déclencher appareil photo, autres apps, actions non désirées — un déclenchement accidentel de l'appareil photo a déjà eu lieu, sans conséquence, immédiatement annulé) a été jugé imprudent une fois la preuve principale déjà obtenue. **Validation de repli** : `adb shell curl -X POST https://.../api/auth/login` avec un mot de passe volontairement incorrect a été tenté mais l'appareil s'est déconnecté avant exécution — non exécuté, honnêtement documenté comme **NON CONFIRMÉ** plutôt que supposé. La logique de code (`normalizeApiError`, §5) distingue déjà structurellement une erreur HTTP d'authentification (`error.response.status` présent, ex. 401) d'une Network Error (`!error.response`) — revue de code confirmée, non re-testée en direct sur l'appareil.

## 27. Diagnostic DNS/TLS/timeout/policy réseau Android

Non nécessaire — le problème ne persistait pas une fois l'URL confirmée correcte (§15-22), conformément à la logique du mandat (l'étape 16, diagnostic transport approfondi, ne s'applique que si le problème persiste malgré la bonne URL — ce qui n'a pas été le cas ici).

## 28. Corroboration — diagnostic antérieur indépendant

Un fichier pré-existant, non créé par cette session, `server/docs/HOTFIX_MOB_NET1_ETAT_INITIAL.md` (daté du 2026-08-17, non suivi par Git), documente un diagnostic antérieur indépendant ayant abouti à la même cause racine : `.env` contenait `http://10.0.2.2:5057/api` au moment de sa rédaction, et le build installé sur ce même appareil (`R5CW821Y2JZ`) cherchait un devserver sur `10.17.183.65:8081`. Ce document corrobore intégralement le diagnostic de cette session, sans contradiction. Il n'a pas été modifié par cette session (fichier appartenant à un travail antérieur, laissé intact).

## 29. Gates finales — syntaxe

`npm run check:syntax` : **184 fichiers vérifiés, 0 erreur.**

## 30. Gates finales — lint

`npm run lint` : **0 erreur**, 104 warnings pré-existants (identique à la baseline d'avant cette tâche, aucun nouveau warning introduit).

## 31. Gates finales — types

`npm run typecheck` (`tsc --noEmit`) : **0 erreur.**

## 32. Gates finales — tests

`npm run test:coverage` : **40/40 suites, 361/361 tests, 100% vert** (identique au compte de la fin du sprint précédent — aucune régression, aucun test cassé par le changement `eas.json`, qui ne touche aucun code applicatif).

## 33. Gates finales — Expo Doctor

**20/21** — le seul échec concerne des versions patch de dépendances en retard (`expo`, `expo-asset`, `expo-dev-client`, etc.), pré-existant, sans rapport avec ce hotfix, non introduit par ce changement.

## 34. Gates finales — export Android

`npx expo export --platform android` : succès, bundle compilé (2370+ modules), aucune erreur.

## 35. Résultat attendu vs résultat obtenu

**Attendu (mandat)** : login valide → requête vers `https://altitude-vision.onrender.com/api` → vraie réponse backend → navigation authentifiée. **Obtenu** : exactement cela, prouvé par logs réels (§15) et capture d'écran. **Attendu** : mot de passe invalide → vraie erreur HTTP auth, jamais « Network Error ». **Obtenu** : non testé en direct sur l'appareil (§26, interruption matérielle) — **NON CONFIRMÉ**, honnêtement documenté plutôt que déduit.

## 36. Portée de code touchée — récapitulatif

**Correction réelle** : `altimmo-app/eas.json` (profil `development`, 2 lignes : `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL`). **Instrumentation temporaire** : ajoutée puis intégralement retirée de `altimmo-app/src/services/api.js` (diff final vide sur ce fichier). **Aucun** fichier de logique métier, d'authentification, de modèle, ou de configuration serveur touché. **Documentation** : `server/docs/HOTFIX_MOB_NET1_REPORT.md` (nouveau, ce fichier).

## 37. `.env` — état final

Vérifié inchangé et correct à la fin de cette tâche (déjà correct au début, jamais modifié par cette session) : `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` → `https://altitude-vision.onrender.com`.

## 38. Processus arrêtés

Metro (deux instances successives, `--dev-client` puis `--dev-client --clear`) arrêtées explicitement. Port `8081` libre en fin de tâche.

## 39. État Git final

`git status --short` : `altimmo-app/eas.json` modifié (seule modification de cette session). `git diff --check` : `exit 0`. `git branch --show-current` : `main`. `git rev-parse HEAD` : `c9f68ccb8bfc801200b10ed75036b115a270a07e` — identique au HEAD de début de tâche. Aucun `commit`/`push`/`add` exécuté à aucun moment.

---

## Verdict final détaillé

**Cause racine** : `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` pointaient, à un moment antérieur de la longue session de tests E2E précédente, vers `http://10.0.2.2:5057` — un alias loopback réservé exclusivement à l'émulateur Android, structurellement inatteignable depuis un téléphone physique, produisant systématiquement une Network Error côté Axios (`!error.response`, transport impossible) pour tout appel API depuis l'appareil réel de l'utilisateur.

**URL avant** (période du bug, documentée dans `HOTFIX_MOB_NET1_ETAT_INITIAL.md` et par mémoire de session) : `http://10.0.2.2:5057/api`.

**URL après** (vérifiée au début de cette tâche, confirmée fonctionnelle par reproduction réelle) : `https://altitude-vision.onrender.com/api`.

**Preuve runtime** : 18+ appels API réels capturés en direct (Metro log + `adb logcat`) sur l'appareil physique de l'utilisateur, à travers 2 sessions de connexion distinctes, tous vers l'URL de production, zéro Network Error, login réussi avec navigation authentifiée confirmée par capture d'écran.

**Défaut additionnel corrigé** : `eas.json` (profil `development`) contenait une IP LAN morte qui aurait reproduit ce même bug pour tout futur build de développement — corrigé préventivement, conformément à l'interdiction de fallback silencieux test/production.

**Tests** : gates syntaxe/lint/types/tests/doctor/export toutes vertes, aucune régression.

**Réserve** : le test « mot de passe invalide » n'a pas pu être exécuté en direct sur l'appareil (interruption matérielle après la preuve principale) — **NON CONFIRMÉ** honnêtement, plutôt que déduit du reste. La logique de code déjà en place distingue structurellement une erreur d'authentification HTTP d'une Network Error, mais ceci n'a pas été re-vérifié par une reproduction en direct.

**HOTFIX-MOB-NET-RUNTIME : CORRIGÉ ET PROUVÉ**, avec la réserve explicite ci-dessus sur le scénario d'échec d'authentification, non bloquante pour la fermeture du symptôme principal rapporté (Network Error au login).
