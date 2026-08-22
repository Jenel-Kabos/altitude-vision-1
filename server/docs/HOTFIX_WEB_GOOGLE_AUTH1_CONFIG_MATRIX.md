# HOTFIX-WEB-GOOGLE-AUTH-1 — Matrice de configuration

Toutes les valeurs ci-dessous proviennent de `client/.env.local` (environnement local) et `server/.env` (backend local) — **jamais imprimées en clair pour les secrets**, uniquement présence/longueur/préfixe. Ces fichiers sont locaux et gitignorés ; **ils ne prouvent rien sur la configuration réellement déployée sur Netlify**, qui n'a pas pu être inspectée depuis cet environnement (voir `REPORT.md` §10).

| Variable | Présente (local, frontend) | Présente (local, backend) | Longueur / préfixe sûr | Cohérence frontend ↔ backend | Verdict |
|---|---:|---:|---|---:|---|
| `GOOGLE_CLIENT_ID` | OUI | OUI | préfixe `872164120879-` (projet Google Cloud attendu) | **Identique caractère pour caractère entre `client/.env.local` et `server/.env`** | OK — c'est bien le client Web, pas Android (confirmé par comparaison directe des deux valeurs) |
| `GOOGLE_CLIENT_SECRET` | OUI | N/A (le backend ne fait pas d'OAuth code-exchange, seulement la vérification d'idToken côté `googleToken`) | longueur 35, préfixe `GOCSPX-` (format standard Google) | N/A | OK |
| `GOOGLE_CLIENT_ID_ANDROID` | N/A (jamais utilisé côté Web) | OUI (utilisé uniquement comme `audience` alternative pour le mobile) | — | Distinct de `GOOGLE_CLIENT_ID` (confirmé, valeurs différentes) | OK — le client Android n'est jamais utilisé comme client Web |
| `NEXTAUTH_URL` | OUI | N/A (backend n'utilise pas cette variable) | `https://altitudevision.agency` (exact, sans slash final) | — | OK — correspond exactement à l'origine autorisée dans Google Cloud |
| `NEXTAUTH_SECRET` | OUI | N/A | longueur 36 | — | OK — jamais exposé côté client (utilisé uniquement dans `route.js`, code serveur Next.js) |
| `NEXTAUTH_API_SECRET` | OUI | OUI | longueur 64 (hex) | **Identique entre frontend et backend** | OK |
| `AUTH_URL` | ABSENT | N/A | — | — | **Absent — voir cause racine** |
| `AUTH_TRUST_HOST` | ABSENT | N/A | — | — | **Absent — voir cause racine** |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` (dev local) | N/A | — | — | Attendu en local ; la valeur Netlify réelle n'a pas pu être vérifiée (NON CONFIRMÉ) |

## Point critique du mandat — client ID Web vs Android

Vérifié par comparaison directe des deux valeurs locales : `GOOGLE_CLIENT_ID` (préfixe `872164120879-`) est **strictement identique** entre `client/.env.local` et `server/.env`, et **différent** de `GOOGLE_CLIENT_ID_ANDROID`. Aucune confusion Web/Android trouvée dans la configuration locale.

## Cause racine — absence de `trustHost`

Ni `AUTH_URL` ni `AUTH_TRUST_HOST` ne sont définis (confirmé : absents de tous les fichiers `.env*` du dépôt). Le fichier `route.js` n'appelait pas non plus `trustHost: true` explicitement dans l'objet de configuration `NextAuth({...})`. Voir `FLOW_MATRIX.md` pour l'explication complète du mécanisme et la preuve par lecture du code source de `@auth/core`.
