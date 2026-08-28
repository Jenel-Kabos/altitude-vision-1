# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Flux tenant avant/après

## AVANT

```
staff (multi-tenant OU sans adhésion)
  → auth.protect (OK, JWT valide)
  → attachTenantContext (résout req.platformTenant → null, ne bloque jamais)
  → restrictTo(...ALL_STAFF) sur /staff-inbox (OK, rôle staff valide)
  → contrôleur exécuté :
      tenantConversationFilter(req) → activeTenantId(req) undefined → {} (aucun filtre)
      OU assertConversationAccess : if(activeTenantId) skip → isStaff seul suffit
  → accès accordé à TOUTES les conversations de TOUS les tenants
```

## APRÈS

```
staff (multi-tenant OU sans adhésion)
  → auth.protect (OK)
  → attachTenantContext (résout req.platformTenant → null, ne bloque jamais — inchangé)
  → restrictTo(...ALL_STAFF) sur /staff-inbox (OK — inchangé)
  → requireTenantScopeForStaffOrPlatformOperator (NOUVEAU sur ces routes) :
      resolveAndAttachTenantScope → resolved:false
      requireWhen({isStaff:true}) → true → garde active
      !resolved && !unscopedOperatorAllowed → res.status(403) puis next(TenantContextError)
  → contrôleur JAMAIS atteint
  → 403 "Contexte tenant ambigu : sélectionnez explicitement un tenant accessible."
```

## Cas non affectés (comportement historique préservé, flux inchangé)

```
client (jamais de PlatformTenant propre par design)
  → auth.protect (OK)
  → attachTenantContext (req.platformTenant reste toujours null pour ce rôle — inchangé)
  → requireTenantScopeForStaffOrPlatformOperator (NOUVEAU, mais requireWhen→false pour ce rôle)
      → next() immédiat, AUCUN effet
  → contrôleur exécuté normalement, borné par participants:req.user.id (inchangé)
```

```
staff mono-tenant (cas normal, majoritaire)
  → auth.protect (OK)
  → attachTenantContext (req.platformTenant → Tenant A résolu automatiquement, single_membership)
  → requireTenantScopeForStaffOrPlatformOperator (NOUVEAU) → resolved:true → next() immédiat
  → contrôleur exécuté normalement, filtré sur Tenant A (comportement inchangé)
```

```
staff multi-tenant + en-tête X-Platform-Tenant-Id explicite
  → resolveEffectiveTenantContext(userId, tenantIdDemandé) → tenant trouvé dans les memberships → resolved:true
  → requireTenantScopeForStaffOrPlatformOperator → next() immédiat
  → contrôleur exécuté, filtré sur le tenant sélectionné uniquement
```
