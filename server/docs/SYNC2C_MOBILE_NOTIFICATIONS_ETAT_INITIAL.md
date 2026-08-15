# SYNC-2C — État initial : notifications, deep-links & realtime Mobile

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (identique à SYNC-2B, non commité, `git diff --check` propre). Ce document précède les corrections de ce sprint.

## 1. Architecture notifications — flux réel reconstitué

```
Backend notify()/notifyStaff() → Notification.create({..., destination, entityType, entityId, data})
  ├─ Socket.IO room=userId, event 'notification' (payload inclut `destination` top-level)
  └─ Push Expo si hors ligne (payload data inclut `destination` top-level)
Mobile :
  - Foreground : NotificationsScreen socket.on('notification', ...) → prepend liste
  - Tap (background/cold start) : setupNotificationListeners() → resolveNavigation(data) → navigate()
  - Liste (in-app) : NotificationsScreen.handlePress(notif) → [AVANT CE SPRINT] sa PROPRE
    résolution locale (getNavTarget/MAP), PAS resolveNavigation()
```

## 2. Types de notification backend réellement persistés (PMS hôtelier)

Recherche exhaustive (`grep type: '...'`) dans `hotelReservationService.js`, `checkInService.js`, `checkOutService.js`, `housekeepingService.js`, `inspectionService.js`, `maintenanceService.js` :

```
hotel_reservation_pending, hotel_reservation_created, hotel_reservation_confirmed,
hotel_reservation_rejected, hotel_reservation_cancelled, hotel_reservation_expired,
hotel_reservation_checked_in, hotel_reservation_checked_out, hotel_reservation_modified,
hotel_financial_draft_failed,
housekeeping_task_created, housekeeping_task_assigned, housekeeping_task_completed,
room_inspection_failed, room_returned_to_service,
maintenance_ticket_created, maintenance_ticket_assigned, maintenance_ticket_resolved
```

## 3. Gap confirmé — destinations manquantes

`server/services/navigationService.js` (`USER_DESTINATIONS`/`STAFF_DESTINATIONS`) ne mappait, avant ce sprint, QUE `hotel_reservation_confirmed/rejected/cancelled/expired` (voyageur). **Aucune** des 13 autres types PMS n'avait de `destination` — confirmé par lecture directe des deux tables, jamais supposé. Conséquence : ces notifications atteignaient bien le mobile (persistées, poussées, socket) mais `resolveNotificationMobileTarget()` ne trouvait aucune destination et retombait sur le fallback générique (souvent `null`, aucune navigation).

## 4. Gap confirmé — registre `shared/navigation/registry.json`

Aucune destination `HOTEL_OPERATIONS`/`HOTEL_COCKPIT`/`HOUSEKEEPING`/`HOTEL_MAINTENANCE` n'existait (confirmé SYNC-1 : `MY_ESTABLISHMENTS.mobileRoute: null`). Les 4 écrans PMS créés en SYNC-2B (`HotelOperationsScreen`, `HotelCockpitScreen`, `HotelHousekeepingScreen`, `HotelMaintenanceScreen`) n'étaient donc atteignables que depuis le menu Profil, jamais depuis une notification.

## 5. Bug réel confirmé — duplication de la résolution notification → écran

`NotificationsScreen.jsx` (liste in-app) implémentait sa **propre** fonction `getNavTarget()` avec sa **propre** `MAP` de types, distincte de `notificationsService.js`'s `TYPE_TO_SCREEN`/`resolveNavigation()` (utilisée par le tap push). Comparaison directe des deux tables : `getNavTarget`'s `MAP` **omettait** `quote_received/status/response`, `contrat_new/updated`, `loyer_paye/en_retard`, `account_verified/suspended`, `bien_valide/rejete`, `nouveau_signalement`, `visite_payee`, tous les `rental_*`, et l'intégralité du PMS hôtelier — présents dans `TYPE_TO_SCREEN`. Conséquence démontrée : taper une de ces notifications dans la LISTE ne naviguait nulle part, alors que le même type reçu en PUSH naviguait correctement. Bug de duplication classique (mandat §41), corrigé en supprimant `getNavTarget`/`MAP` et en appelant `resolveNavigation()` partout.

## 6. Bug réel confirmé — `useFocusEffect` ne recharge pas sur changement de paramètre sans transition de focus

Les 4 écrans PMS (SYNC-2B) rechargeaient leurs données via `useFocusEffect(useCallback(() => load(), [load]))` uniquement. `useFocusEffect` ne se redéclenche que sur un véritable événement de focus (montage, retour d'un autre écran) — **jamais** sur un simple changement de `route.params.hotelId` pendant que l'écran est déjà au premier plan. Scénario concret cassé : Owner ouvre Hôtel A (Housekeeping), reçoit et tape une notification Hôtel B sans quitter l'écran → `route.params.hotelId` change, mais les données Hôtel A restent affichées (realtime aurait pourtant déjà rejoint la room B, `useHotelRealtime` utilisant un `useEffect` classique, lui correctement réactif). `HotelOperationsScreen` avait un défaut supplémentaire : son `hotelId` était un `useState(route.params.hotelId)` — valeur figée au premier montage, jamais resynchronisée.

## 7. Vérifié sans modification nécessaire — fallback type inconnu

`resolveNavigation()` retourne déjà `null` pour tout type inconnu/non résolu (confirmé SYNC-2A/2B), et l'appelant vérifie `if (!target) return;` avant toute navigation. Aucun crash possible, confirmé par lecture directe et par test.

## 8. Vérifié sans modification nécessaire — cold start / session

`navigationService.js` : `navigate()` stocke la cible en `pendingNotification` tant que `navigationRef.current?.isReady()` est faux ; `flushPendingNavigation()` n'est appelé que via `onReady` du `NavigationContainer`, lui-même rendu par `AppNavigator` uniquement **après** résolution de `loading` (SYNC-2A : session restaurée/validée ou nettoyée). Un deep-link cold-start ne peut donc jamais s'exécuter avant la résolution de session — confirmé par lecture directe du flux de montage.

## 9. Vérifié sans modification nécessaire — socket user room vs hotel room

`socketService.js` (SYNC-2A/2B) : le socket unique rejoint automatiquement la room `userId` côté serveur (notifications personnelles) et gère séparément `joinHotelRoom`/`leaveHotelRoom` (`hotel:<id>`, événements opérationnels `hospitality:updated`). Aucune fusion des deux mécanismes — confirmé par lecture de `server/socket.js` et des deux services mobiles concernés.

## 10. Ce qui reste hors périmètre (documenté, pas bricolé)

Web links bruts (`/mes-hotels/...`) produits par `hospitalityLinkFor()` (champ `link`, legacy, consommé par le Web uniquement) ne sont jamais lus par le mobile — `resolveNotificationMobileTarget()` ne lit que `destination`/`data.destination`, jamais `link`. Confirmé, aucun risque d'ouverture aveugle d'URL Web côté mobile (mandat §44-45), aucune correction nécessaire.
