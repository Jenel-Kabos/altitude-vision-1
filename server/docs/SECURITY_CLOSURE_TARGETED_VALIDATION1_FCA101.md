# SECURITY-CLOSURE-TARGETED-VALIDATION-1 — FCA1-01 (POST /api/contrats)

## Vérification statique (code actuel)
- Route : `POST /api/contrats` → `manageLeases` (`auth.protect` + `requireCapability('leases.manage')`) → `contratController.create` (`routes/contratRoutes.js:59`, inchangée).
- Guard : `assertPropertyTenantAccess(req, property)` (`controllers/contratController.js:24-28`) — appelle `resolveTenantForUser(req.user._id || req.user.id, explicitTenantId)` puis `assertResourceTenantOrUnattributed({resourceType: 'Property', resource: property, tenantId})`.
- Position : appelé immédiatement après `Property.findById` (ligne ~78), **avant** la comparaison `property.status`, la vérification de réservation/disponibilité, `ensureRentalManagementActive`, `Contrat.create`, `generatePaiements`, `syncLeaseOccupation`. Confirmé par lecture directe du fichier.
- `contratRoutes.js` : inchangée par rapport à la baseline hotfix — `router.param('id', …)` toujours en place pour les routes `:id`, `POST /` reste sans `:id` (le fix vit entièrement dans le contrôleur, cohérent avec le design du hotfix).

## Rejeu de la suite permanente
`contratCreateTenantAuthority.mongo.integration.test.js` : **7/7 PASS** (exécution indépendante de cette validation).
- Admin/staff A → Property A : autorisé (test 1).
- Admin/staff A → Property B : refusé (test 2).
- Symétrie B→A : refusée (test 3).
- Staff sans tenant : refusé, fail-closed (test 4).
- PlatformOperator global : autorisé (test 5).
- PlatformOperator scoped A → Property B : refusé (test 6).
- En-tête tenant invalide : refusé (test 7).

## Side effects (via la suite permanente, aucun nouveau test créé)
Cross-tenant refusé (test 2) : 0 `Contrat` créé, 0 `Paiement`/échéancier créé, `Property.availability` inchangée.

## Statut
**FCA1-01 : CLOSED — confirmé par cette validation indépendante.**
