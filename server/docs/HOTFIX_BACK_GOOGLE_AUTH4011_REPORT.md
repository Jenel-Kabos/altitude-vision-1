# HOTFIX-BACK-GOOGLE-AUTH-401-1 — Rapport final

## Verdict

**GO SOUS RÉSERVES — NON CERTIFIÉ VERT.**

Le contrat backend local est correct et sécurisé, mais la cause exacte du 401 de production ne peut pas être certifiée avec les preuves disponibles. La valeur effective Render et les claims du token de l'essai Samsung ne sont pas accessibles. Aucun changement de production, commit, push ou déploiement n'a été effectué.

## Diagnostic établi

Chaîne exacte : `POST /api/auth/google` → `googleLimiter` → `authController.googleToken` → `OAuth2Client.verifyIdToken({ idToken, audience })` → `ticket.getPayload()` → contrôle `email_verified === true` → recherche/liaison/création utilisateur → émission du JWT Altimmo.

Le 401 observé est nécessairement antérieur à la logique utilisateur et provient de l'une de ces branches :

1. `verifyIdToken()` rejette signature, audience, issuer, expiration ou format ; réponse `Token Google invalide.`
2. La vérification cryptographique réussit mais `email_verified !== true` ; réponse `Email Google non vérifié.`

La trace mobile ne contient que le statut HTTP, pas le message de réponse. Elle ne permet donc pas de distinguer les deux. L'audience obsolète sur Render reste l'explication principale : elle est cohérente avec le passage récent de `3869205293-…` à `872164120879-…`, mais demeure **NON PROUVÉE**.

## Configuration et sécurité

- Backend local et mobile local : même Web Client ID masqué, longueur 72, préfixe `872164120879-`, empreinte courte `39a0dddc1323`.
- Render : valeur runtime **NON CONFIRMÉE** ; aucun `render.yaml`, CLI, credential ou log Render disponible.
- Claims réels `aud`, `azp`, `iss`, `exp`, `iat`, `email_verified` : **NON CONFIRMÉS**, car le token n'a pas été persisté ou exposé.
- Aucune audience arbitraire, validation affaiblie, valeur codée en dur dans le code de production ou journalisation sensible ajoutée.
- Le même Web Client ID est utilisé par le flux web NextAuth local ; aucune preuve ne justifie l'ajout d'un ancien client Android dans les audiences acceptées.

## Tests ajoutés

Le test ciblé couvre sept cas : ticket valide pour l'audience configurée, mauvais audience, mauvais issuer, token expiré, token malformé, email non vérifié et token absent. Les rejets Google conduisent exactement au 401 du contrôleur et n'atteignent pas la recherche utilisateur.

| Gate | Résultat |
|---|---|
| Tests ciblés Google | 7/7 verts |
| Tests unitaires backend complets | 1432/1432 verts, 125 suites |
| Lint backend | Vert, 0 erreur ; 106 avertissements préexistants |
| `git diff --check` | Vert |
| Code backend de production | Inchangé |
| Validation Render + Samsung | Bloquée par l'absence d'accès à la configuration Render |

La première exécution complète a été empêchée par la sandbox (`listen EPERM` pour Supertest). La relance autorisée hors sandbox a terminé avec 1432 tests verts.

## Action nécessaire pour lever la réserve

1. Dans le service Render de `altitude-vision.onrender.com`, vérifier que `GOOGLE_CLIENT_ID` correspond au Web Client ID Altitude Vision : préfixe `872164120879-`, longueur 72, empreinte courte `39a0dddc1323`.
2. Si la valeur est ancienne ou différente, la remplacer depuis la source sécurisée et retirer toute audience legacy `3869205293-…` devenue inutile.
3. Enregistrer puis redémarrer/redéployer le service Render.
4. Refaire Login et Signup Google sur le Samsung et relever uniquement : statut, branche/message sûr, métadonnées masquées de l'audience et résultat de session/navigation.
5. Si le 401 persiste, capturer côté backend, sans token ni donnée personnelle, `error.name`, `error.message`, audience attendue masquée, longueur du token et claims diagnostics non sensibles. Cela permettra de départager audience, issuer, expiration et `email_verified`.

Le verdict ne pourra devenir **CERTIFIÉ VERT** qu'après réponse 200/201 du backend de production, création/récupération de session Altimmo et navigation finale réussie sur le Samsung.
