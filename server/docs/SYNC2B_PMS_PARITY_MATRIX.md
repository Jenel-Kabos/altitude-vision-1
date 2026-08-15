# SYNC-2B — Matrice de parité PMS finale

| Fonction | Backend | Web | Mobile avant | Mobile après | Realtime | Verdict |
|---|---|---|---|---|---|---|
| Cockpit | `GET /dashboard-analytics/hotels` | ✅ | ❌ | ✅ (`HotelCockpitScreen`, mêmes champs `kpis`, aucun KPI inventé) | ✅ (`hospitality:updated` → refetch) | Parité atteinte |
| Reservation | `hotel-reservations/*` | ✅ (certifié E2E-1) | ✅ (liste/filtre par hôtel) | ✅ (inchangé, `getOwnerHotelReservations`) | ✅ (`reservation.*` → refetch) | Parité déjà atteinte, realtime ajouté |
| Assignment | `hotels/room-assignments/*` | ✅ (certifié E2E-1) | ✅ | ✅ (inchangé) | — (pas d'event dédié émis côté serveur, non inventé) | Parité déjà atteinte |
| Check-in | `hotel-reservations/:id/check-in` | ✅ (certifié E2E-1) | ✅ | ✅ (inchangé) | ✅ (`reservation.checked_in` → refetch) | Parité déjà atteinte, realtime ajouté |
| Financial readiness | `hotel-reservations/:id/checkout-financial-readiness` | ✅ (certifié E2E-1) | ❌ (gap confirmé SYNC-1) | ✅ (affiché avant check-out, bouton désactivé si `blocked`) | ✅ | Gap fermé |
| Check-out | `hotel-reservations/:id/check-out` | ✅ (certifié E2E-1, Admin-only override) | ✅ (sans lecture financière préalable) | ✅ (avec lecture financière préalable, aucun override Admin ajouté côté mobile) | ✅ | Gap fermé (lecture) ; override reste Web-only (conforme mandat §21) |
| Housekeeping | `housekeeping/*` | ✅ (certifié E2E-1/DASH-3) | ❌ (gap confirmé SYNC-1) | ✅ (`HotelHousekeepingScreen`, start/complete/cancel) | ✅ (`housekeeping.*` → refetch) | Gap fermé |
| Inspection | `inspections/*` | ✅ (certifié E2E-1/DASH-3) | ❌ (gap confirmé SYNC-1) | ✅ (créée/approuvée/rejetée depuis une tâche terminée, même contrat que le Web) | ✅ (`inspection.*` → refetch) | Gap fermé |
| Maintenance | `maintenance/*` | ✅ (certifié DASH-3) | ❌ (gap confirmé SYNC-1) | ✅ (`HotelMaintenanceScreen`, start/resolve/close/ré-inspection) | ✅ (`maintenance.*` → refetch) | Gap fermé |

## Notes de lecture

- « Realtime » signale un **rafraîchissement HTTP**, jamais une mutation locale directe à partir du payload socket (mandat §34) — vérifié par tests (`useHotelRealtime.test.js`, cross-hotel isolation comprise).
- Aucune ligne n'a été remplie par supposition : chaque contrat API cité a été lu directement dans `server/controllers/*.js`/`server/routes/*.js` avant implémentation (voir `SYNC2B_MOBILE_PMS_ETAT_INITIAL.md`).
- « Assignment » n'a pas de room realtime dédiée côté serveur (aucun `emitHotelEvent` dans `roomAssignmentController.js`/service) — non ajouté côté mobile pour ne jamais inventer un contrat serveur absent ; le check-in/check-out qui en découlent restent notifiés.
- Le volet financier (facturation/encaissement/allocation, override Admin du check-out bloqué) reste strictement Web/Admin-only, conformément à E2E-1 et au mandat §20-21 : le mobile propriétaire ne reçoit qu'une **lecture** de l'état financier, jamais une capacité de gestion.
