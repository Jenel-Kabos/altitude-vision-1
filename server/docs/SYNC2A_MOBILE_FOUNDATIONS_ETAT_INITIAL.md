# SYNC-2A — État initial des fondations runtime Mobile

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (confirmé identique à la référence SYNC-1, `git status --short` vide). Ce document précède toute écriture de code de ce sprint.

## 1. Rapports lus

`SYNC1_WEB_MOBILE_REPORT.md`, `SYNC1_PARITY_MATRIX.md` (écarts auth/tenant/IAM déjà chiffrés), `AUDIT_AUTH_REPORT.md`, `AUDIT_AUTH_RUNTIME_TENANT_REPORT.md`, `IAM2_ARCHITECTURE_REPORT.md`, `IAM3_STAFF_PERMISSIONS_REPORT.md`.

## 2. Auth mobile — flux réel reconstitué avant modification

```
LoginScreen → AuthContext.login() → POST /auth/login → SecureStore.saveToken()
→ setToken/setUser (état React) → AppNavigator (loading/needsProfileCompletion/user)
```

Cold start :
```
AppNavigator monte → AuthProvider.loadStoredAuth() → restoreStoredSession()
→ SecureStore.getToken() → GET /users/me (Bearer) → setToken/setUser
  (déjà une revalidation réseau réelle, PAS une simple confiance au token stocké)
```

## 3. SecureStore

`src/services/api.js` : `TOKEN_KEY='auth_token'`, `saveToken`/`getToken`/`deleteToken` via `expo-secure-store` exclusivement. Aucune trace de JWT dans AsyncStorage (AsyncStorage confirmé utilisé ailleurs uniquement pour thème/navigation/brouillons/onboarding — jamais le token).

## 4. 401 centralisé — déjà en place

L'intercepteur de réponse Axios (`api.js`) traitait déjà tout 401 en central : suppression du token + appel à un `sessionInvalidatedHandler` enregistré par `AuthContext`. Aucun écran ne gérait son propre logout.

## 5. tokenVersion — vérifié côté serveur, jamais lu côté mobile

`server/middleware/authMiddleware.js` (`protect`) compare `decoded.tokenVersion < user.tokenVersion` et répond 401 « Session expirée ». Le mobile ne lit jamais `tokenVersion` explicitement, mais en bénéficiait déjà **indirectement** via le pipeline 401 générique — fonctionnellement correct, mais invérifiable par un test avant SYNC-2A (aucun test ne couvrait ce chemin).

## 6. Compte suspendu/banni/inactif — **bug réel confirmé avant toute correction**

`protect` (mid-session) et `rejectDisabledAccount` (login, `authController.js`) renvoient tous deux **403**, jamais 401, pour un compte suspendu/banni/inactif — **sans aucun champ `code` structuré**, seulement un message texte. L'intercepteur mobile ne traitait QUE le 401 ; un 403 « compte devenu inutilisable » ne déclenchait donc **aucun** nettoyage de session : l'utilisateur restait « connecté » localement (token conservé, écran non redirigé), recevant des 403 répétés sans jamais être informé ni déconnecté. Confirmé par lecture directe du code, jamais supposé.

## 7. Tenant (AUTH-1.1) — inexistant côté mobile

`client/lib/context/PlatformTenantRuntimeContext.jsx` (Web) : source de vérité pour le pattern cible — résout `getMyOperatorStatus()`/`listTenants()` uniquement pour `role==='Admin'`, persiste la sélection scoped par `userId` dans `localStorage`, revalide contre la liste réelle avant d'injecter `X-Platform-Tenant-Id` via `setValidatedPlatformTenant`/`clearValidatedPlatformTenant` (gate en mémoire dans `client/lib/services/api.js`). Aucun équivalent mobile n'existait : `altimmo-app/src/services/api.js` n'avait ni gate ni header, `altimmo-app/src/services/socketService.js` n'envoyait aucun `platformTenantId`.

