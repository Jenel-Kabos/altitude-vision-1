# RBAC-3 — WEB CAPABILITY CONSUMPTION

**Verdict : RBAC-3 : CERTIFIÉ VERT.**

Le Web consomme désormais les capacités calculées côté backend (RBAC-2) via un unique point d'exposition réutilisé (login, `/auth/google`, `/auth/google-token`, `/me`) et un unique helper canonique `can(capability)`. Aucun mapping rôle→capacités recréé côté client. Le pilote migré (`AdminDashboard.jsx`, `RoleDashboardOverview.jsx`) remplace le seul duplicata réel identifié (`staffCapabilities.js`), avec parité stricte prouvée par tests. Trois tests adversariaux prouvent que le backend ignore tout rôle/capacités forgé côté client. Deux divergences frontend/backend préexistantes ont été caractérisées avec preuve (une cosmétique, une réelle mais non corrigée faute de mandat) ; un drift de redirection post-login a été identifié comme indépendant du modèle de capacités et volontairement non traité.

## Réponses aux 47 questions du mandat

1. **Le backend reste-t-il l'unique juge de l'autorisation ?** Oui — `can()` ne fait qu'afficher/masquer de l'UI ; toutes les routes migrées ou non continuent d'être protégées par `protect`/`requireCapability`/`restrictTo`/gardes tenant/ownership, inchangés.
2. **Un nouveau système IAM a-t-il été créé côté client ?** Non — un seul helper `can(capability)` lisant `user.capabilities`, aucune logique de résolution rôle→capacités côté client.
3. **Le contenu de `iamArchitecture.js` a-t-il été copié dans `client/` ?** Non.
4. **Un mapping `ROLE_CAPABILITIES` a-t-il été recréé dans `client/` ?** Non — celui qui existait déjà (`staffCapabilities.js`, préexistant à RBAC-3) n'a plus de consommateur de production après migration, mais n'a pas été dupliqué ni recréé ailleurs.
5. **Quel point d'exposition a été choisi ?** Réutilisation des payloads d'identité existants (`createSendToken`, `sendGoogleAuthResponse`, `googleGetToken`) + `/me` pour l'auto-guérison — aucune route `/api/capabilities` créée (mandat §9).
6. **Pourquoi ce choix plutôt qu'une nouvelle route ?** Ces quatre points sont déjà appelés à chaque étape du cycle de vie d'authentification (connexion, refresh, restauration) ; ajouter un champ à une réponse existante est strictement additif et déjà prouvé rétrocompatible par les tests existants.
7. **`getEffectiveCapabilities` est-il réutilisé sans modification ?** Oui, importé tel quel dans `authController.js` et `userController.js`, aucune modification de sa signature ni de son comportement (RBAC-2).
8. **Une nouvelle logique de résolution rôle→capacités a-t-elle été écrite côté serveur ?** Non.
9. **Le payload expose-t-il des secrets ?** Non — uniquement des chaînes `domain.action` déjà publiques dans le code source backend.
10. **Le payload expose-t-il des détails de règles internes ?** Non — pas de logique conditionnelle, juste la liste résultante.
11. **Le payload expose-t-il des IDs tenant inutiles ?** Non — aucun champ tenant ajouté.
12. **Le payload expose-t-il les permissions d'un autre utilisateur ?** Non — `capabilities` sur `/me` est gardé par la même vérification d'identité (`requesterId === user._id`) que `platformOperator`.
13. **`businessProfiles` a-t-il été fusionné avec `capabilities` ?** Non — flux, effets React et endpoints strictement séparés (voir `RBAC3_AUTH_FLOW_MATRIX.md`).
14. **Le tenant a-t-il été encodé dans une chaîne de capacité (`properties.update.tenant123`) ?** Non.
15. **`HotelStaffAssignment` a-t-il été transformé en capacité globale ?** Non — fichier non touché.
16. **`financialAuthorizationService` a-t-il été réduit à un bouton frontend ?** Non — fichier non touché, aucune règle financière déplacée côté client.
17. **Le comportement `PlatformOperator` (sélection tenant, fail-closed) a-t-il été altéré ?** Non — fichiers non touchés.
18. **Un seul helper canonique a-t-il été créé ?** Oui — `can(capability)`, exposé par `useAuth()`.
19. **Plusieurs abstractions parallèles existent-elles (`can`, `hasCapability`, `userCan`...) ?** Non — une seule.
20. **Une capacité inconnue/absente retourne-t-elle `false` ou `true` ?** `false` systématiquement (`Boolean(user?.capabilities?.includes(capability))`).
21. **Un payload absent (session ancienne) cache-t-il tout le dashboard ?** Non — les liens/menus gated par rôle (`link.roles`) restent inchangés et visibles ; seuls les liens gated par `capability` sont temporairement fail-closed jusqu'à l'auto-guérison via `/me` (quasi immédiate au premier rendu).
22. **Un fallback permanent `ROLE_CAPABILITIES[user.role]` a-t-il été créé ?** Non — explicitement refusé. Le mécanisme mis en place rafraîchit l'identité réelle depuis le backend (`/me`), jamais un recalcul local à partir du rôle. Transitoire et documenté dans `AuthContext.jsx` et `RBAC3_SECURITY_MATRIX.md`.
23. **`staffCapabilities.js` a-t-il été audité intégralement ?** Oui — voir `RBAC3_WEB_MIGRATION_MATRIX.md`. Ses deux consommateurs de production ont été migrés ; le fichier lui-même n'a pas été supprimé (son propre test le référence encore).
24. **Tous les ~60 checks de rôle Web ont-ils été convertis ?** Non, volontairement.
25. **Quel périmètre pilote a été choisi et pourquoi ?** `AdminDashboard.jsx` + `RoleDashboardOverview.jsx` — les deux seuls consommateurs réels du mapping dupliqué `staffCapabilities.js`, cible directe et sans ambiguïté du mandat §3.
26. **Le pilote a-t-il une preuve de parité avant/après ?** Oui — `DEFAULT_CAPABILITIES` (backend) ≡ `CAPABILITIES_BY_ROLE` (client, avant migration) champ par champ ; tests `AdminDashboardDomains.test.jsx` et `DashboardResponsiveNavigation.test.jsx` rejoués verts après migration.
27. **Les deux pages `isStaffImmo`-divergentes (RBAC-1) ont-elles été identifiées précisément ?** Oui — `GestionLocativePage.jsx` (`canManage`, exclut Collaborateur) et `TransactionsPage.jsx` (`isAdmin`, exclut GestionnaireImmobilier).
28. **Ont-elles été corrigées sans preuve, "parce que ça semble logique" ?** Non — caractérisées avec preuve backend route par route (voir `RBAC3_SECURITY_MATRIX.md`), **aucune correction appliquée**.
29. **`GestionLocativePage.jsx` — le comportement actuel est-il un vrai trou de sécurité ou cosmétique ?** Mixte : cosmétique pour la désactivation de mandat (backend restreint pareillement), **écart réel** pour l'édition/suppression de biens et la création/mise à jour de mandat (backend autoriserait Collaborateur, l'UI le lui cache).
30. **`TransactionsPage.jsx` — idem ?** Cosmétique — le backend exclut déjà GestionnaireImmobilier sur toutes les routes concernées (`STAFF_DOC`), donc aucun accès non autorisé possible malgré la divergence de rôle.
31. **Un mismatch UI-permissive/backend-strict a-t-il été trouvé au passage ?** Oui, aparté noté dans `RBAC3_SECURITY_MATRIX.md` : bouton de validation de virement visible à `Collaborateur` alors que la route est `adminOnly` — sans risque (backend bloque), mais UX trompeuse, non corrigé (hors mandat).
32. **`user.role` a-t-il été retiré du frontend ?** Non — toujours présent et utilisé (affichage, `isAdmin`, `isCollaborateur`, checks legacy non migrés).
33. **Le drift des 3 résolveurs de redirection post-login pour Proprietaire a-t-il été traité comme un problème d'autorisation ?** Non — caractérisé (deux résolveurs distincts identifiés : `postAuthDestination.js`/`resolveOwnerDestination` vs `google-redirect/page.jsx` hardcodé) et explicitement classé comme UX-routing indépendant du modèle de capacités.
34. **A-t-il été corrigé dans ce sprint ?** Non — recommandation formelle d'un `HOTFIX-AUTH-POSTLOGIN-ROUTING-1` séparé.
35. **Le fix `trustHost: true` (HOTFIX-WEB-GOOGLE-AUTH-1) a-t-il été touché ?** Non — toujours présent tel quel dans `route.js`.
36. **Le payload `capabilities` est-il documenté comme "projection UX, pas un titre d'habilitation" ?** Oui — commentaires dans `route.js`, `AuthContext.jsx`, et section dédiée de `RBAC3_SECURITY_MATRIX.md`.
37. **Le backend fait-il confiance à un `capabilities` envoyé par le client dans un body ?** Non — prouvé par 3 tests adversariaux (`propertyAssetRoutes.mongo.integration.test.js`).
38. **Logout vide-t-il bien les capacités ?** Oui — `logout()` vide `localStorage`/`user` intégralement ; `can()` retourne `false` (aucun utilisateur).
39. **Changement d'utilisateur (Admin→Client) laisse-t-il des capacités résiduelles ?** Non — `login()` réécrit intégralement l'objet `user`, jamais de merge partiel avec l'identité précédente.
40. **Le timing de propagation d'un changement de rôle est-il documenté ?** Oui — voir `RBAC3_SESSION_MATRIX.md` (immédiat au prochain login pour email/password, ≤5 min pour Google via le cycle de refresh existant).
41. **Chaque surface pilote migrée a-t-elle un test autorisé→visible / refusé→masqué / capacité absente→refusé / reload→stable ?** Oui — `AdminDashboardDomains.test.jsx` (rôles multiples), `DashboardResponsiveNavigation.test.jsx`, `dashboardProfiles.test.js`, plus `AuthContextCan.test.jsx` pour le helper lui-même (présent/absent/session absente/reload via restauration `localStorage`).
42. **Des tests adversariaux (reload, logout, changement d'utilisateur) ont-ils été ajoutés ?** Reload et session-ancienne testés explicitement (`AuthContextCan.test.jsx`) ; logout/changement d'utilisateur analysés par lecture de code (mécanismes préexistants inchangés, comportement déjà correct par construction — voir `RBAC3_SESSION_MATRIX.md`) plutôt que par nouveaux tests, ce mécanisme n'ayant pas été modifié par RBAC-3.
43. **La taille de payload JWT/session a-t-elle été mesurée ?** Oui — +446 octets (cas réel GestionnaireImmobilier), +991 octets (pire cas 32 capacités) — voir `RBAC3_SESSION_MATRIX.md`. Décision : négligeable, pas de bascule vers `/me` nécessaire pour la session NextAuth.
44. **`/me` a-t-il été modifié pour un usage différent (auto-guérison) ?** Oui — `capabilities` ajouté à `/me` avec la même garde d'exposition que `platformOperator`, utilisé uniquement par l'effet d'auto-guérison ponctuel, jamais en polling.
45. **Tests backend complets après modification de `authController.js`/`userController.js` ?** Oui — 128/128 suites, 1473/1473 tests (suite unit complète rejouée).
46. **Tests Mongo ciblés sur la route pilote ?** Oui — `propertyAssetRoutes.mongo.integration.test.js` : 40/40 tests (37 préexistants + 3 adversariaux nouveaux).
47. **Build production Next.js vert ?** Oui — `npm run build:next` termine sans erreur.

## Gates exécutées

- Backend unit : **128/128 suites, 1473/1473 tests** verts (rejoué après modification de `authController.js` et `userController.js`).
- Backend Mongo ciblé (route pilote) : **1/1 suite, 40/40 tests** verts.
- Backend lint : **0 erreur** (106 warnings, baseline inchangée depuis RBAC-2).
- Client (Vitest) : **95/95 fichiers, 655/655 tests** verts.
- Client lint : **0 erreur** (267 warnings, baseline préexistante — aucun nouveau warning imputable à RBAC-3).
- Build production (`npm run build:next`) : vert.
- `git diff --check` : exit 0.

Note : la suite Mongo **exhaustive** (`npm run test:mongo`, 97 suites) n'a pas été rejouée intégralement dans ce sprint — seule la suite touchant la route pilote modifiée par capacité (`propertyAssetRoutes`) l'a été, car aucun autre fichier backend touché par RBAC-3 n'a de contrepartie Mongo (`authController.js`/`userController.js` sont couverts par la suite unit, mockée, qui est passée intégralement). Recommandé de rejouer `npm run test:mongo` complet avant tout déploiement, par prudence.

## Fichiers modifiés

`server/controllers/authController.js`, `server/controllers/userController.js`, `server/__tests__/propertyAssetRoutes.mongo.integration.test.js`, `client/app/api/auth/[...nextauth]/route.js`, `client/lib/context/AuthContext.jsx`, `client/lib/services/userService.js`, `client/lib/pages/dashboard/AdminDashboard.jsx`, `client/lib/pages/dashboard/RoleDashboardOverview.jsx`, `client/lib/__tests__/nextauthJwtCallback.test.js`, `client/lib/__tests__/AdminDashboardDomains.test.jsx`, `client/lib/__tests__/DashboardResponsiveNavigation.test.jsx`.

Créés : `client/lib/__tests__/AuthContextCan.test.jsx`, `server/docs/RBAC3_*.md` (7 documents).

Aucun fichier `altimmo-app/` touché. Aucun commit/push/déploiement.

## Dette restante

- `staffCapabilities.js` toujours présent (mort en production, encore testé) — candidat RBAC-5.
- ~60 checks de rôle Web restants non migrés (dont `isStaffImmo`/`isStaffDocs` et leurs consommateurs) — hors périmètre pilote.
- `GestionLocativePage.jsx` `canManage` : écart réel caractérisé (Collaborateur bloqué côté UI sur des actions que le backend autoriserait) — nécessite une décision utilisateur avant correction.
- `TransactionsPage.jsx` bouton de validation de virement visible à Collaborateur malgré une route `adminOnly` — UX trompeuse sans risque de sécurité, non corrigée.
- Drift de redirection post-login Proprietaire (2 résolveurs indépendants) — recommandé `HOTFIX-AUTH-POSTLOGIN-ROUTING-1`.
- Suite Mongo exhaustive non rejouée intégralement dans ce sprint (voir Gates ci-dessus).

## Roadmap proposée (non démarrée)

- **RBAC-4** → Mobile consomme les capacités backend (après résolution préalable de la convention de casse identifiée par RBAC-1).
- **RBAC-5** → Suppression de `staffCapabilities.js` (devenu mort en production) une fois son fichier de test lui-même retiré/adapté ; poursuite de la migration des ~60 checks de rôle Web restants ; décision sur `GestionLocativePage.jsx`/`TransactionsPage.jsx`/le bouton de virement Collaborateur.

## STOP

Conformément au mandat : aucun nouveau système IAM créé côté client, aucun mapping rôle→capacités recréé, `businessProfiles`/`HotelStaffAssignment`/`financialAuthorizationService`/`PlatformOperator` non modifiés, `trustHost: true` intact, aucune règle métier changée, aucune migration Mobile. RBAC-4 n'a pas été démarré automatiquement. En attente de validation utilisateur.
