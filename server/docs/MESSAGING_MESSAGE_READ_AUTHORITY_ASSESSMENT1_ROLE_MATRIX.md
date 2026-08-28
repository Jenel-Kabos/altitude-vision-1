# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Matrice des rôles

| Rôle | Peut appeler l'endpoint (auth) ? | Lecture obtenue sur une conversation SANS lien (état actuel) | Preuve |
|---|---|---|---|
| Unauthenticated | Non — 401 (`protect`) | N/A | Mécanisme d'auth existant, inchangé |
| Client | Oui | **Oui — reproduit en conditions réelles** | Client A a lu la conversation privée 1-1 de Client B/C, contenu complet retourné |
| Proprietaire | Oui | Oui (même mécanisme que Client — aucune vérification spécifique au rôle Proprietaire n'existe dans `getMessages`) | Par lecture de code — même chemin exact que Client, `req.platformTenant` toujours `undefined` pour ce rôle |
| Staff autorisé (Admin/Collaborateur/etc., `ALL_STAFF`) — même tenant, non-participant | Oui | **Oui — reproduit en conditions réelles**, y compris sur une conversation privée 1-à-1 d'un AUTRE staff, pas seulement la boîte partagée | Staff A a lu la conversation privée de Staff B avec un client tiers |
| Staff — tenant différent | Oui (auth) mais bloqué par la garde suivante | **Non — bloqué (403)** | HF-FINAL-01, `requireTenantScopeForStaffOrPlatformOperator` + `assertResourceTenantOrUnattributed` (tenant réellement résolu et différent) |
| Staff — sans tenant résolu (ambigu ou sans adhésion) | Oui (auth) mais bloqué par la garde suivante | **Non — bloqué (403)** | HF-FINAL-01 |
| PlatformOperator global | Oui | Oui, sur toute conversation dont le tenant est déjà résolu ou non-attribué (non testé explicitement ce sprint, déduit du même chemin de code que le staff — pas de vérification participant) | Déduction directe du code, cohérente avec le comportement staff déjà reproduit |
| PlatformOperator scopé A | Oui | Oui sur toute conversation de tenant A, sans vérification participant | Idem |

## Constat central

**Seule la dimension tenant est protégée** (grâce à HF-FINAL-01). Aucune dimension participant/ownership/staff-authority n'est vérifiée pour aucun rôle sur cet endpoint précis — la fuite touche indifféremment Client, Proprietaire, et staff (au-delà même de l'autorité "boîte partagée" que le staff possède légitimement ailleurs dans le code).
