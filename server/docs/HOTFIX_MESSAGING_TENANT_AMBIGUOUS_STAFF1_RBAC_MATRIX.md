# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Matrice RBAC (preuve d'absence de changement)

| Rôle | Capacité avant | Capacité après | Changé ? |
|---|---|---|---|
| Admin (tout sous-rôle `ALL_STAFF`) | Accès staff-inbox, detail, delete, send, mark-read dans **son** tenant résolu | Identique — la garde ajoutée ne bloque que si le tenant n'est PAS résolu, jamais un tenant valide | **NON** |
| Collaborateur (tout sous-rôle staff) | Idem Admin | Idem Admin | **NON** |
| PlatformOperator scopé (tenant explicitement sélectionné) | Accès au tenant sélectionné | Identique | **NON** |
| PlatformOperator non scopé (aucune sélection) | Avant : accès de facto à TOUT tenant (c'est HF-FINAL-01) — jamais un comportement RBAC "documenté" comme voulu | Après : doit sélectionner un tenant (403 sinon), même contrat que `/count/unread` | **Correction de sécurité, pas un changement RBAC** — aucune capacité *documentée/voulue* n'est retirée, seul un accès non intentionnel (bug) est fermé |
| Client | Accès à ses propres conversations (participant) | Identique — la garde ajoutée est un no-op total pour ce rôle (`requireWhen` renvoie `false`) | **NON** |
| Proprietaire | Idem Client | Idem Client | **NON** |

## Preuve directe (tests)

`messagingTenantAmbiguousStaff.mongo.integration.test.js` : "client participant peut toujours lire sa propre conversation staff-inbox" et "client peut toujours lister my-inbox sans en-tête tenant" — verts après correctif, prouvant qu'aucune capacité client n'a été retirée.

## Conclusion

**RBAC AVANT = RBAC APRÈS**, au sens des permissions documentées/voulues. Le seul comportement supprimé est un accès cross-tenant non intentionnel (le bug lui-même), jamais une permission légitime.
