# HOTFIX-AUTH-POSTLOGIN-ROUTING-1 — MATRICE DES RÉSOLVEURS (AVANT CORRECTION)

## Les deux résolveurs réellement trouvés (pas trois)

L'audit exhaustif (`router.push(`, `router.replace(`, `redirect(`, `callbackUrl`, `getPostAuthDestination`, `role === 'Proprietaire'`, etc., dans tout `client/`, plus inspection de `AuthContext.jsx`, `ProtectedRoute.jsx`, `RoleProtectedRoute.jsx`, la config NextAuth) trouve **exactement 2 fonctions de résolution de destination**, pas 3 comme le supposait RBAC-1 :

1. **`getPostAuthDestination(user)`** — `client/lib/navigation/postAuthDestination.js:3-8`. Résolveur dominant, déjà consommé par 3 flows de production (`LoginPage.jsx:45`, `RegisterPage.jsx:84`, `VerifyEmailPage.jsx:28`) + en interne par `OwnerContextLanding.jsx:21` (garde défensive).
2. **`getTargetPath(role)`** — `client/app/auth/google-redirect/page.jsx:10-15`. Fonction locale, non exportée, dupliquant la même intention avec une logique différente, seul point d'entrée post-login Google (hors redirection explicite `?redirect=`).

Le "troisième resolver" que RBAC-1/RBAC-3 semblaient évoquer est en réalité `resolveOwnerDestination(profiles)` (`client/lib/navigation/ownerContext.js:13-18`) — ce n'est **pas** un résolveur post-login concurrent, mais une **étape en aval** de `getPostAuthDestination` : quand celui-ci renvoie `/mon-espace-proprietaire`, la page `OwnerContextLanding.jsx` y consomme `resolveOwnerDestination(businessProfiles)` pour affiner vers `/mes-biens`, `/mes-hotels`, ou un écran de choix. C'est un second niveau de résolution, pas un troisième résolveur indépendant de premier niveau.

## Matrice avant correction

| Flow | Resolver | Admin/Staff | Proprietaire | Client | Legacy (User/Prestataire) |
|---|---|---|---|---|---|
| Login email | `getPostAuthDestination` (`LoginPage.jsx:45`) | `/dashboard` | `/mon-espace-proprietaire` → (`resolveOwnerDestination`) `/mes-biens` ou `/mes-hotels` ou chooser | `/mon-espace` | `/` (fallback générique, aucune branche dédiée) |
| Signup email (déjà authentifié en revenant sur `/register`) | `getPostAuthDestination` (`RegisterPage.jsx:84`) | `/dashboard` | idem | `/mon-espace` | `/` |
| Vérification email (`/verify-email/:token`) | `getPostAuthDestination` (`VerifyEmailPage.jsx:28`) | `/dashboard` | idem | `/mon-espace` | `/` |
| **Login/Signup Google** | **`getTargetPath` local, `google-redirect/page.jsx:10-15`** | `/dashboard` | **`/mes-biens` (hardcodé, jamais `/mon-espace-proprietaire`, jamais `resolveOwnerDestination`, jamais `/mes-hotels`, jamais le chooser multi-profil)** | **`/altimmo/annonces` (jamais `/mon-espace`)** | **`/altimmo/annonces` (jamais `/`)** |
| Session déjà active visitant `/login` | Aucun — pas de redirection automatique constatée | — | — | — | — |
| Session déjà active visitant `/register` | `getPostAuthDestination` (`RegisterPage.jsx:82-85`, garde `useEffect`) | `/dashboard` | idem | `/mon-espace` | `/` |
| Route protégée sans session (`ProtectedRoute.jsx:18`) | N/A — pas un resolver de destination, un guard d'authentification | `/login` pour tous | `/login` | `/login` | `/login` |

## Note sur `/login` sans redirection automatique

`LoginPage.jsx:24` porte un commentaire `// 🔴 Redirection à l'ouverture gérée par PublicAuthRoute.jsx` — **ce composant n'existe plus dans le dépôt** (grep exhaustif : aucun fichier `PublicAuthRoute.jsx`, aucune autre référence que ce commentaire). Aujourd'hui, un utilisateur déjà connecté qui visite `/login` voit simplement le formulaire, sans redirection automatique. C'est un commentaire obsolète pointant vers du code disparu — documenté ici comme demandé par le mandat §26, mais **non corrigé** dans ce hotfix : ce n'est pas la divergence Proprietaire visée, et forcer une redirection pourrait interférer avec un changement de compte volontaire (mandat §41 exige justement que `/login` reste utilisable pour un changement d'utilisateur).

## Cause exacte du drift Proprietaire

`google-redirect/page.jsx` réimplémente sa propre fonction `getTargetPath` au lieu de réutiliser `getPostAuthDestination`, avec deux différences : (1) Proprietaire est envoyé directement vers `/mes-biens`, court-circuitant complètement le mécanisme `businessProfiles`/`resolveOwnerDestination`/chooser multi-profil ; (2) Client et rôles legacy sont envoyés vers `/altimmo/annonces` au lieu de `/mon-espace`/`/`.
