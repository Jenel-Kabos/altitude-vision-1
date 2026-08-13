# DATA-RESET-CERT-1 — Audit

Date: 2026-08-13  
Mode: lecture seule, arrêt P0  
Verdict: **PARTIALLY CERTIFIED — PASSWORD ROTATION REQUIRED**

## Périmètre exécuté

- Le worktree existant a été inspecté et préservé (`git status --short`, `git diff --stat`, `git diff --check`).
- Les livrables DATA-RESET-1 et le rapport technique ont été consultés comme baseline.
- Le modèle et les routes d'authentification ont été inspectés.
- Une lecture MongoDB ciblée du compte Admin a été faite avec une projection excluant strictement le mot de passe et son hash.

## Contrôle P0 — mot de passe compromis

Résultat lu sur le compte Admin bootstrap :

- `role`: `Admin`;
- `status`: `Actif`;
- `tokenVersion`: `0`;
- `passwordChangedAt`: absent;
- `createdAt`: `2026-08-13T15:27:09.371Z`;
- `updatedAt`: `2026-08-13T15:27:09.371Z`.

Ces éléments ne prouvent aucune rotation depuis la création du compte et montrent qu'aucune invalidation de session par le mécanisme de reset n'a eu lieu. Le mot de passe bootstrap exposé doit donc toujours être considéré compromis.

## Mécanisme canonique identifié

L'application fournit déjà deux parcours :

- changement authentifié : `PATCH /api/auth/update-my-password`;
- récupération Web : `/forgot-password`, puis `PATCH /api/auth/reset-password/:token`.

Le reset canonique met à jour le mot de passe via Mongoose, renseigne `passwordChangedAt`, efface le jeton de reset et incrémente `tokenVersion`. Aucun nouveau mécanisme n'est requis.

## Décision d'arrêt

Conformément aux sections 6–8, 61 et 67 de la mission, la certification est arrêtée avant tout autre gate. Aucun login avec le secret compromis, aucun test fonctionnel, aucun test Mongo, aucun build et aucune modification de donnée n'ont été exécutés.

## Opérations et sécurité

- Écritures MongoDB : aucune.
- Données métier créées/restaurées : aucune.
- Appels ou nettoyage Cloudinary : aucun.
- Email déclenché par Codex : aucun.
- Secret, hash ou jeton affiché dans ce rapport : aucun.
- Commit, push, deploy : aucun.

## Action humaine requise

Le propriétaire doit choisir un nouveau mot de passe dans l'interface normale, de préférence par le parcours **Mot de passe oublié**, sans communiquer le nouveau secret à Codex. Après confirmation humaine, DATA-RESET-CERT-1 pourra reprendre par une vérification en lecture seule de `passwordChangedAt` et `tokenVersion`, puis poursuivre les gates restants.
