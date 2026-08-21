# MICRO-HOTFIX-MOB-GOOGLE-PROJECT-ALIGN-1 — Matrice avant correction

| Emplacement | Variable/config | Valeur/projet initial | Utilisée runtime ? | Action |
|---|---|---|---|---|
| `altimmo-app/.env` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `3869205293-…`, My First Project | Oui, Metro local | Remplacer par le client WEB Altitude Vision récupéré localement |
| `altimmo-app/eas.json` development | même variable | `3869205293-…` | Oui pour builds EAS development | Remplacer |
| `altimmo-app/eas.json` preview | même variable | `3869205293-…` | Oui pour preview | Remplacer |
| `altimmo-app/eas.json` staging | même variable | `3869205293-…` | Oui pour staging | Remplacer |
| `altimmo-app/eas.json` production | même variable | `3869205293-…` | Oui pour production | Remplacer |
| `environment.ts` | `googleWebClientId` | lit `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Oui | Conserver |
| `googleSignIn.js` | `GoogleSignin.configure({ webClientId })` | source centralisée, `offlineAccess: false` | Oui Login + Signup | Conserver, aucun ID en dur |
| `server/.env` | `GOOGLE_CLIENT_ID` | `3869205293-…`, identique à l'ancien WEB mobile | Oui pour `verifyIdToken` local | Remplacer par le WEB Altitude Vision |
| `server/.env` | `GOOGLE_CLIENT_ID_ANDROID` | `3869205293-…`, ancien projet | Accepté comme audience secondaire | Retirer localement tant que l'ID Android complet Altitude Vision n'est pas fourni ; le token mobile attendu a pour audience le client WEB |
| `authController.js` | audience `verifyIdToken` | tableau filtré WEB/Android/iOS | Oui pour `/api/auth/google` | Conserver la vérification et le multi-audience ; aucune faiblesse introduite |
| `client/.env.local` | `GOOGLE_CLIENT_ID` | `872164120879-…`, Altitude Vision | Oui, NextAuth Web | Source locale du client WEB correct ; ne pas modifier |
| `client` NextAuth | provider Google | lit `GOOGLE_CLIENT_ID` + secret local | Oui, Web | Ne pas modifier |
| artefacts `.expo`, bundle Android, logs | valeur embarquée/historique | `3869205293-…` | Pas source ; certains peuvent être exécutés s'ils ne sont pas régénérés | Régénérer export/bundle après correction |
| fichier local `client_secret_3869…json` | ancien client installé | `3869205293-…` | Non par le code | Ignoré par Git ; ne pas utiliser, ne pas publier |

## Invariants

- Client WEB correct : préfixe `872164120879-…`, longueur 72, suffixe `….googleusercontent.com`.
- La valeur complète vient d'une configuration locale existante ; aucune partie n'est devinée.
- Le secret NextAuth reste local, non affiché et non déplacé.
- Login et Signup mobiles utilisent déjà le même helper canonique.

## État après correction

| Emplacement | État final vérifié |
|---|---|
| `altimmo-app/.env` | Présent, longueur 72, préfixe `872164120879-`, empreinte courte `39a0dddc1323` |
| `eas.json` development/staging/preview/production | Les quatre profils ont la même valeur WEB Altitude Vision |
| `server/.env` `GOOGLE_CLIENT_ID` | Aligné sur le même client WEB ; ancienne audience Android locale retirée sans inventer d'ID |
| bundle Android exporté | 1 occurrence du préfixe `872164120879-`, 0 occurrence de `3869205293-` |
| sources actives | 0 ancien préfixe ; occurrences restantes limitées aux rapports historiques et au test d'interdiction |
