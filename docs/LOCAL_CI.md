# CI locale — Altitude Vision

Les GitHub Actions distantes sont indisponibles (problème de facturation). En
attendant, ces commandes exécutent **exactement les mêmes validations en
local**, sur les trois workspaces (`server`, `client`, `altimmo-app`), dans
cet ordre : **server → client → mobile**.

## Commandes

### `npm run ci`
La validation complète, équivalente à la CI distante. À lancer avant toute
Pull Request ou merge.

- **server** : lint (ESLint) + tests (Jest)
- **client** : lint (ESLint) + tests (Vitest) + build (`next build`)
- **mobile** : syntaxe + lint + types (`tsc`) + tests (coverage) + doctor
  (`expo-doctor`) + export (`expo export --platform android`)

```bash
npm run ci             # les trois workspaces
npm run ci:server       # server seul
npm run ci:client       # client seul
npm run ci:mobile       # mobile seul
```

Durée : quelques minutes (le build client et l'export mobile sont les étapes
les plus longues).

### `npm run verify`
Mode rapide — **lint et types uniquement, aucun test, aucun build**. À
utiliser pendant le développement pour un retour immédiat (quelques
secondes), avant de lancer `npm run ci` en validation finale.

```bash
npm run verify
npm run verify:server
npm run verify:client
npm run verify:mobile
```

### `npm run release-check`
Mêmes validations que `npm run ci`, avec un résumé final explicite
("prêt pour une release" / "ne pas déployer"). À lancer juste avant un
déploiement ou un tag de version.

```bash
npm run release-check
```

### `npm run health`
Diagnostic rapide de l'environnement (Node.js, npm, compatibilité de
versions, `package-lock.json`, fichiers critiques, variables d'environnement,
`node_modules` installés). Ne lance aucun test, ne modifie rien.

```bash
npm run health
```

⚠️ Le check MongoDB vérifie uniquement que `MONGO_URI` est défini et que le
driver `mongoose` est installé — il **ne se connecte jamais** à la base (le
`MONGO_URI` de ce projet pointe vers un cluster partagé/production).

## Quand utiliser quoi

| Situation | Commande |
|---|---|
| Je code et je veux un retour rapide | `npm run verify` |
| Je viens de configurer la machine | `npm run health` |
| Je m'apprête à ouvrir/mettre à jour une PR | `npm run ci` |
| Je m'apprête à déployer | `npm run release-check` |

## Rapport

Chaque commande (`ci`, `verify`, `release-check`) affiche un rapport groupé
par workspace, avec un total de validations réussies/échouées, et se termine
avec un code de sortie non nul si au moins une validation a échoué — ces
commandes peuvent donc être utilisées telles quelles comme gate (hook Git,
etc.).

## Fichiers

- `scripts/local-ci.js` — orchestrateur (`ci` / `verify` / `release`)
- `scripts/health.js` — diagnostic d'environnement
- Scripts `ci` / `verify` propres à chaque workspace : `server/package.json`,
  `client/package.json`, `altimmo-app/package.json`

## CI locale vs GitHub Actions — ce que ça approxime, pas ce que ça remplace

Cette CI locale exécute les mêmes commandes que les workflows
`.github/workflows/*.yml`, mais **n'est pas un clone exact** de l'environnement
distant :

- elle tourne sur votre machine (macOS/Linux), pas dans un conteneur Ubuntu
  jetable — pas de `npm ci` sur un clone propre, elle réutilise vos
  `node_modules` locaux tels quels ;
- elle ne teste qu'une seule combinaison OS/Node à la fois (celle de votre
  poste), alors que la matrice CI distante peut en tester plusieurs ;
- elle n'a pas les secrets/variables d'environnement du repo GitHub (Actions
  Secrets) — seulement ce qui est dans vos `.env` locaux.

Un `npm run ci` vert en local est un **très bon signal** avant d'ouvrir une
PR, mais le run GitHub Actions distant (une fois rétabli) reste la référence
finale avant un merge.

## La CI locale ne remplace pas les tests manuels

`npm run ci` valide le code (lint, types, tests automatisés, build/export) —
elle ne vérifie **jamais** le rendu visuel réel, un parcours utilisateur
complet, ni le comportement contre une vraie base de données ou un vrai
device/émulateur. Après un `npm run ci` vert, un test manuel (navigateur,
appareil/émulateur mobile) reste nécessaire avant tout déploiement, en
particulier pour les changements d'UI ou de flux utilisateur.

## Limites connues

- Le format Prettier n'est pas inclus (aucun style n'a jamais été appliqué
  au codebase existant — voir la note dans `.github/workflows/lint.yml`).
- `npm run ci`/`release-check` n'exécutent pas de vrai déploiement ni de
  build natif Android/iOS — l'export Expo est un export JS statique, pas un
  build APK/IPA.
