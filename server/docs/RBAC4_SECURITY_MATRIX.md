# RBAC-4 — MATRICE DE SÉCURITÉ MOBILE

## Principe non négociable (identique à RBAC-3)

> Le payload `capabilities` reçu par le mobile est une projection UX de l'autorisation backend, pas un titre d'habilitation. `can('properties.update')` en React Native ne sécurise rien : il ne fait qu'afficher/masquer un élément d'UI. Un utilisateur peut patcher l'app, intercepter/modifier le trafic réseau, ou forger un état local — le backend réévalue **toujours** indépendamment via `protect`/`requireCapability`/`restrictTo`/gardes tenant/ownership.

RBAC-4 n'a **modifié aucun fichier backend** (voir `git status` du sprint — seuls `altimmo-app/src/context/AuthContext.jsx` et son fichier de test ont changé). La preuve de robustesse backend contre un rôle/des capacités forgées date de RBAC-3 (`server/__tests__/propertyAssetRoutes.mongo.integration.test.js`, describe "le backend ignore un role/capabilities forgé dans le corps de la requête", 3 tests) et reste valide sans modification : `requireCapability` (`server/middleware/capabilityMiddleware.js`) lit exclusivement `req.user?.role`, posé par `protect` à partir du JWT vérifié, jamais du corps de la requête — ce mécanisme est partagé par le Web et le Mobile puisqu'il ne connaît même pas l'existence d'un client mobile spécifique.

## Capacité locale forgée (mobile) — analyse

Un utilisateur mobile pourrait patcher l'app ou modifier l'état React en mémoire pour que `user.capabilities` contienne n'importe quelle chaîne (`['*']`, `['payments.reverse']`, etc.). Conséquence :
- `can('payments.reverse')` retournerait `true` côté mobile → un bouton normalement masqué deviendrait visible.
- L'action déclenchée par ce bouton appellerait la même route backend que d'habitude (ex. `POST /property-asset/:id/transition`), protégée par `requireCapability('properties.update')`, qui relit `req.user.role` depuis la base via le JWT — **la capacité forgée côté client n'entre jamais dans ce calcul**. Le backend répondrait 403 exactement comme si le bouton n'avait jamais été affiché.

Aucun nouveau test mobile-spécifique n'a été nécessaire pour prouver ce point : le test générique existant (RBAC-3, backend) couvre exactement ce scénario indépendamment du client d'origine de la requête (le middleware ne différencie pas Web/Mobile). Le point testé côté mobile (`AuthContext.test.jsx`) est différent et complémentaire : que `can()` lise fidèlement `user.capabilities` sans jamais recalculer localement à partir du rôle (donc qu'il n'existe pas de mécanisme *interne* à l'app qui régénérerait une capacité non reçue du backend).

## Sessions obsolètes / hors-ligne

- **Session ancienne (build antérieur à ce sprint) restaurée après mise à jour de l'app** : `user.capabilities` peut être `undefined` si le cold start précédent n'a pas encore été rejoué via `/me`. `can()` fail-close (`false`) — testé (`AuthContext.test.jsx`, "session ancienne restaurée sans capabilities"). Dès le prochain cold start (l'app relit systématiquement `/me` à chaque démarrage, voir `RBAC4_AUTH_FLOW_MATRIX.md`), les capacités à jour sont reçues.
- **Hors-ligne avec une session déjà chargée en mémoire** : aucune dégradation — `user.capabilities` reste celui reçu au dernier `/me`/login réussi tant que l'app n'est pas redémarrée. Aucune action réseau capability-gated ne peut de toute façon aboutir hors-ligne (l'appel API échouerait indépendamment de `can()`).
- **Hors-ligne au cold start (pas de connectivité pour `/me`)** : `restoreStoredSession()` échoue (timeout 5s ou erreur réseau), supprime le token stocké et retourne `null`/`revoked` — l'utilisateur est traité comme non authentifié plutôt que de recevoir une session avec des capacités par défaut. Comportement préexistant (non modifié par RBAC-4), déjà couvert par les tests "supprime un token invalide" et "session révoquée au redémarrage à froid".

## Logout / changement d'utilisateur

- `logout()` (`AuthContext.jsx:196-207`) met `user`/`token` à `null` sans exception — `can()` retourne `false` pour toute capacité immédiatement après. Testé explicitement (`AuthContext.test.jsx`, "logout efface les capacités").
- `login()`/`loginWithGoogle()` remplacent intégralement `user` par le nouvel objet reçu du backend (`setUser(user)`, jamais un merge partiel avec l'identité précédente) — aucune capacité de l'utilisateur précédent ne peut survivre à un changement de compte. Testé explicitement (`AuthContext.test.jsx`, "changement d'utilisateur (Admin déconnecté → Client reconnecté)").
- Le handler d'invalidation de session serveur (`setSessionInvalidatedHandler`, déclenché sur 401/403 structuré en cours de session) vide également `user`/`token`/`businessProfiles` — même effet sur `capabilities`, comportement préexistant non modifié.

## Systèmes spécialisés — non concernés par ce sprint

Aucun fichier lié à `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator`, tenant, ou ownership n'a été touché — ni côté backend (aucune modification), ni côté mobile (aucun écran de ces domaines n'existe actuellement sur mobile, confirmé par l'audit — voir `RBAC4_MOBILE_CAPABILITY_DEBT_MATRIX.md`). `businessProfiles` (`getEffectiveProfiles`) reste un flux strictement séparé de `capabilities`, chargé par un effet React distinct dans `AuthContext.jsx`, inchangé par ce sprint.

## Permissions backend inchangées

`git status` du sprint confirme qu'aucun fichier `server/` n'a été modifié par RBAC-4 (les fichiers `server/` listés en modifiés proviennent de RBAC-2/RBAC-3, antérieurs). Aucune règle d'autorisation backend n'a donc pu changer. Web RBAC-3 non plus (`client/` non touché par RBAC-4).
