# HOTFIX-MOB-NET-1 — État initial

Date : 2026-08-17

Résumé rapide
- Symptom: écran Login sur appareil Android physique affiche « Network Error » lors d'une tentative de connexion (pas d'erreur 401/403).
- Action prise : diagnostic non intrusif, collecte de preuves runtime et fichiers de configuration.

Preuves relevées

- Fichier `altimmo-app/.env` (workspace) contient des valeurs de développement pointant vers l'émulateur :
  - EXPO_PUBLIC_API_URL=http://10.0.2.2:5057/api
  - EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5057

- Fichiers de logs Metro/devserver (dev) montrent que le serveur de développement chargeait cet `.env` :
  - [altimmo-app/.expo/dev/logs/start.log](altimmo-app/.expo/dev/logs/start.log#L311) → `EXPO_PUBLIC_API_URL":"http://10.0.2.2:5057/api"` (mode development)

- `altimmo-app/src/config/environment.ts` : l'app utilise `process.env.EXPO_PUBLIC_API_URL` avec un fallback `https://altitude-vision.onrender.com/api` et rejette les URL non-https hors `__DEV__`. Voir : [altimmo-app/src/config/environment.ts](altimmo-app/src/config/environment.ts#L1)

- Log runtime capturé via `adb logcat` sur le téléphone physique (serial R5CW821Y2JZ) :
  - Entrée : `Cannot connect to Expo CLI.` et `URL: 10.17.183.65:8081` indiquant que l'APK installé est un build dev / dev-client cherchant le packager Metro sur `10.17.183.65:8081`.
  - Extrait du logcat : voir dump des logs (local) — recherche faite pour `EXPO_PUBLIC_API_URL`, `10.17.183.65`, `Network Error`.

- L'APK installé a été extrait et contient la référence à l'hôte du devserver `10.17.183.65` (présence vérifiée via `strings /tmp/altimmo_base.apk`).

Interprétation provisoire (diagnostic)

- Pendant les sprints E2E, une configuration de développement locale a été utilisée (backend local servi via `10.0.2.2:5057`) et cette valeur a été exposée à Metro/DevClient.
- Le téléphone physique exécute un build débogable / dev-client qui essaie de charger le bundle et les assets depuis le devserver (`10.17.183.65:8081`). Lorsque le devserver/injection d'env n'est pas accessible ou que le backend local (`10.0.2.2:5057`) n'est pas joignable depuis le device, les requêtes réseau de l'app échouent → `Network Error` côté Axios (transport impossible).
- Cause la plus probable : l'URL API réellement utilisée par le build installé est une URL de test locale (`10.0.2.2:5057`) injectée par le devserver/`.env` au moment du build/lancement dev-client, et qui est invalide depuis un téléphone physique (10.0.2.2 est l'alias loopback hôte pour l'émulateur Android, pas pour un appareil réel).

Preuves principales listées
- [altimmo-app/.env](altimmo-app/.env#L1-L3) — contient `http://10.0.2.2:5057/api`
- [altimmo-app/.expo/dev/logs/start.log](altimmo-app/.expo/dev/logs/start.log#L311) — Metro a chargé l'.env dev contenant `10.0.2.2`
- `adb logcat` extrait (device R5CW821Y2JZ) — ligne : `Cannot connect to Expo CLI.` + `URL: 10.17.183.65:8081` (devclient runtime)
- APK strings (`/tmp/altimmo_base.apk`) — contient `10.17.183.65` (preuve que le build est lié au devserver)

Prochaine(s) étape(s) recommandée(s) (diagnostic -> correction minimale)

1. Confirmer runtime URL exacte appelée par Axios sur l'app installée :
   - Option A (recommandée, non intrusive) : reproduire la connexion pendant `adb logcat` en filtrant `ReactNativeJS` et `OkHttp/OkHttpClient` pour capturer l'URL cible exacte et l'erreur Axios renvoyée (je peux capturer ça si tu reproduis maintenant).
   - Option B : activer `Debug JS Remotely` sur l'app et exécuter `console.log(environment.apiUrl)` puis reproduire le login (affichera la valeur runtime injectée).

2. Une fois prouvé que l'URL est bien `http://10.0.2.2:5057/api` ou autre URL non-routable depuis l'appareil réel, corriger la source canonique :
   - Ajuster la configuration de build/exposition d'env (EAS/app.config/eas.json ou flux dev) pour que les builds destinés aux appareils physiques pointent explicitement vers la production ou vers une URL de test joignable depuis l'appareil.
   - Ne pas ajouter de fallback silencieux entre test/prod.

3. Rebuild / réinstaller la version corrigeant l'URL (ou fournir un build de test) puis vérifier : login sur appareil physique, tracer `POST /api/login`, backend doit recevoir la requête.

Notes importantes
- Aucune modification de code n'a été effectuée pour produire ce rapport. Aucune action destructive Git n'a été exécutée.
- Je peux poursuivre la capture runtime (Option A ci-dessus) immédiatement si tu confirmes que je dois extraire maintenant les lignes exactes d'Axios/OkHttp pendant que tu reproduis la tentative de login sur l'app.

Fichiers/commandes utiles déjà lancés
- `adb -s R5CW821Y2JZ logcat` (filtré ReactNative/ReactNativeJS) — log actuellement collecté localement.
- Extraction APK : `/tmp/altimmo_base.apk` (pull depuis device) — `strings` a révélé `10.17.183.65`.

-- Fin état initial
