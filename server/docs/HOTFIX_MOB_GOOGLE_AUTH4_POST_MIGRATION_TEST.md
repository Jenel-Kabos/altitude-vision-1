# HOTFIX-MOB-GOOGLE-AUTH-4 — TEST POST-MIGRATION (SANS REBUILD)

**Ne pas exécuter ce test avant confirmation explicite de l'utilisateur que `HOTFIX_MOB_GOOGLE_AUTH4_MIGRATION_PROCEDURE.md` (étapes 1-16) a été réalisée dans Google Cloud Console.**

## Pourquoi aucun rebuild n'est nécessaire

Le package (`com.altitudevision.altimmo`) et le certificat de signature (SHA-1 `62:49:CC:78:…`) du build EAS déjà installé sur le device ne changent pas — seule la table de correspondance côté Google Cloud est modifiée. L'APK déjà présent sur le Samsung SM-S918B (ou tout appareil de test équivalent) peut être retesté directement.

## Séquence de test exacte (device réel, sans reconstruction)

| # | Étape | Résultat attendu | Ce qui prouve un succès à cette étape précisément |
|---|---|---|---|
| 1 | Ouvrir l'app Altimmo (build EAS déjà installé) | L'app démarre normalement | — |
| 2 | Aller sur l'écran de connexion | Écran Login affiché | — |
| 3 | Appuyer sur "Continuer avec Google" | Le flux natif démarre | `[Google Sign-In] STEP 1 Login button pressed` (log DEV existant) |
| 4 | Vérifier l'ouverture du sélecteur Google | Activité native Google affichée (`SignInHubActivity`/chooser de compte) | Visible à l'écran |
| 5 | Sélectionner un compte Google | Retour dans l'app, pas de fermeture prématurée | — |
| 6 | Vérifier l'absence de `DEVELOPER_ERROR` | Aucune alerte "Connexion Google indisponible" | Log DEV : pas de `getGoogleSignInDiagnostic` avec `code: '10'`/`'DEVELOPER_ERROR'` |
| 7 | Vérifier la réception du token Google | Le flux continue au-delà de `getGoogleIdToken()` | `[Google Sign-In] STEP 6 idToken extracted` (log DEV existant, longueur seulement, jamais la valeur) |
| 8 | Vérifier l'appel backend | `POST /auth/google` déclenché | `[Google Sign-In] STEP 7 backend auth call attempted` (log DEV existant) |
| 9 | Vérifier la création/récupération du compte | Réponse backend reçue sans erreur | `[Google Sign-In] STEP 9 ... session result` avec `hasSessionUser: true` |
| 10 | Vérifier la création de session Altimmo | `AuthContext` reçoit un utilisateur | Écran change (plus sur Login) |
| 11 | Vérifier la navigation post-auth | Destination cohérente avec le rôle (`Client` par défaut à l'inscription Google — RBAC-4/mobile, non modifié) | Écran d'accueil ou de complétion de profil affiché selon `isNewUser` |
| 12 | Vérifier `/me` | Un appel réussi à `/users/me` (ou équivalent mobile) recharge le profil sans erreur | Pas d'écran d'erreur, données utilisateur affichées (nom/photo si applicable) |
| 13 | Vérifier les capacités éventuelles | Si l'utilisateur est un rôle staff avec `capabilities`, elles sont présentes (RBAC-3/RBAC-4, non concerné par ce hotfix mais à ne pas casser) | Non bloquant pour un compte `Client` standard — à vérifier seulement si un compte staff est testé |
| 14 | Fermer et rouvrir l'application | Session restaurée sans redemander la connexion | Écran d'accueil directement, pas de retour à Login |

## Capture Logcat en cas d'échec persistant

Si `DEVELOPER_ERROR` persiste malgré la migration, ou si une **nouvelle** erreur apparaît, capturer Logcat filtré sur `[Google Sign-In]` (voir méthode déjà utilisée dans `HOTFIX-MOB-GOOGLE-AUTH-2`) :

```
adb -s <serial> logcat -c
adb -s <serial> logcat *:S ReactNativeJS:V | grep -E "Google Sign-In"
```

Puis identifier précisément, sans jamais logguer de token :
- Code Google Sign-In natif (`error.code`) et exception native (`error.name`).
- `statusCode` si présent.
- HTTP status de la réponse backend si l'étape 8 a été atteinte.
- Message d'erreur backend (safe, déjà filtré par `getGoogleSignInDiagnostic`).

## Grille de verdict selon le résultat observé

| Résultat observé | Verdict | Action suivante |
|---|---|---|
| Toutes les étapes 1-14 réussissent | **CERTIFIÉ VERT** | Documenter dans le rapport final, aucune action supplémentaire |
| `DEVELOPER_ERROR` toujours présent après migration confirmée | **NON RÉSOLU** | Revenir aux vérifications de la section "Si Google refuse encore..." de `MIGRATION_PROCEDURE.md` ; ne pas modifier le code |
| `DEVELOPER_ERROR` disparaît mais une nouvelle erreur apparaît (ex. 401 backend, pas de session, mauvaise page post-login) | **PROGRESSION CONFIRMÉE — NOUVELLE CAUSE À AUDITER** | Ouvrir un hotfix distinct ciblant précisément la nouvelle couche fautive (ex. `HOTFIX-BACK-GOOGLE-AUTH-401-1` si un 401 apparaît — déjà existant et non résolu, potentiellement la même cause) ; ne pas mélanger avec ce hotfix |
| Migration effectuée mais device non testable | **GO SOUS RÉSERVES — DEVICE TEST REQUIRED** | En attente d'un accès device |

**Rappel** : ne déclarer `CERTIFIÉ VERT` que si le parcours complet (étapes 1 à 14) est confirmé réussi sur un device réel — pas seulement l'absence de `DEVELOPER_ERROR`.
