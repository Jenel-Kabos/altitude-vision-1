# RBAC-3 — MATRICE DE SESSION

## Scénarios testés

| Scénario | Comportement attendu | Preuve |
|---|---|---|
| Connexion email/password | `capabilities` présent immédiatement dans `data.user` retourné par `/users/login` | `authController.test` suite existante (43/43 verts après ajout du champ), flux tracé jusqu'à `AuthContext.login()` qui stocke `userData` verbatim |
| Connexion Google (signIn déjà résolu) | `token.capabilities` peuplé sans second appel réseau | `nextauthJwtCallback.test.js`, test 1 |
| Connexion Google (fallback fetch) | `token.capabilities` peuplé depuis la réponse de `/auth/google-token` | `nextauthJwtCallback.test.js`, test 2 |
| Refresh périodique (> 5 min), succès | `token.capabilities` remplacé par la valeur fraîche du backend | `nextauthJwtCallback.test.js`, tests 3 et 5 |
| Refresh périodique, dans la fenêtre de cache | `token.capabilities` inchangé, aucun appel réseau | `nextauthJwtCallback.test.js`, test 4 |
| Refresh périodique, échec réseau | `token.capabilities` **conservé** (ancienne valeur), jamais vidé ni remplacé par un mapping local | `nextauthJwtCallback.test.js`, test 7 |
| Projection session React | `session.user.capabilities` reflète `token.capabilities` | `nextauthJwtCallback.test.js`, tests session (nouveaux) |
| `token.capabilities` absent (session très ancienne, avant même l'ajout du champ) | Projection en tableau vide, jamais un fallback basé sur le rôle | `nextauthJwtCallback.test.js`, test session 2 |
| Restauration après reload (localStorage) | `user.capabilities` restauré tel que stocké au dernier login/refresh | `AuthContextCan.test.jsx`, tests 1-3 |
| Session locale pré-RBAC-3 (`capabilities` absent) | `can()` fail-closed immédiatement, puis auto-guérison via `/me` dans le même mount | `AuthContextCan.test.jsx`, test "auto-guérison" |
| Échec réseau pendant l'auto-guérison | Reste fail-closed, pas de boucle infinie (l'effet ne se redéclenche pas car il dépend de `user`, inchangé après l'échec) | `AuthContextCan.test.jsx`, test "échec réseau" |
| Aucun utilisateur connecté | `can()` retourne `false` pour toute capacité | `AuthContextCan.test.jsx`, test "aucun utilisateur" |

## Logout / changement d'utilisateur (adversarial — analyse, non re-testé par du code nouveau)

- `AuthContext.logout()` vide `localStorage` (`user`, `token`, `platformOperatorTenantSelection`, `platformOperatorTenantId`), met `user` à `null`, positionne `loggedOutRef.current = true`, puis appelle `signOut({ redirect: false })` (NextAuth). Le `user` étant `null`, `can()` retourne `false` pour tout — aucune capacité résiduelle possible après un `logout()` explicite.
- `loggedOutRef` bloque la resynchronisation Google tant que la session NextAuth n'a pas fini de se fermer côté cookie — empêche qu'un `googleUser` (avec d'anciennes `capabilities`) ne réapparaisse juste après un logout volontaire. Ce garde-fou préexistant (avant RBAC-3) reste inchangé et s'applique identiquement au nouveau champ `capabilities`.
- Changement d'utilisateur (Admin déconnecté → Client reconnecté) : `login()` réécrit intégralement `localStorage.user` avec les données du **nouvel** utilisateur (incluant son propre `capabilities`) — aucun champ de l'ancien utilisateur n'est fusionné (`login` ne fait pas de merge partiel, contrairement à `updateUser`). Pas de résidu possible.
- Ce comportement n'a pas nécessité de nouveau test dédié : il découle directement du fait que `capabilities` est un champ ordinaire de l'objet `user`, traité par les mêmes mécanismes (`login`, `logout`, `updateUser`) qui gérayent déjà `role`/`_id`/etc. sans réinitialisation particulière avant RBAC-3.

## Timing de propagation d'un changement de rôle

- Email/password : un changement de rôle en base n'est reflété côté client qu'au prochain `login()` (reconnexion) ou `updateUser()` explicite — aucun mécanisme de refresh périodique pour ce flux (comportement préexistant, non modifié par RBAC-3 ; `capabilities` suit la même règle que `role`).
- Google/NextAuth : reflété au plus tard 5 minutes après le changement, via le refresh périodique déjà existant (`roleCheckedAt`) — désormais `capabilities` est recalculé dans la même fenêtre que `role` (même appel réseau, `getEffectiveCapabilities` étant une fonction pure du rôle).

## Mesure de taille de payload (mandat §56)

Mesuré avec `jsonwebtoken` (dépendance déjà présente côté serveur), signature d'un payload JWT représentatif avant/après ajout de `capabilities` :

| Cas | Taille JWT (base64) | Delta |
|---|---|---|
| Sans `capabilities` | 653 octets | — |
| Avec `capabilities` (GestionnaireImmobilier, 19 capacités) | 1099 octets | +446 octets |
| Avec `capabilities` (pire cas, 32 capacités — équivalent Admin non-wildcard) | 1644 octets | +991 octets |

Décision : delta maximal ~1 Ko, largement sous la limite de 4 Ko par cookie. **Pas besoin de bascule vers `/me`** pour la charge de session NextAuth — la mesure confirme que l'ajout reste négligeable même dans le pire cas. `/me` reste néanmoins le point d'exposition pour l'auto-guérison (mandat §21), un usage différent et ponctuel, pas periodique.
