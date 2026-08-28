# HOTFIX-MOB-GOOGLE-AUTH-3 — RAPPORT

**Verdict : AUDIT CERTIFIÉ** (sur le périmètre vérifiable depuis le code/dépôt), avec deux points explicitement `NON CONFIRMÉ` nécessitant un accès direct à Google Cloud Console et à la configuration Render de production.

## Réponse directe à l'objectif du mandat

**Le projet Google Cloud qui doit devenir la source canonique OAuth d'Altimmo est "Altitude Vision" (préfixe `872164120879-…`).** Ce n'est pas une nouvelle décision : c'est la trajectoire déjà engagée et déjà en grande partie réalisée par deux sprints antérieurs (`HOTFIX-MOB-GOOGLE-SIGNIN-2` puis `MICRO-HOTFIX-MOB-GOOGLE-PROJECT-ALIGN-1`), confirmée à nouveau par lecture directe du code dans ce tour : le Web (NextAuth), le backend local, et le mobile (`.env` + 4 profils `eas.json`) utilisent tous déjà exclusivement ce projet comme `webClientId`/`GOOGLE_CLIENT_ID`. La seule pièce non alignée est un client OAuth Android résolu par le build EAS, resté enregistré sous "My First Project" (`3869205293-…`) — un projet au nom par défaut, jamais destiné à la production.

## Réponses détaillées

**1-2. Inventaire / production par variable** — voir `HOTFIX_MOB_GOOGLE_AUTH3_CLIENT_MATRIX.md`, table complète, 9 emplacements de Client ID recensés (mobile `.env`/`eas.json`, backend `server/.env`, Web `client/.env.local`, plus un fichier local non suivi `client_secret_3869205293-….json`, jamais lu).

**3. Client ID passé à `GoogleSignin.configure()`** — uniquement `webClientId`, valeur `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...`. Confirmé par lecture du type exact `ConfigureParams` de la version installée (`16.1.4`) : il n'existe **aucun** paramètre `androidClientId` dans cette bibliothèque. `offlineAccess: false` (donc `serverAuthCode` jamais utilisé). `iosClientId` non renseigné (non concerné, Android uniquement pour ce hotfix).

**4. Package/applicationId** — `com.altitudevision.altimmo` confirmé identique dans `app.config.js`, `android/app/build.gradle` (`namespace` et `applicationId`), et le binaire APK EAS réel (`aapt2 dump badging`). Aucune divergence.

**5. Certificats comparés (lecture seule, aucune modification)** :
| Source | SHA-1 |
|---|---|
| Gradle debug local (`android/app/debug.keystore`) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| APK EAS (`build-1787511872437.apk`, `apksigner verify --print-certs`) | `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` |

**6. Mélange Android/Web confirmé** — Oui. Le `webClientId` (Altitude Vision) et le client Android résolu pour le build EAS (My First Project, selon le contexte utilisateur) appartiennent à deux projets différents.

