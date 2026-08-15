# SYNC-2B — État initial : parité PMS Mobile & exploitation propriétaire

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (identique à SYNC-2A, non commité). Ce document précède toute écriture de code de ce sprint.

## 1. Rapports lus

`SYNC1_WEB_MOBILE_REPORT.md`, `SYNC1_PARITY_MATRIX.md`, `SYNC2A_MOBILE_FOUNDATIONS_ETAT_INITIAL.md`, `SYNC2A_MOBILE_FOUNDATIONS_REPORT.md`, `E2E1_PMS_REPORT.md`, `DASH3_HOSPITALITY_REPORT.md` (lifecycle chambre, contrats finance, gaps Socket.IO/deep-links déjà documentés comme dette), `DASH4_REALTIME_E2E_REPORT.md` (room `hotel:<id>`, matrice événements).

## 2. Écrans hospitality Mobile existants (avant modification)

`altimmo-app/src/screens/Hotels/` : `HotelBookingScreen.jsx` (réservation client), `MyHotelReservationsScreen.jsx`/`HotelReservationDetailScreen.jsx` (client), `HotelOperationsScreen.jsx` (staff/owner — sélecteur d'hôtel, liste réservations `getOwnerHotelReservations`, inventaire 7 jours + stop-sell, room assignment/auto/change, check-in, check-out). Aucun écran housekeeping/inspection/maintenance/cockpit. `HotelOperationsScreen` est câblé directement dans `ProfilStack.jsx`, hors du registre `shared/navigation/registry.json` (`MY_ESTABLISHMENTS.mobileRoute: null`, confirmé par SYNC-1).

## 3. Service mobile existant

`hotelReservationService.js` : réservation client + owner (`getOwnerHotelReservations`, `getAccessibleHotels`, room assignment, check-in/out, inventaire). Aucune fonction `checkout-financial-readiness`, housekeeping, inspection, maintenance ou analytics.

## 4. Backend PMS — contrats vérifiés (jamais supposés)

- **Financial readiness** : `GET /api/hotel-reservations/:id/checkout-financial-readiness` → `{financialReadiness:{status, financialSnapshot, blockers, warnings}}` (certifié E2E-1, corrigé pendant ce sprint pour l'accès Admin — inchangé depuis, source de vérité).
- **Cockpit** : `GET /api/dashboard-analytics/hotels?hotelId=` → `{kpis:{occupiedRooms, totalRooms, checkInsToday, pendingCheckIns, checkOutsToday, pendingCheckOuts, cleaningRooms, housekeeping, inspectionRooms, maintenance, outOfServiceRooms, remainingAmount}}` (exact champs repris de `client/lib/pages/dashboard/HotelDetailPage.jsx`, aucun KPI inventé — pas de revenu/ADR/RevPAR, absents du backend).
- **Housekeeping** : `GET/POST /api/housekeeping` (`hotelId`/`status`/`priority` en query ; body `roomId,hotelId,reservationId,type,priority,notes`), `PATCH /:id/assign|start|complete|cancel` (`server/routes/housekeepingRoutes.js`, `controllers/housekeepingController.js`). Statuts réels : `pending, assigned, in_progress, completed, cancelled`. Types réels : `checkout_cleaning, refresh, deep_cleaning`. Priorités réelles : `low, normal, high, urgent` (champ `priority` confirmé existant en base, contrairement à une supposition — safe à afficher).
- **Inspection** : `POST /api/inspections` (`roomId, housekeepingTaskId, notes`), `PATCH /:id/approve|reject` (`notes` en body pour reject). Aucun `GET` de liste — le Web crée l'inspection au clic « Inspecter » sur une tâche `completed` et garde son `_id` en état local le temps de la décision (mirroir exact requis côté mobile, jamais un état inventé).
- **Maintenance hôtel** : `GET/POST /api/maintenance` (`hotelId,status,priority,category` en query ; body `roomId,hotelId,inspectionId,category,priority,description`), `PATCH /:id/assign|start|resolve|close`. Modèle `MaintenanceTicket.js`, strictement distinct de `RentalMaintenanceTicket.js` (GL). Catégories réelles : `plumbing, electricity, furniture, cleanliness, security, other`. Statuts réels : `open, assigned, in_progress, resolved, closed`. Le Web recrée une inspection (« Ré-inspection ») depuis un ticket résolu, via `ticket.inspection.housekeepingTask._id`.
- **Realtime** : `hotel:<id>` (room), événement unique `hospitality:updated` avec payload exact `{hotelId, eventType, entityType, entityId, status, updatedAt}`. `eventType` réels observés dans le code (jamais inventés) : `housekeeping.created/assigned/started/completed/cancelled`, `inspection.passed/failed`, `maintenance.created/assigned/started/resolved/closed`, `reservation.<status>` (incl. `reservation.checked_in`, `reservation.checked_out`, `reservation.modified`).

## 5. Cycle métier confirmé (DASH-3, inchangé)

```
available → occupied (check-in) → cleaning (check-out) → inspection (ménage terminé)
  → available (inspection OK, aucun ticket ouvert) | out_of_service (inspection KO)
out_of_service → inspection (réparation terminée, ré-inspection)
```

Une inspection réussie ne remet PAS automatiquement la chambre disponible si une maintenance reste ouverte — logique serveur, jamais recréée côté mobile (mandat §29).

## 6. SYNC-2A — fondations disponibles pour ce sprint

`joinHotelRoom(hotelId)`/`leaveHotelRoom(hotelId)` (contrat DASH-4 exact, testés isolément, non consommés) ; `X-Platform-Tenant-Id` injecté conditionnellement ; `staffCapabilities.js` (projection IAM-3) ; nettoyage de session centralisé (401 + 403 compte désactivé). Rien de ceci n'est modifié par SYNC-2B, seulement consommé.

## 7. Ce qui n'existe PAS et doit être construit

Financial readiness visible avant check-out (mobile) ; écran housekeeping+inspection ; écran maintenance hôtel ; cockpit hôtel (KPI fiables uniquement) ; consommation réelle de `joinHotelRoom`/`leaveHotelRoom` sur les écrans PMS ; navigation contextualisée hôtel (« Mes établissements → Hôtel A → Housekeeping »).

## 8. Ce qui ne sera PAS construit (documenté, reporté)

Deep-links notifications hospitality → écran mobile (mandat §43 : reporté à SYNC-2C si l'architecture transversale nécessaire dépasse ce sprint — évalué après audit navigation). Aucun second acteur financier créé sur mobile (E2E-1 : le volet financier reste Admin-only, y compris mobile — un propriétaire mobile ne doit voir la facturation qu'en lecture).
