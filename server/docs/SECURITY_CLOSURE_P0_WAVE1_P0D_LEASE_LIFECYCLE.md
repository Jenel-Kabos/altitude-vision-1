# P0-D — Rental Lease Lifecycle (RA-05)

## Inventaire exact des routes concernées (`server/routes/rentalLeaseLifecycleRoutes.js`)

| Méthode | Route | Handler | Mutation | Garde avant correctif |
|---|---|---|---|---|
| GET | `/:id/available-transitions` | `availableTransitions` | Non (lecture) | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/transition` | `transition` | Oui — change `Contrat.cycleVie/statut` | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/renew/preview` | `previewRenew` | Non (aperçu) | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/renew` | `renew` | Oui — renouvelle le bail | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/avenants` | `addAvenant` | Oui — ajoute un avenant | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/caution/encaisser` | `encaisserCaution` | Oui — mouvement financier | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/caution/bloquer` | `bloquerCaution` | Oui — mouvement financier | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/caution/retenue` | `appliquerRetenueCaution` | Oui — mouvement financier | `restrictTo(STAFF_IMMO)` seul |
| POST | `/:id/caution/restituer` | `restituerCaution` | Oui — mouvement financier | `restrictTo(STAFF_IMMO)` seul |
| GET | `/dashboard` | `dashboard` | Non (agrégat, sans `:id`) | `restrictTo(STAFF_IMMO)` seul — hors périmètre RA-05 (non cité par le re-audit, non touché) |

Toutes les routes `:id` ci-dessus résolvent `req.params.id` comme un ObjectId de `Contrat` (confirmé par lecture de `rentalLeaseLifecycleController.js` : chaque export transmet `req.params.id` à un service qui charge `Contrat.findById`).

## Rouge (avant correctif)

Suite `server/__tests__/securityClosureP0WaveLeaseLifecycleTenantAuthority.mongo.integration.test.js`, 6 tests. Garde retiré temporairement : **3/6 échoués** (transition cross-tenant acceptée, encaissement de caution cross-tenant accepté, staff multi-tenant sans en-tête non bloqué).

## Contrat canonique réutilisé

`contratRoutes.js` protège déjà le même modèle `Contrat` via un `router.param('id', …)` appelant `assertResourceTenantOrUnattributed`. Copie **verbatim** de ce garde dans `rentalLeaseLifecycleRoutes.js` — aucune logique métier des services de cycle de vie n'a été touchée.

## Correctif

`server/routes/rentalLeaseLifecycleRoutes.js` : ajout de `router.use(auth.protect)` + `router.param('id', …)` (identique à `contratRoutes.js`), avant la déclaration des routes.

## Vert (après correctif)

**6/6 PASS.** Tenant A → Contrat A préservé (transition, caution). Tenant A → Contrat B refusé, `Contrat.cycleVie`/`cautionVersee` inchangés. Staff multi-tenant sans en-tête → fail-closed. `GET /:id/available-transitions` reste fonctionnel pour le bon tenant.

## Statut : **CLOSED**