**7. Backend Google Auth** — `verifyIdToken({ idToken, audience: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID_ANDROID, GOOGLE_CLIENT_ID_IOS] })`. Local : `GOOGLE_CLIENT_ID` = `872164120879-…`, cohérent. Un token du projet "My First Project" ne peut structurellement pas être émis dans la configuration actuelle (le mécanisme échoue avant l'émission du token si le projet Android ne correspond pas au `webClientId`) — voir nuance historique dans `AUTH_FLOW.md`. **Render (production) : `GOOGLE_CLIENT_ID` réel NON CONFIRMÉ**, question ouverte et distincte héritée de `HOTFIX-BACK-GOOGLE-AUTH-401-1`.

**8. Flux reconstitué avec Client ID à chaque étape** — voir `HOTFIX_MOB_GOOGLE_AUTH3_AUTH_FLOW.md`, diagramme complet.

**9. Pourquoi gradle local fonctionne et EAS échoue** — Les deux builds partagent le même `webClientId` (Altitude Vision) depuis `ALIGN-1`. Le build local est signé par un SHA-1 enregistré (selon le contexte utilisateur) comme client Android **dans ce même projet** → résolution réussie. Le build EAS est signé par un SHA-1 différent, enregistré (selon le contexte utilisateur) **dans un autre projet** ("My First Project") → `DEVELOPER_ERROR`, le SHA-1 existant quelque part ne suffit pas s'il n'est pas dans le bon projet.

**10. Configuration canonique cible** — Un seul projet Google Cloud, **Altitude Vision**, portant : le Web Client ID déjà partagé (Web + backend + mobile `webClientId`), et **tous** les clients OAuth Android nécessaires (un par certificat de signature distinct : debug local, EAS development, EAS preview/staging si distinctes, release/Play App Signing en production le moment venu). Aucune migration exécutée — proposition uniquement.

**11. Procédure de migration si nécessaire** — voir `HOTFIX_MOB_GOOGLE_AUTH3_MIGRATION_PLAN.md` : créer un nouveau client Android sous Altitude Vision avec le SHA-1 EAS, ne rien supprimer avant confirmation, aucune variable de code à modifier, aucun rebuild nécessaire, risque de coupure nul si l'ordre est respecté, rollback trivial (suppression du client nouvellement créé, aucun code à restaurer).

## Historique reconstitué (pertinent, pas halluciné — retrouvé dans `server/docs/` existant)

Cet audit a mis au jour trois documents antérieurs non présents dans le contexte de conversation de cette session mais bien réels et cohérents entre eux : `HOTFIX_MOB_GOOGLE_SIGNIN2_*` (découverte initiale du mélange de projets, avant `ALIGN-1`), `MICRO_HOTFIX_MOB_GOOGLE_PROJECT_ALIGN1_*` (migration du `webClientId` mobile/backend local vers Altitude Vision, test device non concluant), `HOTFIX_BACK_GOOGLE_AUTH4011_*` (question ouverte, non résolue, sur l'audience du backend Render de production). Ce mandat s'inscrit dans la continuité directe de ces trois travaux, sans les contredire, en complétant la pièce manquante (le client Android EAS) qu'aucun des trois n'avait encore isolée avec autant de précision.

## Ce qui reste `NON CONFIRMÉ`

1. L'enregistrement exact des deux clients OAuth Android (SHA-1 local sous Altitude Vision, SHA-1 EAS sous My First Project) — rapporté par l'utilisateur, non vérifiable depuis le code, nécessite un accès direct à Google Cloud Console.
2. La valeur runtime effective de `GOOGLE_CLIENT_ID` sur Render (production) — question distincte, déjà ouverte avant ce mandat, toujours non résolue.
3. Le succès complet (session + navigation) du build gradle local sur un test device formellement journalisé — le dernier rapport disponible (`ALIGN-1`, 2026-08-20) documentait un résultat non concluant, pas un succès net, bien que le contexte de ce mandat rapporte un succès plus récent non re-capturé par Logcat dans cette session.

## Gates

Aucune modification de code n'a été effectuée — gates de non-régression rejouées par prudence uniquement :
- `googleSignIn.test.js` : 17/17 verts.
- `googleProjectAlignment.test.js` : 3/3 verts (confirme les 4 profils EAS alignés sur Altitude Vision, absence d'ID codé en dur, helper partagé Login/Signup).
- `git diff --check` : exit 0.
- Aucun fichier de production modifié — aucun autre gate (lint/typecheck/build/export) n'était nécessaire pour un audit pur.

## STOP

Conformément au mandat : aucun fichier modifié, aucun client OAuth supprimé, aucune variable d'environnement modifiée, aucun changement Google Cloud ou EAS, aucun commit/push/déploiement. Aucune migration exécutée — proposée uniquement. En attente de validation utilisateur avant toute action sur Google Cloud Console.
