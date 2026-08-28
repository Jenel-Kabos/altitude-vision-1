# SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 — FCA1-01 : POST /api/contrats

## Root cause
`contratController.create` chargeait la `Property` cible (`req.body.bien`) et vérifiait uniquement son `status`/`availability`/`reservationLock`, sans jamais vérifier son appartenance tenant. Les routes `:id` du même fichier sont protégées par `router.param('id', …)` (TENANT-CERT-2) ; `POST /` n'a pas de `:id` et n'a donc jamais été couverte par ce garde.

## Autorité canonique réutilisée
Exactement le même mécanisme que `router.param('id', …)` de `contratRoutes.js` : `resolveTenantForUser(userId, explicitTenantId)` (lit `X-Platform-Tenant-Id`/`X-Tenant-Id`) + `assertResourceTenantOrUnattributed({resourceType: 'Property', resource: property, tenantId})`. `resourceType: 'Property'` était déjà nativement supporté par `tenantResourceAttributionService` (via `Property.owner → OrgMembership`), aucun nouveau mécanisme créé.

## Relations auditées (§8 du mandat)
Seul `req.body.bien` (Property) permet un bypass cross-tenant sur cet endpoint. `req.body.reservation` (optionnel) est déjà contraint à correspondre à `property._id` (`String(reservation.property) !== String(property._id)` → 409) — donc protégé transitivement une fois `property` vérifiée. `locataire`/`proprietaire` ne sont pas fournis à la création (documents historiques créés séparément, non exposés par ce endpoint) — aucun bypass supplémentaire identifié.

## Authority avant side effects
La vérification est insérée immédiatement après le chargement de `property` et **avant** : la comparaison `property.status`, le contrôle de réservation/disponibilité, `ensureRentalManagementActive`, `Contrat.create`, `generatePaiements`, `syncLeaseOccupation`. Aucune écriture ne peut survenir avant l'autorisation.

## Reproduction RED → GREEN
Suite permanente : `server/__tests__/contratCreateTenantAuthority.mongo.integration.test.js` (7 tests).
- **Avant fix** : 5/7 échoués (tests 2, 3, 4, 6, 7 — Admin A→Property B, Admin B→Property A, staff sans tenant, PO scoped refusé, header invalide), 2/7 passés (tests 1 et 5, chemins légitimes).
- **Après fix** : 7/7 verts.

## Side effects vérifiés sur refus (test 2)
`Contrat.findOne({bien: propertyB._id})` → aucun document. `Paiement.countDocuments({})` → 0. `Property.availability` du bien Tenant B inchangée (`Disponible`).

## Admin/PlatformOperator
- Admin A→A : autorisé (test 1). Admin A→B / B→A : refusés (tests 2, 3).
- Staff sans tenant résolu : refusé, fail-closed, pas de fallback global (test 4).
- PlatformOperator global (aucun `X-Platform-Tenant-Id`... testé avec header explicite vers A, capacité PO globale) : autorisé (test 5) — comportement historique préservé, le PO reste résolu sur le tenant explicitement sélectionné.
- PlatformOperator scoped explicitement sur A tentant B : refusé (test 6).
- En-tête tenant invalide (ObjectId inexistant) : refusé (test 7).

## Non-régression
Rejoué : `securityClosureP1WaveContratListTenantAuthority` (3/3), `securityClosureP0WaveLeaseLifecycleTenantAuthority`, `securityClosureP0WavePaiementTenantAuthority` — 4 suites, 25/25 verts au total avec la nouvelle suite.

## Statut
**FCA1-01 : CLOSED.**
