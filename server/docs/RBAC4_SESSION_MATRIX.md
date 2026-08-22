# RBAC-4 — MATRICE DE SESSION MOBILE

| Scénario | Comportement attendu | Preuve |
|---|---|---|
| Login email frais | `user.capabilities` présent immédiatement, `can()` reflète le backend | `AuthContext.test.jsx`, "login email — capacité présente" / "capacité absente" |
| Login Google frais | `user.capabilities` présent immédiatement | `AuthContext.test.jsx`, "login Google — capacités projetées" |
| Restauration de session (cold start, `/users/me`) | `user.capabilities` reçu à jour, sans délai ni polling supplémentaire | `AuthContext.test.jsx`, "restauration de session (cold start via /users/me)" |
| Session ancienne (backend/app pas encore alignés) | `can()` fail closed, jamais un mapping rôle→capacités local | `AuthContext.test.jsx`, "session ancienne restaurée sans capabilities" |
| Capacité inconnue (jamais enregistrée backend) | `false` | `AuthContext.test.jsx`, "capacité inconnue jamais enregistrée backend" |
| Aucun utilisateur connecté | `false` pour toute capacité | `AuthContext.test.jsx`, "aucun utilisateur connecté" |
| Logout | Capacités effacées, `can()` retourne `false` pour tout | `AuthContext.test.jsx`, "logout efface les capacités" |
| Changement d'utilisateur (Admin → Client) | Aucune capacité résiduelle de l'ancien utilisateur | `AuthContext.test.jsx`, "changement d'utilisateur" |
| Offline avec session déjà chargée | `capabilities` reste celui du dernier `/me`/login réussi — aucune dégradation, aucune élévation | Analyse de code (voir `RBAC4_SECURITY_MATRIX.md`) — pas de nouveau test, mécanisme non modifié |
| Offline au cold start | Session traitée comme non authentifiée (token supprimé), pas de session avec capacités par défaut | Tests préexistants "supprime un token invalide" / "session révoquée au redémarrage à froid", non modifiés, toujours verts |
| Invalidation de session serveur en cours d'usage (403 structuré : suspendu/banni) | `user`/`token`/`capabilities` vidés, message serveur affiché | Test préexistant "un compte suspendu/banni/inactif détecté en cours de session", non modifié, toujours vert |

## Timing de propagation d'un changement de rôle

Le mobile relit `/users/me` **à chaque redémarrage à froid** de l'app (pas de cache de session au-delà du token), contrairement au Web dont le cycle de refresh Google est plafonné à 5 minutes et dont la session email/password ne se rafraîchit qu'au prochain login. Un changement de rôle (et donc de capacités effectives) en base est donc reflété côté mobile dès le prochain lancement de l'application — plus rapide que le Web dans le cas général, structurellement.

## Pas de payload dédié à mesurer

Le mandat §56 (mesure de taille de payload) concernait spécifiquement le JWT/cookie NextAuth du Web, un mécanisme qui n'existe pas côté mobile (le token mobile est un JWT opaque stocké en `SecureStore`, sans cookie ni contrainte de taille de session HTTP). Le payload `capabilities` transite uniquement dans le corps JSON des réponses `/auth/login`, `/auth/google`, `/users/me` — déjà mesuré indirectement par RBAC-3 (`RBAC3_SESSION_MATRIX.md`, même structure de payload, même fonction `getEffectiveCapabilities`). Aucune mesure supplémentaire n'était pertinente ici.
