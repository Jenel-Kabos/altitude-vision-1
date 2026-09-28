# Google Maps API key — rotation & hardening runbook

Cible : `com.altitudevision.altimmo`. Ce document décrit les actions
**humaines** à réaliser dans Google Cloud Console. Aucune de ces actions
n'a été effectuée par Claude Code (interdiction explicite du sprint).

Ce runbook ne contient **aucun secret**. La valeur actuelle de la clé
est référencée dans les logs internes uniquement comme
`[REDACTED_GOOGLE_MAPS_KEY]`.

## Correction d'un constat précédent

L'audit `google-play-privacy-audit.md` initial affirmait à tort que la
clé était « suivie par Git ». Vérification faite :

```bash
git ls-files altimmo-app/android          # → 0 fichier tracké
git ls-files altimmo-app/build-*.apk      # → 0 fichier tracké
git ls-files altimmo-app/google-services.json  # → 0 fichier tracké
git grep -E "AIza[A-Za-z0-9_-]{35}"        # → aucun résultat
```

`altimmo-app/.gitignore` ligne `/android` exclut tout le dossier natif.
La clé n'est présente que sur le **filesystem local** dans le manifest
généré par `expo prebuild` (ou par le build EAS local) — jamais dans le
contenu suivi par Git.

**Conséquence** :
- pas de fuite d'historique Git à corriger (`filter-repo`/BFG interdits
  par le sprint, mais aussi inutiles ici) ;
- la rotation Google Cloud reste **fortement recommandée** car :
  - la clé est présente dans l'APK local `build-1787511872437.apk`
    (149 Mo, non tracké mais présent sur disque et distribuable) ;
  - si un ancien build a été partagé (test interne, EAS internal
    distribution, upload Play Console non signé), la clé est
    récupérable via `apktool`.

## Étapes humaines

1. **Console Google Cloud** → projet Altitude Vision → API et services
   → Identifiants.
2. Repérer la clé actuellement utilisée (nom probable : "Google Maps
   Android SDK — Altimmo").
3. Considérer cette clé comme compromise. **Ne pas la supprimer avant
   la mise en service de la nouvelle** pour éviter l'interruption du
   build actuel.
4. Créer une nouvelle clé API :
   - **Restriction d'application** : Android apps.
   - **Package name** : `com.altitudevision.altimmo`.
   - **SHA-1 fingerprint** : à récupérer localement via
     ```bash
     keytool -list -v -keystore <chemin/vers/keystore.jks> \
       -alias <alias> -storepass <...>
     ```
     ou côté EAS via `eas credentials --platform android`.
     `SHA_FINGERPRINT = HUMAN_ACTION_REQUIRED` — inconnu au niveau du
     dépôt.
   - **Restriction d'API** : uniquement `Maps SDK for Android`.
5. Injecter la nouvelle valeur dans l'environnement de build :
   - Local : `export GOOGLE_MAPS_ANDROID_API_KEY=…` avant
     `expo prebuild` / `expo run:android`.
   - EAS : `eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value …`.
6. Reconstruire l'AAB : `eas build --platform android --profile production`.
7. Tester la carte dans un build interne (les tuiles doivent se
   charger, les marqueurs doivent apparaître).
8. Déployer / uploader dans Play Console.
9. **Révoquer** définitivement l'ancienne clé dans Google Cloud
   Console, une fois la nouvelle validée en production.

## Vérifications à faire côté code (déjà faites)

- `altimmo-app/app.config.js` lit la clé via
  `process.env.GOOGLE_MAPS_ANDROID_API_KEY` (ligne 4).
- Un `throw new Error(...)` (ligne 9) empêche un build EAS Android sans
  la variable — garde-fou en place.
- Aucun fichier tracké par Git ne contient de valeur `AIza…` littérale
  (`git grep AIza` → 0 résultat).
- Le manifest Android natif (`altimmo-app/android/app/src/main/AndroidManifest.xml`)
  est ignoré par `.gitignore` — sa valeur locale ne quitte pas le poste
  et est régénérée à chaque prebuild.

## Interdiction

Claude Code (ce sprint et les suivants) **ne doit pas** :

- ouvrir Google Cloud Console,
- créer, révoquer ou modifier une clé,
- afficher la valeur littérale de la clé,
- copier la clé dans un autre fichier suivi par Git,
- déclencher un build EAS de production.

Toutes ces étapes sont humaines.