## 8. IAM — projection existante, jamais portée sur mobile

`server/utils/iamArchitecture.js` (`DEFAULT_CAPABILITIES`) et `client/lib/utils/staffCapabilities.js` (copie fidèle, 15 lignes, table figée) définissent la même projection READ/MANAGE par rôle staff. Aucun fichier équivalent n'existait dans `altimmo-app/src`. Le mobile utilisait uniquement des checks de rôle bruts (`STAFF_ROLES = ['Admin', 'Collaborateur']` dans `ConversationsScreen.jsx`) — jamais une capability fine, jamais une RBAC parallèle dangereuse non plus (juste une granularité moindre).

## 9. Navigation post-auth

Web : `client/lib/navigation/postAuthDestination.js`, résolution par route explicite selon `user.role`. Mobile : `AppNavigator.jsx` utilise un shell unique (`TabNavigator`) commun à tous les rôles authentifiés, avec contenu conditionnel par écran (pattern déjà conforme à l'architecture cible « shell partagé + modules autorisés » suggérée par le mandat) — pas un défaut, une architecture différente mais saine, confirmée par lecture directe.

## 10. Owner multi-activité — déjà résolu par USER-ARCH-UX-1

`AuthContext.jsx` appelle déjà `getEffectiveProfiles(userId)` (`userBusinessProfileService.js`) et expose `isProprietaireImmobilier`/`isExploitantEtablissement`/`isLocataireProfile` en booléens dérivés d'un appel serveur dédié — jamais un profil unique statique, jamais tout chargé dans le JWT. Confirmé conforme au mandat §30-32 sans modification nécessaire.

## 11. Socket.IO mobile

`socketService.js` authentifiait déjà par JWT avec rafraîchissement au `reconnect_attempt`, gérait les rooms de conversation (`join-room`/`leave-room`). Aucune room `hotel:<id>` (contrat DASH-4 `establishment:join`/`establishment:leave`, vérifié dans `server/socket.js`) n'était consommée. Aucun `platformTenantId` transmis à la connexion (contrairement au hook Web `useHotelRealtime.js`).

## 12. Notifications — fallback déjà sûr

`notificationsService.js` (`resolveNavigation`) retourne déjà `null` proprement pour tout type inconnu ou sans destination valide ; l'appelant (`setupNotificationListeners`) vérifie `if (!target) return;` avant toute navigation — confirmé par lecture directe, aucun risque de plantage sur un nouveau type hospitality (DASH-4) déjà présent, même sans destination NAV-CORE dédiée.

## 13. Tests — bug d'infrastructure de test découvert pendant l'audit

`src/context/__tests__/AuthContext.test.jsx` déclarait `const mockApi = {...}` puis `jest.mock('../../services/api', () => ({ default: mockApi, ... }))`. Babel hoiste les appels `jest.mock` avant les imports, mais PAS les déclarations `const` classiques (seule la variable nommée `mockApi` est autorisée à être référencée dans la factory, pas garantie initialisée avant l'exécution de celle-ci). Preuve directe (logs temporaires, retirés) : la factory s'exécutait avec `mockApi === undefined`, rendant `apiClient` silencieusement `undefined` dans tout appel par défaut de `restoreStoredSession()`. Masqué jusqu'ici car aucun test n'exerçait le chemin de succès par défaut du Provider (le seul test positif utilisait des mocks injectés explicitement, contournant le bug).

## 14. Baseline Expo/tests avant modification

Syntaxe 157 fichiers/0 erreur, lint 0 erreur/86 avertissements, tests 24 suites/227 tests, export réussi, Expo Doctor 20/21 (12 dépendances patch préexistantes).

## 15. Ce que ce document ne couvre pas encore

Les corrections effectivement appliquées, les nouveaux tests, les résultats de gates post-modification et le verdict final sont dans `SYNC2A_MOBILE_FOUNDATIONS_REPORT.md`.
