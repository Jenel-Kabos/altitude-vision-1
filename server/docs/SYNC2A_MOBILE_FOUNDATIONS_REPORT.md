# SYNC-2A — Rapport final : fondations Mobile (Auth, Session, Tenant, IAM)

Date : 2026-08-15. Branche `main`, HEAD au démarrage `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (`git status --short` vide, confirmé avant toute action). Fait suite à `SYNC2A_MOBILE_FOUNDATIONS_ETAT_INITIAL.md`.

## 1. Résumé exécutif

Le mobile sait désormais **qui est connecté**, **si sa session est encore valide** (y compris un compte suspendu/banni/inactif détecté en cours de session, pas seulement au login), et dispose d'un runtime tenant/IAM prêt pour SYNC-2B/2C sans avoir créé le moindre écran staff. Un bug applicatif réel a été trouvé et corrigé (compte désactivé mid-session ne déconnectait jamais le mobile) et un bug d'infrastructure de test a été trouvé et corrigé (un mock masquait silencieusement le chemin de succès de la restauration de session). **Verdict : SYNC-2A CERTIFIÉ VERT.**

## 2. Architecture avant

Auth mobile fonctionnelle mais incomplète : SecureStore correct, 401 centralisé correct, mais 403 « compte désactivé » invisible ; aucun concept de tenant ; IAM-3 non consommé ; socket sans room hôtel ni tenant.

## 3. Architecture après

```
App Start → SecureStore.getToken() → GET /users/me (revalidation réelle)
  ├─ 200 → user restauré
  └─ 401/403 structuré → token supprimé, message serveur affiché, jamais authentifié
        ↓
AuthContext (user, accountStatusMessage)
        ↓
PlatformTenantRuntimeProvider (Admin uniquement)
  → getMyOperatorStatus() → si opérateur actif → listTenants() → sélection revalidée (userId-scoped, SecureStore)
        ↓
api.js : Authorization + X-Platform-Tenant-Id (si validé) ; 401 OU 403{ACCOUNT_*} → nettoyage central
        ↓
socketService.js : auth{token, platformTenantId} ; joinHotelRoom/leaveHotelRoom prêts (non consommés)
        ↓
staffCapabilities.js (projection IAM-3, disponible pour SYNC-2B/2C)
        ↓
