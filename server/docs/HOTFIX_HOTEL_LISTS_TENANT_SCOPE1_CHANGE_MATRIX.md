# HZ-06 — Matrice des changements

| Fichier | Changement HZ-06 |
|---|---|
| `routes/hotelRoutes.js` | guard canonique sur les 3 GET LIVE |
| `controllers/hotelController.js` | propagation de `req.platformTenant` pour la branche Admin ; filtre tenant pending |
| `services/hotelService.js` | `tenantId` ajouté aux queries admin/list et portfolio |
| `__tests__/hotelAdminListsTenantScope.mongo.integration.test.js` | reproduction et certification A/B |
| `__tests__/hotelRoutes.test.js` | attente de query historique alignée sur le nouveau filtre tenant |

Inchangés : rôles, workflow, publication, modération, statuts, HotelReservation, Accommodation, Property métier, finance, frontend, mobile, schéma, indexes et migrations.
