# HZ-08 — Flux tenant et trust boundary

## Sources

- Identité acteur : `req.user`, issue du JWT.
- Tenant acteur : `req.platformTenant` ou `resolveTenantForUser(req.user.id, X-Platform-Tenant-Id/X-Tenant-Id)` ; le header est validé contre les tenants accessibles.
- Identité ressource : généralement `req.params.*` puis lookup DB. Les IDs liés proviennent du document chargé, pas d'un `req.body.assignedTo` sauvegardé directement.
- Tenant ressource : champ direct `tenant/platformTenant`, sinon Property.owner/Hotel.manager/createdBy/relations/OrgMembership selon `resourceType`.

## Décision

```text
resource + resourceType
  → resolveResourceTenant
    → resolved même tenant : ALLOW
    → resolved autre tenant : 404
    → ambiguous : 404
    → unresolved : ALLOW (compatibilité legacy HZ-08)
```

Un ObjectId B injecté depuis A ne permet pas l'accès si la ressource est attribuable à B. En revanche, une ressource réellement `unresolved` peut être atteinte par des acteurs de A et B si chacun franchit le RBAC et connaît l'ID. Ce n'est pas une attribution A→B : aucun tenant B n'est démontré. C'est une absence d'autorité tenant prouvable, avec risque d'accès/mutation indue au niveau métier.

Staff sans tenant : les routes utilisant `requireTenantScope` refusent en amont ; les consommateurs ad hoc varient. La variante tolérante ne crée pas elle-même une query globale : elle autorise seulement la ressource déjà chargée par ID.

