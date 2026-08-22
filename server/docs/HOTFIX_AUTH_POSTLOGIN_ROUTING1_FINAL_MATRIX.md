# HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — MATRICE FINALE (APRÈS CORRECTION)

| Role | Email login | Google login | Signup email (déjà authentifié) | Restore/`/register` re-visite | Canonical |
|---|---|---|---|---|---|
| Admin | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` |
| Collaborateur | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` |
| Secretaire | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` |
| GestionnaireImmobilier | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` |
| CommunityManager | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` |
| Communicant | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` | `/dashboard` |
| Proprietaire | `/mon-espace-proprietaire` → `resolveOwnerDestination` (`/mes-biens`, `/mes-hotels`, ou chooser) | **`/mon-espace-proprietaire` → `resolveOwnerDestination` (identique, corrigé)** | `/mon-espace-proprietaire` → idem | `/mon-espace-proprietaire` → idem | `/mon-espace-proprietaire` (résolveur canonique, puis second niveau) |
| Client | `/mon-espace` | **`/mon-espace` (identique, corrigé)** | `/mon-espace` | `/mon-espace` | `/mon-espace` |
| User | `/` | **`/` (identique, corrigé)** | `/` | `/` | `/` |
| Prestataire | `/` | **`/` (identique, corrigé)** | `/` | `/` | `/` |
| Rôle inconnu/absent | `/` | `/` | `/` | `/` | `/` |

**Toutes les colonnes convergent désormais vers la même destination canonique pour un même rôle, indépendamment du flow d'authentification** — les cases en gras marquent ce qui a changé (uniquement le flow Google, seul point de divergence identifié).

## Cas particuliers vérifiés

- Nouveau compte Google (`isNewUser: true`) : toujours `/completer-profil` avant toute résolution de destination — comportement préexistant, non affecté par ce hotfix.
- Session non authentifiée sur `/auth/google-redirect` : `/login` — inchangé.
- `/login` visité par une session déjà active : aucune redirection automatique aujourd'hui (commentaire obsolète référençant un composant `PublicAuthRoute.jsx` disparu) — documenté, non corrigé (mandat : ne pas toucher au comportement de changement de compte volontaire).
