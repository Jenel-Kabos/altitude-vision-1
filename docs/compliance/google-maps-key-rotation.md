# Google Maps API key — rotation & hardening runbook

Cible : `com.altitudevision.altimmo`. Ce document consigne les actions
**humaines** dans Google Cloud Console. Aucune action Google Cloud n'a été
effectuée par l'agent pendant le sprint de clôture.

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
Une clé n'est injectée dans un manifest généré que lorsqu'une variable
d'environnement de build est fournie. Aucune clé Google API n'est présente
dans le contenu suivi par Git. Le contrôle de clôture a utilisé exclusivement
une valeur factice dans une copie temporaire.

**Conséquence** :
- pas de fuite d'historique Git à corriger (`filter-repo`/BFG interdits
  par le sprint, mais aussi inutiles ici) ;
- la rotation Google Cloud reste **fortement recommandée** car :
  - la clé est présente dans l'APK local `build-1787511872437.apk`
    (149 Mo, non tracké mais présent sur disque et distribuable) ;
  - si un ancien build a été partagé (test interne, EAS internal
    distribution, upload Play Console non signé), la clé est
    récupérable via `apktool`.

## État de rotation confirmé humainement (2026-09-29)

- nouvelle clé créée : `HUMAN_CONFIRMED` ;
- restriction d'application Android : `HUMAN_CONFIRMED` ;
- package `com.altitudevision.altimmo` : `HUMAN_CONFIRMED` ;
- empreinte SHA-1 de production configurée : `HUMAN_CONFIRMED` ;
- restriction à Maps SDK for Android : `HUMAN_CONFIRMED` ;
- secret EAS `production / GOOGLE_MAPS_ANDROID_API_KEY` : `HUMAN_CONFIRMED` ;
- ancienne clé supprimée : `NO` — suppression volontairement différée.

## Étapes humaines restantes

1. Après validation humaine du rapport de clôture, reconstruire l'AAB.
2. Tester la carte dans un build interne signé (les tuiles doivent se
   charger, les marqueurs doivent apparaître).
3. Seulement après cette validation, **révoquer** l'ancienne clé dans
   Google Cloud Console.

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
