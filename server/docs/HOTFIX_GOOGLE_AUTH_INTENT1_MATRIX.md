# HOTFIX-GOOGLE-AUTH-INTENT-1 — Matrice

| Intent | User existe | Résultat | HTTP / code | Création | Session |
|---|---:|---|---|---:|---:|
| `login` | oui | Connexion ; liaison Google historique si nécessaire | 200 | non | oui |
| `login` | non | Compte introuvable | 404 `ACCOUNT_NOT_FOUND` | non | non |
| `signup` | non | Création puis connexion | 201 | oui | oui |
| `signup` | oui | Conflit, invitation à se connecter | 409 `ACCOUNT_ALREADY_EXISTS` | non | non |
| invalide | indifférent | Requête refusée avant Google | 400 `INVALID_AUTH_INTENT` | non | non |
| absent | indifférent | Fallback Web legacy login-or-create | contrat historique | historique | historique |

## Mobile après correction

| Surface | Helper | Endpoint | Payload explicite | Erreur métier dédiée |
|---|---|---|---|---|
| Login | `signInWithGoogle` | `/auth/google` | `idToken`, `intent: login`, rôle `Client` | Message « Aucun compte… Créez d'abord votre compte. » |
| Signup | `signInWithGoogle` | `/auth/google` | `idToken`, `intent: signup`, rôle `Client` | Message « Un compte existe déjà… Connectez-vous. » |

L'annulation Google reste silencieuse. Les tokens, JWT, emails et Google subjects ne sont jamais journalisés.

## Compatibilité Web

Le fallback sans intention est volontairement temporaire et limité aux consommateurs historiques, notamment NextAuth. Il préserve le Web, mais ne sépare pas encore les boutons Web Login/Register. Une migration Web ultérieure devra transporter une intention authentifiée par le flux applicatif jusqu'au callback NextAuth, puis rendre `intent` obligatoire une fois tous les consommateurs migrés.
