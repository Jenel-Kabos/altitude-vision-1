# HOTFIX-MOB-GOOGLE-AUTH-4 — ÉTAT INITIAL / PHASE A (REVALIDATION)

Branche : `main`. HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` — **inchangé depuis `HOTFIX-MOB-GOOGLE-AUTH-3`**. `git status --short` : 58 lignes, même travail externe non lié à cette session déjà documenté (`ARCH2A`/`ARCH2B`, APK de test) + les documents `HOTFIX_MOB_GOOGLE_AUTH2_*`/`HOTFIX_MOB_GOOGLE_AUTH3_*` déjà produits. `git diff --check` : exit 0.

## Phase A — revalidation rapide (avant toute proposition Google Cloud)

| Vérification | Résultat | Preuve |
|---|---|---|
| Le dépôt a-t-il changé depuis l'audit AUTH-3 ? | **Non** | HEAD identique (`a04055f`), aucun fichier Google Auth modifié dans `git status` |
| `package`/`applicationId` | `com.altitudevision.altimmo` | `app.config.js:48`, inchangé |
| `webClientId` réellement consommé par `GoogleSignin.configure()` | `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k.apps.googleusercontent.com` | `altimmo-app/.env`, inchangé, relu directement |
| Ce `webClientId` appartient-il toujours à Altitude Vision ? | Oui (même préfixe `872164120879-` que documenté par AUTH-3) | Relecture directe |
| `eas.json` — 4 profils toujours alignés | Oui, 4 occurrences du préfixe `872164120879-` | `grep -c` |
| Backend local — audience attendue | `GOOGLE_CLIENT_ID` préfixe `872` inchangé | `server/.env`, relu directement |
| Un deuxième projet OAuth a-t-il été introduit dans le code depuis AUTH-3 ? | **Non** | Seule occurrence de `3869205293` dans tout `altimmo-app/src` et `server/` : le test de régression `googleProjectAlignment.test.js` qui **interdit** cette valeur, pas une nouvelle introduction |
| Tests de régression Google (`googleSignIn.test.js`, `googleProjectAlignment.test.js`) | 21/21 verts | Rejoués dans ce tour |

**Conclusion Phase A : aucun changement depuis `HOTFIX-MOB-GOOGLE-AUTH-3`. Les conclusions de cet audit restent valides sans réserve. Poursuite autorisée vers la Phase B (détermination de l'opération Google Cloud) sans avoir à répéter l'audit complet.**

## Rappel de l'état prouvé (hérité, non remis en cause)

- Projet Google Cloud canonique : **Altitude Vision** (`872164120879-…`).
- Package Android canonique : `com.altitudevision.altimmo`.
- SHA-1 EAS observé : `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6`, actuellement associé (selon le contexte utilisateur, confirmé cohérent avec toutes les preuves de code disponibles) à un client OAuth Android du projet **My First Project** (`3869205293-…`, nommé "altitudevision altimmo" côté Google Cloud).
- `@react-native-google-signin/google-signin@16.1.4` : `ConfigureParams` ne possède aucun champ `androidClientId` — confirmé par lecture directe des types dans `HOTFIX-MOB-GOOGLE-AUTH-3` (`node_modules/.../types.d.ts`), non re-vérifié ce tour car le fichier `node_modules` n'a pas de raison d'avoir changé (`package.json`/`package-lock.json` non modifiés depuis).

Ce document ne modifie aucun fichier de code, aucune configuration, aucun projet Google Cloud.
