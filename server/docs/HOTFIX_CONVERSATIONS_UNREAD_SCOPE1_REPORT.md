# HOTFIX-CONVERSATIONS-UNREAD-SCOPE-1 — Rapport final

## Correction

`createRequireTenantScope` accepte désormais un prédicat `requireWhen`, sans modifier son comportement par défaut. La variante `requireTenantScopeForStaffOrPlatformOperator` réutilise ce garde canonique mais ne l'exige que pour `ALL_STAFF` ou un Platform Operator reconnu. Elle est montée uniquement sur `GET /conversations/count/unread`, après l'authentification et avant le contrôleur.

Aucun schéma, contrôleur Conversation, modèle Message, Socket.IO, notification, frontend ou mobile n'a été modifié.

## Réponses obligatoires

1. Le 200 provenait du middleware global non bloquant, sans garde ciblé ensuite.
2. Oui, le contrôleur était atteint.
3. Il manquait un `requireTenantScope` actor-aware sur `/count/unread`; l'ordre statique/dynamique était correct.
4. Pour le staff non scopé, la branche staff-inbox était globale ; la branche messages restait bornée au receiver.
5. Oui, un count staff-inbox cross-tenant était potentiellement observable.
6. Le factory canonique `createRequireTenantScope` et son signal d'erreur sont réutilisés.
7. Oui, Platform Operator sans tenant retourne désormais 403.
8. Oui, code exact `PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED`.
9. Oui, opérateur avec tenant A fonctionne et ne compte pas B.
10. Oui, staff mono-tenant fonctionne et ne compte pas B.
11. Oui, client ordinaire fonctionne sans tenant.
12. Oui, Proprietaire reste isolé par son identité.
13. Oui, les conversations unattributed légitimes restent vertes.
14. Oui, isolation du count cross-tenant prouvée avec Tenant A/B.
15. Oui pour les frontières : staff scopé partage `tenantConversationFilter`; client reste participant/receiver-scoped.
16. Oui, les tests Conversations/POST-E2E disponibles sont verts.
17. Oui, aucun frontend touché.
18. Non au sens strict : les 126 suites unitaires sont vertes (1 447/1 447), mais le runner Mongo partagé termine à 93/94 suites et 937/938 tests. Son unique échec, hors Conversations, est un conflit `Litige.reference = null` dans `tenantAttributionLegacyExtension`; cette suite repasse isolément à 14/14.
19. Non, pas encore au sens du gate exhaustif demandé. L'échec Conversations qui fondait la réserve a disparu, mais la commande Mongo exhaustive conserve un exit code 1 hors périmètre. PAY-6.1 n'a pas été modifié.
20. Production : `middleware/tenantContext.js`, `routes/conversationRoutes.js`.
21. Tests enrichis : `platformAdmin1.adversarial.mongo.integration.test.js`, `conversationRoutes.test.js`.
22. Voir section Gates.
23. Aucun add/commit/push/deploy/reset.
24. Verdict : GO SOUS RÉSERVE, non certifié vert uniquement à cause du gate Mongo exhaustif non entièrement vert.

## Gates finaux

- Avant fix : 24/25, scénario historique rouge avec 200.
- Après fix : Platform Admin + Conversations + unattributed, 41/41 verts.
- Notifications, Socket et runtime tenant sélectionnés : 45/45 verts.
- Suite unitaire serveur exhaustive : 126/126 suites, 1 447/1 447 tests verts.
- Mongo exhaustif partagé : 93/94 suites, 937/938 tests ; unique échec hors périmètre sur l'index `Litige.reference`, puis 14/14 vert en relance isolée.
- Lint serveur : vert, 0 erreur et 106 avertissements préexistants.
- `git diff --check` : vert.

## Verdict

**HOTFIX-CONVERSATIONS-UNREAD-SCOPE-1 : GO SOUS RÉSERVE — NON CERTIFIÉ VERT.**

Le défaut demandé est corrigé et sa matrice de sécurité est verte. La certification stricte imposait toutefois un run Mongo exhaustif avec exit code 0 ; ce gate reste rouge pour un conflit d'index hors périmètre et non reproductible en isolation. Aucun élargissement du correctif Conversations n'a été tenté pour masquer ce défaut indépendant.

### Suivi MICRO-HOTFIX-LITIGE-REFERENCE-INDEX-1

Le conflit `Litige.reference = null` est désormais corrigé par un index unique partiel et couvert par un test Mongo réel. Le runner exhaustif relancé conserve néanmoins un exit code 1 dont le dernier échec n'a pas pu être identifié dans la sortie terminal tronquée. Le verdict global reste donc inchangé, tandis que les gates Conversations ciblés restent verts.

### Re-certification finale — 2026-08-21

**CERTIFIÉ VERT.** Le runner Mongo capturé intégralement passe à 95/95 suites et 939/939 tests. Deux répétitions ciblées Litige/attribution/Conversations passent chacune à 5/5 suites et 56/56 tests. La réserve externe liée au runner est levée ; le correctif Conversations reste inchangé.
