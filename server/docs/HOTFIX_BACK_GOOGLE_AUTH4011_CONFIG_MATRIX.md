# HOTFIX-BACK-GOOGLE-AUTH-401-1 — Matrice de configuration

| Surface | Variable / claim | État | Preuve sûre |
|---|---|---|---|
| Mobile local | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Aligné | Présent, longueur 72, préfixe `872164120879-`, empreinte `39a0dddc1323` |
| Backend local | `GOOGLE_CLIENT_ID` | Aligné | Métadonnées identiques au mobile |
| Backend local | `GOOGLE_CLIENT_ID_ANDROID` | Absent | Aucun deuxième audience local injecté |
| Backend local | `GOOGLE_CLIENT_ID_IOS` | Non configuré | Filtré de la liste d'audiences |
| Backend Render | `GOOGLE_CLIENT_ID` | **NON CONFIRMÉ** | Aucun manifeste ou accès aux settings/runtime Render |
| Backend Render | `GOOGLE_CLIENT_ID_ANDROID` / `IOS` | **NON CONFIRMÉ** | Aucun accès distant |
| Token Samsung | `aud`, `azp`, `iss`, `exp`, `iat`, `email_verified` | **NON CONFIRMÉS** | Token non persisté et non journalisé |
| Code backend | Audience de `verifyIdToken` | Liste des variables non vides | Localement : une seule audience, le Web Client ID `872…` |

## Contrat de sécurité constaté

`google-auth-library` valide la signature, l'audience, l'issuer et la temporalité lors de `verifyIdToken()`. Le contrôleur exige ensuite explicitement `email_verified === true`. Aucune relaxation, décodage non vérifié ou acceptation d'audience arbitraire n'a été introduit.

## Action manuelle Render requise

Dans le service Render réellement servi par `altitude-vision.onrender.com`, comparer `GOOGLE_CLIENT_ID` à la valeur Web OAuth Altitude Vision détenue dans la source sécurisée : préfixe `872164120879-`, longueur 72, empreinte courte `39a0dddc1323`. Si elle diffère, la remplacer, supprimer toute ancienne audience `3869205293-…` non nécessaire, enregistrer puis redémarrer/redéployer le service. Ne pas copier l'identifiant complet dans un ticket ou un log.
