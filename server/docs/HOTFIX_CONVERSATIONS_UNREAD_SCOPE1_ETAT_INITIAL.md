# HOTFIX-CONVERSATIONS-UNREAD-SCOPE-1 — État initial

## Baseline

- Date : 2026-08-21
- Branche : `main`
- HEAD : `15506a7b113742ad266cc5977ff06164b6c04994`
- Worktree déjà modifié par PAY-5/PAY-6/PAY-6.1, conservé sans reset.
- `git diff --check` initial : vert.

## Reproduction avant correction

Commande ciblée : `platformAdmin1.adversarial.mongo.integration.test.js`.

- 24 tests verts, 1 rouge.
- Acteur : User `Admin` reconnu comme Platform Operator actif, aucune `OrgMembership`, aucun en-tête `X-Platform-Tenant-Id`.
- Requête : `GET /api/conversations/count/unread`.
- Reçu : HTTP 200.
- Attendu : HTTP 403, `PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED`.

## Traçage et cause

La route statique `/count/unread` est correctement déclarée avant `/:conversationId`; aucune collision Express. Le routeur monte globalement `protect` puis `attachTenantContext`, volontairement non bloquant pour préserver les clients ordinaires sans tenant. Contrairement aux autres domaines tenant-scoped, le compteur n'avait ensuite aucun garde actor-aware.

Le contrôleur était donc atteint. Sans tenant actif, sa première requête comptait les messages personnels sans filtre tenant. Pour tout rôle `ALL_STAFF`, sa seconde requête utilisait `tenantConversationFilter(req) = {}` et pouvait compter toutes les conversations staff-inbox non lues, tous tenants confondus, plus les conversations non attribuées. Le 200 était donc une fuite potentielle de count cross-tenant, pas seulement un mauvais statut.

## Contraintes retenues

- Ne pas remettre `requireTenantScope` globalement sur Conversations : cela rebloquerait les clients POST-E2E.
- Réutiliser le garde canonique et son code métier.
- Appliquer le garde uniquement au compteur, pour les rôles staff et Platform Operators.
- Conserver les clients et Proprietaires sans tenant sur leur filtre identitaire.
