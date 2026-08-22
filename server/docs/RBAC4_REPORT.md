# RBAC-4 — MOBILE CAPABILITY CONSUMPTION

**Verdict : RBAC-4 : CERTIFIÉ VERT** (sous réserve explicite de non-validation sur device physique — voir §40/§56).

Le mobile consomme désormais les capacités backend via le même contrat que le Web (RBAC-3) : les endpoints `/auth/login`, `/auth/google`, `/users/me` étaient déjà enrichis de `capabilities` par RBAC-3 et le mobile les appelle tels quels — aucune modification backend n'a été nécessaire. Un unique helper canonique `can(capability)` a été ajouté à `AuthContext.jsx` mobile, fail-closed, sans mapping rôle→capacités recréé. L'audit a établi qu'il n'existe **aucune surface staff de production** sur mobile à migrer (contrairement au Web) : `staffCapabilities.js` mobile est du code mort prouvé (zéro consommateur de production), et le seul candidat de migration réaliste (`canAdd`) a été délibérément **non migré** car cela aurait étendu l'accès à `GestionnaireImmobilier` sans preuve d'intention produit. Les identités métier externes (Proprietaire/Client/businessProfiles) sont intactes.

## Réponses aux 48 questions du mandat

1. **Le mobile recevait-il déjà `capabilities` avant RBAC-4 ?** Oui — le backend les envoyait déjà (RBAC-3) sur les mêmes endpoints que le mobile appelle ; le mobile ne les lisait simplement pas.
2. **Par quelles routes ?** `POST /auth/login` (`createSendToken`), `POST /auth/google` (`sendGoogleAuthResponse`), `GET /users/me` (`getUser`, gardé par `requesterId === user._id`).
3. **Où sont-elles stockées ?** Nulle part en stockage persistant — uniquement dans l'état React `user` (en mémoire), reconstruit à chaque cold start via `/users/me`. Seul le token JWT est persisté (`expo-secure-store`, clé `auth_token`).
4. **Existe-t-il un seul `can()` ?** Oui, dans `altimmo-app/src/context/AuthContext.jsx`.
5. **Le mobile calcule-t-il encore role → capabilities ?** Non — `can()` lit exclusivement `user.capabilities` reçu du backend.
6. **Existe-t-il un fallback local ?** Non.
7. **Comment les anciennes sessions sont-elles réparées ?** Structurellement, sans mécanisme dédié : chaque cold start relit `/users/me` en entier, qui renvoie déjà `capabilities` à jour. Aucun état "ancien" ne peut survivre au-delà d'un redémarrage de l'app.
8. **Offline sans capabilities → quoi ?** Fail closed (`can()` → `false`) ; si offline dès le cold start, la session n'est pas restaurée du tout (comportement préexistant, non modifié).
9. **Logout supprime-t-il capabilities ?** Oui — `user` mis à `null`, testé explicitement.
10. **User switch sûr ?** Oui — `login()`/`loginWithGoogle()` remplacent `user` intégralement, jamais de merge avec l'identité précédente ; testé explicitement.
11. **Google login reçoit-il capabilities ?** Oui.
12. **Google signup ?** Oui — même endpoint, même réponse.
13. **Login email ?** Oui.
14. **Signup email ?** Non applicable — `register()` ne crée pas de session (pas de `setUser`/`setToken`), donc pas de capacités à threader à cette étape.
15. **`/me` utilisé ?** Oui — unique point d'appel, au cold start (`restoreStoredSession`).
16. **`staffCapabilities.js` est-il utilisé ?** Non, en production — zéro consommateur réel (grep exhaustif).
17. **Combien de consumers ?** Un seul, et c'est son propre fichier de test (`staffCapabilities.test.js`) ; plus une mention en commentaire non fonctionnelle dans `HotelHousekeepingScreen.jsx`.
18. **A-t-il été supprimé ?** Non.
19. **Si non, pourquoi ?** Le mandat ne demande pas explicitement le nettoyage dans ce sprint (§20-21 demandent l'audit et posent une condition de mandat local non levée) ; recommandé pour RBAC-5, en même temps que l'équivalent Web.
20. **Combien de checks mobile migrés ?** Zéro conversion de check existant — l'audit a montré qu'aucun ne pouvait l'être sans changement de comportement non prouvé souhaité.
21. **Quelles surfaces ?** Aucune surface UI migrée ; la plomberie (`capabilities` dans `user`, helper `can()`) a été mise en place et testée, prête pour un futur usage.
22. **Des checks Proprietaire ont-ils été conservés ?** Oui, tous, intacts.
23. **Pourquoi ?** Ce sont des identités métier externes (ownership/profil), pas des permissions staff — hors périmètre capacités par nature (mandat §23-27).
24. **BusinessProfiles intacts ?** Oui — fichier et flux non touchés.
25. **Mes biens intact ?** Oui — `ProfilScreen.jsx` non modifié, logique `isProprietaire`/`isAdmin` inchangée.
26. **Google mobile intact ?** Oui — `googleSignIn.js`, config native, `AuthContext.loginWithGoogle` non modifiés (seul l'ajout du helper `can` en dehors de cette fonction).
27. **Tenant intact ?** Oui — aucun fichier tenant existant côté mobile (aucune fonctionnalité tenant mobile identifiée par l'audit).
28. **HotelStaffAssignment intact ?** Oui — non touché, aucun écran hôtelier staff mobile concerné.
29. **Financial intact ?** Oui — non touché.
30. **Backend permissions inchangées ?** Oui — aucun fichier `server/` modifié par RBAC-4.
31. **Web RBAC-3 intact ?** Oui — aucun fichier `client/` modifié par RBAC-4.
32. **Parité Web/Mobile prouvée ?** Oui, par construction — les deux consomment littéralement les mêmes endpoints/fonctions backend (`createSendToken`, `sendGoogleAuthResponse`, `getUser`), donc même valeur de `capabilities` pour un même utilisateur ; aucune route mobile-spécifique n'existe qui pourrait diverger.
33. **Tests ciblés ?** Oui — `AuthContext.test.jsx` : 18/18 tests (9 préexistants inchangés + 9 nouveaux sur `can()`/capacités).
34. **Suite mobile complète ?** Oui — 49/49 suites, 430/430 tests.
35. **Lint ?** 0 erreur (111 warnings, baseline préexistante).
36. **TypeScript ?** `tsc --noEmit` : 0 erreur.
37. **Expo Doctor ?** 20/21 checks verts ; 1 échec préexistant (versions de patch Expo SDK légèrement en retard sur 12 packages) — non lié à RBAC-4, non corrigé (hors périmètre, mandat §53 : documenter séparément).
38. **Export Android ?** Oui — `npx expo export --platform android` réussi, bundle généré sans erreur.
39. **Build Android (Gradle) ?** Non exécuté — nécessite un environnement JDK/Android SDK natif non mobilisé pour ce sprint ; le changement (un objet JS ajouté à un contexte React) ne touche aucun code natif, et l'export Metro/Hermes (étape 38) a déjà validé la compilation JS/bundling. Non transformé en défaut RBAC (mandat §55).
40. **Samsung testé ?** Non — device non disponible dans cet environnement. Documenté explicitement (mandat §56/§66) plutôt que simulé.
41. **Backend tests pertinents ?** Oui, rejoués par prudence bien qu'aucun fichier backend n'ait été modifié : `authRoutes.test.js`, `authValidation.test.js`, `googleAuthTokenVerification.test.js`, `googleGetToken.test.js`, `iamArchitecture.test.js`, `rolesAliasParity.test.js` — 6/6 suites, 65/65 tests verts.
42. **`git diff --check` ?** exit 0.
43. **Fichiers modifiés ?** `altimmo-app/src/context/AuthContext.jsx`, `altimmo-app/src/context/__tests__/AuthContext.test.jsx`. Créés : `server/docs/RBAC4_*.md` (7 documents).
44. **Commit ?** Aucun.
45. **Push ?** Aucun.
46. **Deploy ?** Aucun.
47. **Dette restante ?** `staffCapabilities.js` mobile (code mort, candidat RBAC-5, à traiter avec son équivalent Web) ; `canAdd` (candidat de migration nécessitant une décision produit explicite, car migrer étendrait l'accès à `GestionnaireImmobilier`) ; absence de validation sur device physique et de build Gradle natif (documentée, non bloquante pour ce sprint JS-only).
48. **Verdict ?** **CERTIFIÉ VERT.** Tous les critères du mandat §66 sont remplis : le mobile consomme les capacités backend, aucune matrice rôle→capacités recréée, `can()` fail closed, aucune session ancienne ne bénéficie d'un fallback local (structurellement impossible ici, capacités toujours fraîches via `/me` au cold start), logout/user switch sûrs et testés, les checks métier Proprietaire/Client légitimes sont conservés, l'authentification Google n'est pas régressée, RBAC-3 (Web) n'est pas régressé, le backend reste l'unique autorité de sécurité (aucun fichier backend modifié), tests/lint/TypeScript/export sont verts. Seule réserve : validation sur device physique et build Gradle natif non exécutés faute d'environnement — sans impact sur le changement lui-même (JS pur, aucun module natif touché).

## Gates exécutées

- Mobile tests (Jest + Testing Library) : **49/49 suites, 430/430 tests** verts (dont 18/18 sur `AuthContext.test.jsx`).
- Mobile lint : **0 erreur** (111 warnings, baseline préexistante).
- Mobile TypeScript (`tsc --noEmit`) : **0 erreur**.
- Expo Doctor : **20/21** (1 échec préexistant, versions de patch, non lié à RBAC-4).
- Export Expo Android : **vert**.
- Build Gradle natif / device physique : **non exécutés** (environnement non disponible), documentés comme tels, sans impact JS.
- Backend (non modifié par ce sprint, rejoué par prudence) : **6/6 suites, 65/65 tests** verts.
- `git diff --check` : exit 0.

## Fichiers modifiés

`altimmo-app/src/context/AuthContext.jsx`, `altimmo-app/src/context/__tests__/AuthContext.test.jsx`.

Créés : `server/docs/RBAC4_ETAT_INITIAL.md`, `RBAC4_AUTH_FLOW_MATRIX.md`, `RBAC4_MOBILE_MIGRATION_MATRIX.md`, `RBAC4_MOBILE_CAPABILITY_DEBT_MATRIX.md`, `RBAC4_SECURITY_MATRIX.md`, `RBAC4_SESSION_MATRIX.md`, `RBAC4_REPORT.md`.

Aucun fichier `server/` ni `client/` modifié. Aucun commit/push/déploiement.

## Dette restante

- `altimmo-app/src/utils/staffCapabilities.js` (+ son test) : code mort en production, candidat RBAC-5, à traiter avec l'équivalent Web (`client/lib/utils/staffCapabilities.js`).
- `canAdd` (`AuthContext.jsx:240`) : mélange permission staff et identité métier ; sa portion staff pourrait devenir `can('properties.create')` mais cela étendrait l'accès à `GestionnaireImmobilier` — nécessite une décision produit explicite avant conversion.
- Validation device physique et build Gradle natif non réalisés dans ce sprint (environnement indisponible) — recommandé avant tout déploiement mobile réel de ce changement.

## Roadmap proposée (non démarrée)

- **RBAC-5** → Nettoyage des duplications désormais prouvées mortes : `staffCapabilities.js` Web ET Mobile (avec leurs tests dédiés), poursuite de la migration des checks de rôle Web restants (`isStaffImmo`/`isStaffDocs` et consommateurs), décision produit sur `canAdd` mobile, décision sur `GestionLocativePage.jsx`/`TransactionsPage.jsx` (RBAC-3), unification des résolveurs de redirection post-login (`HOTFIX-AUTH-POSTLOGIN-ROUTING-1`, indépendant des sprints RBAC).

## STOP

Conformément au mandat : aucun mapping rôle→capacités recréé côté mobile, `can()` fail closed, `Proprietaire`/`Client`/`businessProfiles` intacts, Google auth mobile non régressée, Web RBAC-3 non régressé, backend non modifié et reste l'unique autorité de sécurité. Aucun commit/push/déploiement. RBAC-5 n'a pas été démarré automatiquement. En attente de validation utilisateur.
