# HOTFIX-INBOX-SECURITY-1 — CONTRAT D'AUTHENTIFICATION

## Middleware `protect` — comportement canonique (non modifié, analysé)

`server/middleware/authMiddleware.js:17-64`. Source du JWT : header `Authorization: Bearer <token>`, aucune autre source (pas de cookie, pas de query param). Comportements :

| Cas | Code HTTP | `code` structuré | `req.user` défini ? |
|---|---|---|---|
| Header `Authorization` absent ou sans préfixe `Bearer` | 401 | — | Non |
| Token présent mais invalide/expiré (`jwt.verify` échoue) | 401 | — | Non |
| Token valide mais utilisateur introuvable en base | 401 | — | Non |
| `tokenVersion` du token < `tokenVersion` actuel de l'utilisateur (déconnexion globale / reset mot de passe) | 401 | `SESSION_REVOKED` | Non |
| Mot de passe changé après émission du token | 401 | `SESSION_REVOKED` | Non |
| Compte `Suspendu`/`Banni`/`isActive: false` | 403 | `ACCOUNT_SUSPENDED`/`ACCOUNT_BANNED`/`ACCOUNT_INACTIVE` | Non |
| Toutes vérifications passées | — | — | Oui, `req.user` = document Mongoose complet (sans `password`) |

Non modifié par ce hotfix — utilisé tel quel, comme partout ailleurs dans le projet.

## Contrat avant/après (mandat §39)

| Endpoint | Before | Expected | After | Authorization inchangée ? |
|---|---|---|---|---|
| GET `/api/emails` (et les 13 autres routes du fichier) | Aucune vérification — 200 pour quiconque, y compris anonyme | `protect` + `restrictTo('Admin','Secretaire','Collaborateur')` | 401 sans token/token invalide ; 403 si authentifié hors `ROLES_DOCS` ; 200/201/etc. inchangé si `ROLES_DOCS` authentifié | **Oui** — aucune règle d'autorisation fine n'existait avant (il n'y en avait aucune) ; celle introduite est la première et unique couche, dérivée de la preuve du menu frontend, pas une modification d'une règle préexistante |

**Un seul contrat pour les 14 routes** — aucune route n'a reçu de politique différente des autres (voir `HOTFIX_INBOX_SECURITY1_ENDPOINT_MATRIX.md`, toutes classées B — STAFF PRIVATE, aucune preuve d'une distinction plus fine).

## Comportement pour un utilisateur `ROLES_DOCS` déjà authentifié — inchangé, prouvé par test

`server/__tests__/emailRoutesAuth.test.js` : `Admin`, `Secretaire`, `Collaborateur` obtiennent exactement les mêmes codes de statut (200/201) qu'avant le correctif, avec le même appel au modèle `Email` sous-jacent — le seul changement observable pour ces rôles est qu'ils doivent désormais **réellement envoyer un token valide** (ce qu'ils faisaient déjà, l'intercepteur axios du frontend l'attache automatiquement) ; le comportement métier (données retournées, effets de bord) est strictement identique.