Navigation (shell partagé existant, inchangé)
```

## 4. SecureStore

Inchangé (déjà correct) : `TOKEN_KEY='auth_token'`, exclusivement `expo-secure-store`. Aucun déplacement vers AsyncStorage. La nouvelle sélection de tenant utilise également SecureStore (`platform_tenant_selection`), jamais AsyncStorage, par cohérence avec le reste de l'état lié à la session.

## 5. Login

Inchangé fonctionnellement. `login()` efface désormais explicitement un `accountStatusMessage` résiduel d'une session précédente (`AuthContext.jsx`).

## 6. Session restore

`restoreStoredSession()` continue de revalider via `GET /users/me` (jamais une simple confiance au token stocké). Son contrat de retour en cas d'échec est maintenant `{ revoked: true, message }` (au lieu de `null` silencieux), permettant d'afficher le motif réel (compte suspendu/banni/tokenVersion révoqué) au redémarrage à froid, sans jamais restaurer une session invalide.

## 7. tokenVersion

Toujours vérifié uniquement côté serveur (`authMiddleware.js`), jamais dupliqué côté client — conforme au mandat §7 (« ne pas essayer de vérifier tokenVersion côté client, le backend reste l'autorité »). Le pipeline 401 générique du mobile propage déjà correctement une révocation ; un test dédié (`AuthContext.test.jsx`) le démontre désormais explicitement au lieu de rester une hypothèse.

## 8. Compte suspendu

**Bug réel trouvé et corrigé.** Avant : `protect` renvoyait 403 sans `code`, le mobile ne réagissait pas, l'utilisateur restait « connecté » avec des 403 muets. Après : `authMiddleware.js` attache `code:'ACCOUNT_SUSPENDED'` (`name:'AccountStatusError'`), propagé par `errorMiddleware.js`, reconnu par `isAccountDisabledError()` côté mobile (`api.js`), déclenchant le même nettoyage qu'un 401 (token supprimé, socket déconnecté, tenant invalidé, cache vidé, message affiché). Testé (`api.test.js`, `AuthContext.test.jsx`).

## 9. Compte banni

Même mécanisme, `code:'ACCOUNT_BANNED'`. Testé explicitement (redémarrage à froid ET session en cours).

## 10. Compte inactif

Même mécanisme, `code:'ACCOUNT_INACTIVE'`, y compris au login (`authController.js` `rejectDisabledAccount`).

## 11. 401

Comportement inchangé et toujours correct : nettoyage central systématique. Un test vérifie qu'une erreur réseau (pas de `response`) ne déclenche **jamais** ce nettoyage (mandat §37).

## 12. 403

Un 403 ordinaire (ownership/capability, ex. `HOTEL_ACCESS_DENIED`) ne déclenche **jamais** de logout — testé explicitement pour garantir qu'aucune régression future ne confondrait les deux (mandat §10). Seuls les trois codes `ACCOUNT_*` structurés déclenchent le nettoyage.

## 13. Logout

Complète désormais le nettoyage déjà correct (token, socket, cache, état) par l'invalidation du gate tenant en mémoire (`clearValidatedPlatformTenant()`).

## 14. User switch

Testé explicitement via `PlatformTenantRuntimeContext.test.jsx` : une sélection de tenant persistée pour un `userId` différent n'est **jamais** réutilisée après changement de compte (revalidation stricte `persisted.userId === userId`).

## 15. Tenant

Nouveau runtime (`PlatformTenantRuntimeContext.jsx`), miroir conceptuel du pattern Web AUTH-1.1 (`client/lib/context/PlatformTenantRuntimeContext.jsx`), adapté aux primitives Mobile. Aucun utilisateur ordinaire n'est concerné (garde stricte `role==='Admin'`, aucun appel réseau superflu pour les autres — testé). Un opérateur non actif ne reçoit aucun tenant.

## 16. Tenant persistence

`SecureStore`, clé `platform_tenant_selection`, valeur `{userId, tenantId}`. Toute lecture est revalidée contre la liste réelle de tenants renvoyée par `/api/platform-tenants` avant injection — jamais une valeur brute injectée directement (mandat §18). Testé : tenant absent, tenant valide, tenant périmé (retiré de la liste), tenant d'un autre utilisateur — quatre scénarios, quatre tests verts.

## 17. Tenant header

`X-Platform-Tenant-Id` n'est injecté par `api.js` que si `setValidatedPlatformTenant()` a été appelé avec un tenant déjà revalidé. Jamais de valeur `undefined`/`null` envoyée (le header est simplement absent). Testé.

## 18. API client

`api.js` : intercepteur de requête inchangé pour `Authorization`, étendu pour le tenant conditionnel ; intercepteur de réponse étendu pour distinguer 401/403-compte-désactivé (nettoyage) de tout autre 403 (pass-through). Aucune lecture SecureStore supplémentaire par requête pour le tenant (gate en mémoire, cohérent avec le pattern déjà utilisé pour la même problématique côté Web).

## 19. IAM

`server/utils/iamArchitecture.js` reste l'autorité. `staffCapabilities.js` (nouveau, mobile) est un miroir volontaire et documenté de `client/lib/utils/staffCapabilities.js` (15 lignes, table figée) — pas une extraction monorepo (jugée disproportionnée pour ce volume, décision documentée dans le fichier lui-même). Aucune sécurité n'est déplacée côté client : cette projection ne fait que filtrer de la navigation/UI future.

## 20. Capabilities

`hasStaffCapability(user, capability)` testé pour les 6 profils du mandat (Admin, Secretaire, GestionnaireImmobilier, CommunityManager, Proprietaire/Client sans capability, rôle inconnu) — 8 tests, parité vérifiée avec la table serveur/web connue.

## 21. Navigation

Inchangée. Le shell unique (`TabNavigator`) + contenu conditionnel par rôle/profil est confirmé comme une architecture déjà conforme à la cible « shell partagé + modules autorisés » — aucune modification nécessaire, aucun dashboard staff créé (conforme à l'interdiction §69).

## 22. Owner contexts

Inchangés. `getEffectiveProfiles()` (USER-ARCH-UX-1) résout déjà dynamiquement `isProprietaireImmobilier`/`isExploitantEtablissement`/`isLocataireProfile` via un appel serveur dédié — confirmé conforme au mandat §30-32, aucune modification nécessaire.

## 23. Socket.IO

`socketService.js` : le payload `auth` inclut désormais `platformTenantId` (mis à jour aussi au `reconnect_attempt`, jamais figé). `joinHotelRoom(hotelId)`/`leaveHotelRoom(hotelId)` ajoutés, contrat exact DASH-4 (`establishment:join`/`establishment:leave`, acquittement `{ok, hotelId}`/`{ok:false, error}`, vérifié contre `server/socket.js`) — **non consommés par aucun écran**, préparés et testés isolément pour SYNC-2C/2D (mandat §40).

## 24. Notifications

Vérifié sans modification nécessaire : `resolveNavigation()` retourne déjà `null` pour tout type inconnu, l'appelant vérifie `if (!target) return;` avant toute navigation — aucun risque de plantage sur les types hospitality DASH-4 déjà en production côté API.

## 25. Cache

Inchangé (déjà correct : `cache.clear()` uniquement au logout/session invalidée, jamais sur les données publiques). Le nouveau cache tenant (SecureStore) suit la même politique : jamais vidé sur des données publiques, uniquement sur logout/session invalidée/tenant invalide.

## 26. Bugs trouvés

- **P1 réel** : compte suspendu/banni/inactif devenu invalide en cours de session ne déconnectait jamais le mobile (403 sans code structuré, jamais traité).
- **P2 test-infrastructure** : `jest.mock` factory référençant un `const` externe non garanti initialisé avant son exécution (hoisting Babel), masquant silencieusement l'échec du chemin de succès par défaut de `restoreStoredSession()`.
- Aucun P0 (aucune fuite de session révoquée, aucun accès cross-tenant, aucun token exposé) trouvé.

## 27. Bugs corrigés

Les deux ci-dessus, avec preuve directe (logs temporaires retirés, tests qui échouaient avant correction et passent après) à chaque étape — jamais une correction devinée.

## 28. Tests

| Fichier | Nouveaux tests | Total après |
|---|---:|---:|
| `api.test.js` | +15 | 18 |
| `AuthContext.test.jsx` | +3 (et 4 existants réparés/fiabilisés) | 7 |
| `socketService.test.js` | +8 | 13 |
| `PlatformTenantRuntimeContext.test.jsx` (nouveau) | 8 | 8 |
| `staffCapabilities.test.js` (nouveau) | 8 | 8 |

Suite complète mobile : **26 suites / 269 tests, 0 échec** (baseline SYNC-1 : 24/227 → +2 suites, +42 tests, zéro régression).

## 29. Gates

| Contrôle | Résultat |
|---|---|
| Mobile — syntaxe | ✅ 162 fichiers, 0 erreur |
| Mobile — lint | ✅ 0 erreur, 89 avertissements (86 préexistants + 3 `import/first` dans les nouveaux fichiers de test, même style que l'existant) |
| Mobile — types (`tsc --noEmit`) | ✅ |
| Mobile — tests | ✅ 26/26 suites, 269/269 tests |
| Mobile — export Android | ✅ bundle Hermes 6,7 Mo |
| Mobile — Expo Doctor | ⚠️ 20/21 (12 dépendances patch préexistantes, identiques à SYNC-1, aucune nouvelle incompatibilité) |
| Server — lint (fichiers modifiés) | ✅ 0 erreur, 3 avertissements préexistants non liés |
| Server — tests unitaires ciblés `auth` | ✅ 5/5 suites, 55/55 tests |
| Server — tests unitaires complets | ✅ 116/116 suites, 1326/1326 tests (identique à E2E-1, zéro régression) |
| `git diff --check` | ✅ propre |

## 30. Expo Doctor

Identique à SYNC-1 : 12 dépendances patch (`expo`, `expo-asset`, `expo-auth-session`, `expo-dev-client`, `expo-file-system`, `expo-image`, `expo-image-picker`, `expo-location`, `expo-notifications`, `expo-sharing`, `expo-store-review`, `expo-updates`). **Non mises à jour**, conformément au mandat — traitement réservé à `MOB-1`. Aucune nouvelle incompatibilité introduite par SYNC-2A.

## 31. Dette restante

- La restauration de session à froid supprime le token sur **toute** erreur (y compris réseau/timeout), pas seulement une révocation avérée — comportement préexistant, non corrigé ici (un vrai correctif nécessiterait une réflexion offline-first hors périmètre SYNC-2A, mandat §37 s'applique surtout aux sessions déjà actives, pas au cold start ; documenté comme risque P2/P3, pas silencieusement réputé résolu).
- Aucune UI de sélection de tenant n'existe encore (volontairement, mandat §21 : le runtime est prêt, l'écran appartient à SYNC-2C).
- Le diff exhaustif des ~90 propriétés `MOB_GAP_INVENTORY.json` face aux capabilities n'a pas été refait ligne à ligne — hors périmètre d'un sprint fondations.

## 32. Impact SYNC-2B

SYNC-2B (PMS mobile) peut désormais s'appuyer sur : un client API qui sait injecter le tenant correctement, un mécanisme de capabilities IAM-3 déjà disponible pour filtrer les futurs écrans housekeeping/inspection/maintenance, et un socket prêt à rejoindre `hotel:<id>` sans réinventer le contrat. Aucun écran PMS n'a été créé — conforme à l'interdiction du mandat.

## 33. Risques

- La table `staffCapabilities.js` (3 copies : serveur, web, mobile) doit être maintenue manuellement en synchronisation — risque de dérive documenté explicitement dans le fichier lui-même.
- Le tenant runtime mobile n'a jamais été exercé en conditions réelles (pas d'écran staff mobile existant) — seule la couche service/contexte est testée unitairement, pas un parcours utilisateur bout en bout (nécessitera une certification E2E dédiée en SYNC-2C/2D).

## 34. État Git

```
git status --short   → 9 fichiers modifiés, 9 fichiers nouveaux (services/contexts/tests mobile + 3 correctifs serveur + 4 docs SYNC1/SYNC2A)
git diff --check     → propre
git diff --stat      → 10 fichiers de code changés, 391 insertions(+), 34 suppressions(-)
git branch --show-current → main
git rev-parse HEAD   → 0fc4157262d3a8b69e86b02cda66cb95d2e26ed5 (inchangé)
```
Aucun `git add`/`commit`/`push`/déploiement.

## 35. Verdict

**SYNC-2A CERTIFIÉ VERT.**

- Session mobile alignée : ✅ (401 et 403-compte-désactivé traités uniformément, jamais un 403 ordinaire confondu).
- 401 central : ✅ (inchangé, déjà correct, désormais testé).
- Account status correct : ✅ (bug réel trouvé et corrigé, testé pour les 3 codes × 2 contextes cold-start/mid-session).
- Tenant runtime prêt : ✅ (scaffold complet, testé sur 8 scénarios incluant user-switch et staleness, aucune UI imposée).
- IAM consommable : ✅ (projection disponible, testée, sans sécurité déplacée côté client).
- Navigation cohérente : ✅ (vérifiée conforme, aucune modification nécessaire).
- Tests verts : ✅ (269/269 mobile, 1326/1326 serveur, zéro régression).

Expo Doctor reste 20/21 (dette patch préexistante, hors périmètre) — n'empêche pas le verdict, conformément au mandat. **SYNC-2B peut construire le PMS mobile sur une authentification, un tenant et des permissions au moins aussi robustes que le Web.**
