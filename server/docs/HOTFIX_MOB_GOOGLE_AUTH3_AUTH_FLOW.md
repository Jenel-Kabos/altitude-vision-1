# HOTFIX-MOB-GOOGLE-AUTH-3 — FLUX RÉEL AVEC CLIENT ID À CHAQUE ÉTAPE

```
Bouton "Continuer avec Google" (LoginScreen.jsx / RegisterScreen.jsx)
  → configureGoogleSignIn()
      GoogleSignin.configure({ webClientId: "872164120879-…" (Altitude Vision), offlineAccess: false })
  → GoogleSignin.hasPlayServices()
  → GoogleSignin.signIn()
      ┌─────────────────────────────────────────────────────────────┐
      │ VÉRIFICATION NATIVE (Google Play Services, avant tout token) │
      │  Entrées utilisées par Google, JAMAIS transmises par le JS : │
      │   - package de l'app installée : com.altitudevision.altimmo │
      │   - SHA-1 du certificat qui a signé l'APK réellement lancé  │
      │  Google cherche un client OAuth ANDROID, dans le MÊME PROJET│
      │  que le webClientId fourni (872164120879-, Altitude Vision),│
      │  dont le couple (package, SHA-1) correspond exactement.     │
      │  → Trouvé dans le bon projet  → passe à l'étape suivante.   │
      │  → Absent de CE projet précis → DEVELOPER_ERROR (code 10),  │
      │    MÊME SI le couple (package, SHA-1) existe ailleurs, dans │
      │    un AUTRE projet Google Cloud (ex. "My First Project").   │
      └─────────────────────────────────────────────────────────────┘
  → idToken extrait (audience = webClientId = 872164120879-…)
  → authenticate({ idToken, intent, role: 'Client' })
  → POST /auth/google (backend)
      → OAuth2Client(GOOGLE_CLIENT_ID).verifyIdToken({ idToken, audience: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID_ANDROID, GOOGLE_CLIENT_ID_IOS] })
          Local : GOOGLE_CLIENT_ID = 872164120879-… → cohérent avec l'idToken émis.
          Render (production) : valeur NON CONFIRMÉE — voir section dédiée.
  → JWT Altitude Vision retourné, session stockée, navigation post-login (RBAC-4, inchangé)
```

## Étape par étape — Client ID effectivement utilisé

| Étape | Client ID utilisé | Projet | Statut |
|---|---|---|---|
| `GoogleSignin.configure({ webClientId })` | `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...` | Altitude Vision | Confirmé par lecture directe (`.env`, `eas.json`, 4 profils) |
| Résolution native package+SHA-1 (implicite, jamais dans le JS) | *(pas un identifiant transmis — une recherche par couple package+certificat)* | Doit être **Altitude Vision** pour réussir (même projet que le `webClientId` ci-dessus) | Dépend du build : local (`5E:8F:16:06…`) vs EAS (`62:49:CC:78…`) — voir `PROJECT_OWNERSHIP.md` |
| `idToken` émis (si l'étape précédente réussit) | Audience = `872164120879-…` | Altitude Vision | Cohérent avec la config actuelle |
| Backend local `verifyIdToken` | `GOOGLE_CLIENT_ID` = `872164120879-…` | Altitude Vision | Confirmé, cohérent |
| Backend Render (production) | **NON CONFIRMÉ** | **NON CONFIRMÉ** | Risque documenté séparément par `HOTFIX-BACK-GOOGLE-AUTH-401-1`, non résolu à ce jour |

## Pourquoi le build gradle local et le build EAS se comportent différemment

Les deux builds partagent aujourd'hui le **même** `webClientId` (`872164120879-…`, Altitude Vision — la migration `MICRO-HOTFIX-MOB-GOOGLE-PROJECT-ALIGN-1` a déjà aligné `.env`/`eas.json` sur ce projet pour les deux). La différence se joue entièrement à l'étape de résolution native package+SHA-1 :

- **Build gradle local** : signé par `android/app/debug.keystore`, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Selon le contexte fourni par l'utilisateur pour ce mandat, ce couple (package, SHA-1) est enregistré comme client OAuth Android **dans le projet Altitude Vision** — le même projet que le `webClientId` → résolution réussie.
- **Build EAS** (`build-1787511872437.apk`, profil `development`, credentials gérées à distance par EAS) : signé par un certificat SHA-1 `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` distinct. Selon le contexte fourni, ce couple (package, SHA-1) est enregistré comme client OAuth Android **dans "My First Project"**, un projet **différent** de celui du `webClientId` actuel → Google Play Services ne trouve aucun client Android correspondant dans le bon projet → `DEVELOPER_ERROR` (code 10), **même si le SHA-1 est bel et bien enregistré quelque part**.

C'est la confirmation exacte du mécanisme déjà pointé par `HOTFIX-MOB-GOOGLE-SIGNIN-2` (réponse 12 : "cause finale : client Android package/SHA-1 absent ou non résolu **dans le projet du Client ID WEB runtime**") — un principe qui n'a pas changé depuis, seul le projet cible du `webClientId` a changé entre-temps (migré de "My First Project" vers "Altitude Vision" par `ALIGN-1`), déplaçant le problème du même mécanisme vers le SHA-1 EAS au lieu du SHA-1 local.

## Historique reconstitué (pour comprendre l'origine du problème)

1. **Avant `ALIGN-1`** : `webClientId` pointait vers "My First Project" (`3869205293-…`). Le SHA-1 local (`5E:8F:16:06…`) n'y était probablement pas enregistré non plus → `DEVELOPER_ERROR` déjà observé à ce moment (`HOTFIX-MOB-GOOGLE-SIGNIN-2`, réponses 1-2, 16-17).
2. **`ALIGN-1`** a migré `webClientId` (mobile + backend local) vers "Altitude Vision" (`872164120879-…`), en confirmant par export Android que plus aucune référence à `3869205293-` ne subsistait dans le bundle. Un client OAuth Android avec le SHA-1 local a alors été (implicitement, contexte utilisateur) enregistré côté "Altitude Vision".
3. **Test device post-`ALIGN-1`** (2026-08-20) : plus de `DEVELOPER_ERROR`/code 10 observé pour le build local, mais session non confirmée non plus (activités Google ouvertes puis fermées, aucun appel backend observé) — résultat **non concluant**, ni succès net ni échec net, documenté "GO SOUS RÉSERVES — NON CERTIFIÉ VERT".
4. **Contexte de ce mandat (HOTFIX-MOB-GOOGLE-AUTH-3)** : l'utilisateur rapporte que le build gradle local fonctionne désormais et que le build EAS échoue avec `DEVELOPER_ERROR` — cohérent avec un SHA-1 EAS resté enregistré sous "My First Project" pendant que "Altitude Vision" est devenu le projet cible de tout le reste de la configuration.

**Nuance à documenter honnêtement** : le dernier test device formellement journalisé (`ALIGN-1`, point 3 ci-dessus) n'avait pas certifié un succès complet (session/navigation) pour le build local, seulement l'absence de `DEVELOPER_ERROR` explicite. Le succès rapporté par l'utilisateur dans ce mandat est plus récent et plus positif, mais **n'a pas été re-capturé par un nouveau test Logcat dans cette session** (aucune reproduction Logcat n'a abouti pendant les tentatives de `HOTFIX-MOB-GOOGLE-AUTH-2`). Ce point est marqué `NON CONFIRMÉ` par capture directe dans ce tour, bien que retenu comme vraisemblable au vu de la cohérence de la chaîne de preuves.
