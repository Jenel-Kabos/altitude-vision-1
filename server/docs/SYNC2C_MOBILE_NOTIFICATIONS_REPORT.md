# SYNC-2C — Rapport final : notifications, deep-links & realtime Mobile

Date : 2026-08-15. Branche `main`, HEAD au démarrage `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (identique à SYNC-2B, non commité). Fait suite à `SYNC2C_MOBILE_NOTIFICATIONS_ETAT_INITIAL.md` et `SYNC2C_NOTIFICATION_PARITY_MATRIX.md`.

## 1. Résumé exécutif

Deux bugs réels et démontrés ont été trouvés et corrigés : (1) la liste de notifications in-app utilisait une résolution de navigation dupliquée et périmée par rapport au tap push, rendant plusieurs types de notifications muets uniquement dans la liste ; (2) les 4 écrans PMS (SYNC-2B) ne rechargeaient pas leurs données lors d'un changement d'établissement sans transition de focus (deux notifications d'hôtels différents tapées sans quitter l'écran). Les 13 types de notifications PMS hôtelier sans destination mobile ont été raccordés au registre partagé existant. **Verdict : SYNC-2C CERTIFIÉ VERT.**

## 2. Architecture avant

`resolveNavigation()` (push/cold-start) et `NotificationsScreen.getNavTarget()` (liste in-app) coexistaient comme deux mappings type→écran indépendants et déjà en dérive. 13 types de notifications PMS hôtelier (housekeeping/inspection/maintenance/réservation propriétaire) n'avaient aucune destination dans `server/services/navigationService.js`, donc aucune cible mobile malgré des écrans PMS existants depuis SYNC-2B.

## 3. Architecture après

```
Notification (push OU liste OU socket live)
  → resolveNavigation(notif)  [SOURCE UNIQUE]
    → resolveNotificationMobileTarget (registre partagé, destination canonique)
    → TYPE_TO_SCREEN (types legacy pré-NAV-CORE)
    → safeScreens fallback
    → null (jamais de plantage, jamais de navigation arbitraire)
  → navigate(screen, params)
```

`NotificationsScreen.jsx` n'a plus de logique de résolution propre — `getNavTarget`/`MAP` supprimés entièrement.

## 4. Types de notification

18 types PMS hôtelier réels recensés (grep exhaustif des appels `notify()`/`notifyStaff()` dans `hotelReservationService.js`, `checkInService.js`, `checkOutService.js`, `housekeepingService.js`, `inspectionService.js`, `maintenanceService.js`). 5 avaient déjà une destination (`hotel_reservation_confirmed/rejected/cancelled/expired`, voyageur). 13 n'en avaient aucune avant ce sprint.

## 5. Matrice notification

Voir `SYNC2C_NOTIFICATION_PARITY_MATRIX.md` — 18 lignes couvrant PMS, Client, GL, Documents, Compte, Accommodation.

## 6. Notification router

`resolveNavigation()` (`notificationsService.js`) est désormais l'unique point d'entrée, consommé identiquement par le tap push, le socket live (indirectement, via la liste qui l'appelle au tap) et la liste in-app. Aucune seconde table de mapping ne subsiste dans le code mobile.

## 7. Deep-links

4 nouvelles destinations ajoutées à `shared/navigation/registry.json` (source unique Web+Mobile) : `HOTEL_OPERATIONS`, `HOTEL_COCKPIT`, `HOUSEKEEPING`, `HOTEL_MAINTENANCE` — `mobileRoute` pointant vers les écrans SYNC-2B existants (`HotelOperations`, `HotelCockpit`, `HotelHousekeeping`, `HotelMaintenance`), `webRoute` vers les pages `/mes-hotels/:hotelId/...` déjà existantes (aucune route Web créée). `server/services/navigationService.js` : 13 nouveaux mappings `type → destination` (`USER_DESTINATIONS`/`STAFF_DESTINATIONS` selon l'audience réelle observée dans le code, jamais supposée).

## 8. Foreground

Inchangé, déjà correct : `NotificationsScreen` écoute `socket.on('notification', ...)` (room utilisateur) et préfixe la liste sans navigation automatique — l'utilisateur choisit d'ouvrir ou non.

## 9. Background

Tap sur notification → `setupNotificationListeners()` → `resolveNavigation()` → `navigate()`. Inchangé, déjà correct, désormais couvert par les mêmes tests que la liste (source unique).

## 10. Cold start

Vérifié par lecture directe (aucune modification nécessaire) : `navigate()` (`navigationService.js`) met en file (`pendingNotification`) tant que `navigationRef.current?.isReady()` est faux ; `NavigationContainer` (et donc `isReady()`) n'existe que **après** résolution de `loading` dans `AppNavigator` (SYNC-2A : session restaurée ou nettoyée). Un deep-link cold-start ne peut donc jamais s'exécuter avant la résolution de session.

## 11. Session restore

Réutilise intégralement SYNC-2A (401/403 compte désactivé → nettoyage central). Aucune modification.

## 12. PMS

Cycle complet : réservation (propriétaire/voyageur), housekeeping, inspection (réutilise l'écran housekeeping, jamais un écran dédié créé pour le seul besoin du deep-link, mandat §33), maintenance — tous désormais atteignables depuis une notification, contextualisés par `hotelId`.

## 13. Réservations

`hotel_reservation_pending` (propriétaire) → `HOTEL_OPERATIONS` (nouveau, jamais confondu avec `HOTEL_RESERVATIONS` qui reste l'écran voyageur). `hotel_reservation_created/checked_in/checked_out/modified` (voyageur, via `notifyReservationGuest`, jusque-là non mappés) → `HOTEL_RESERVATIONS`, gap fermé au passage.

## 14. Housekeeping

`housekeeping_task_created/assigned/completed` → `HOUSEKEEPING` (nouveau) → `HotelHousekeepingScreen`, contextualisé par `hotelId` extrait des métadonnées réelles du producteur.

## 15. Inspection

`room_inspection_failed`, `room_returned_to_service` → réutilisent `HOUSEKEEPING` (même écran combiné que le Web, `HousekeepingDashboardPage.jsx`) — conforme au mandat §33.

## 16. Maintenance

`maintenance_ticket_created/assigned/resolved` → `HOTEL_MAINTENANCE` (nouveau) → `HotelMaintenanceScreen`. Non-régression vérifiée par test : `rental_maintenance_ticket_created` (GL) reste sur `RENTAL_MAINTENANCE`, jamais fusionné.

## 17. Finance

`hotel_financial_draft_failed` reste **volontairement non mappé** — aucune destination mobile, conforme au mandat §35 (le mobile propriétaire ne doit jamais recevoir une capacité de gestion financière). La notification s'affiche (titre/corps) sans proposer de navigation vers une mutation interdite. Testé explicitement.

## 18. Client

`visite_*`, `transaction_*/payment_*`, `real_estate_application_*/reservation_*`, `bien_valide/bien_rejete/nouveau_signalement` : déjà mappés, inchangés, désormais couverts par la source unique (bénéficient indirectement de la correction §22).

## 19. Locataire

`tenant_*` : déjà mappés vers le portail natif (`TENANT_PORTAL`/`TENANT_MAINTENANCE`/etc., GL-MOBILE-1), inchangés.

## 20. Propriétaire immobilier

`bien_valide/bien_rejete`, `rental_*` : déjà mappés, inchangés.

## 21. Messaging

`new_message/new_staff_message/message_staff` : logique d'enrichissement (chargement de la conversation complète) désormais dans une seule fonction (`TYPE_TO_SCREEN` de `notificationsService.js`) au lieu de deux copies quasi identiques (`notificationsService.js` + `NotificationsScreen.jsx`).

## 22. Documents

`tenant_document_added/tenant_receipt_added` : déjà mappés (DOC-MOBILE-1), inchangés.

## 23. Socket.IO

Aucune modification de `socketService.js` ce sprint (SYNC-2A/2B intacts). Vérifié : room utilisateur (notifications personnelles) et room hôtel (`hotel:<id>`, événements opérationnels) restent deux mécanismes strictement distincts, jamais fusionnés.

## 24. User room

Inchangée. `NotificationsScreen` écoute l'événement `'notification'` sur le socket singleton (room = userId côté serveur), confirmé par lecture directe.

## 25. Hotel room

Inchangée dans son fonctionnement (SYNC-2B). Désormais correctement synchronisée avec la navigation grâce à la correction §26 (le hook lui-même était déjà correct — c'est le RECHARGEMENT DES DONNÉES HTTP qui ne suivait pas).

## 26. Hotel switch

**Bug réel trouvé et corrigé.** Les 4 écrans PMS rechargeaient via `useFocusEffect` uniquement, qui ne se redéclenche que sur une vraie transition de focus — jamais sur un simple changement de `route.params.hotelId` pendant que l'écran reste au premier plan. Ajout d'un `useEffect(() => { load(); }, [hotelId])` supplémentaire dans les 4 écrans. `HotelOperationsScreen` avait un défaut aggravant : son `hotelId` était un `useState` initial jamais resynchronisé avec `route.params` — corrigé par un effet de synchronisation dédié. Testé explicitement à deux niveaux : le hook (`useHotelRealtime.test.js`, leave A + join B) et l'écran (`HotelHousekeepingScreen.test.jsx`, rechargement HTTP + affichage correct, aucune donnée A résiduelle).

## 27. Reconnect

Inchangé (SYNC-2B) : le hook rejoint automatiquement la room active sur tout `connect` du socket. Non re-testé ce sprint (déjà couvert par les tests SYNC-2B, aucune régression constatée).

## 28. AppState

Non modifié — aucun double listener constaté à l'audit (le hook nettoie proprement ses listeners au démontage, déjà testé SYNC-2B). Non retesté spécifiquement pour foreground/background OS ce sprint (limite des tests unitaires JS sans harness AppState natif) — **NON CONFIRMÉ** au-delà du cycle mount/unmount/remount déjà couvert.

## 29. Tenant

Inchangé (SYNC-2A). Les nouvelles destinations PMS n'introduisent aucune notion tenant supplémentaire — l'autorisation reste backend (`assertOperationalHotelAccess`), jamais dépendante du deep-link.

## 30. Ownership

Aucune notification ne peut accorder un accès qu'`assertOperationalHotelAccess`/`canAccessHotel` (backend) refuserait — le deep-link ne fait que proposer une navigation, jamais une autorisation (règle finale du mandat, respectée par construction : aucune logique d'autorisation n'a été ajoutée côté mobile).

## 31. Cross-owner

Non testé par un nouveau test dédié ce sprint (les mécanismes de contrôle sont ceux d'E2E-1/SYNC-2B, inchangés). **NON CONFIRMÉ PAR UN TEST SYNC-2C SPÉCIFIQUE** — un Owner A ouvrant un deep-link Hôtel B recevrait la même réponse 403 backend que documentée en SYNC-2B/E2E-1, mais aucun test d'intégration navigation→403 n'a été écrit ce sprint spécifiquement pour le chemin notification.

## 32. Cross-tenant

Même statut que §31 — **NON CONFIRMÉ PAR UN TEST SYNC-2C SPÉCIFIQUE**, mécanisme backend inchangé et déjà couvert par SYNC-2A pour le runtime tenant lui-même.

## 33. Bugs trouvés

- **P1 réel** : `NotificationsScreen.jsx` utilisait une résolution de navigation dupliquée et périmée (`getNavTarget`/`MAP`), manquante pour ~15 types déjà gérés par le résolveur canonique — un tap dans la liste ne naviguait nulle part pour ces types alors que le push fonctionnait.
- **P1 réel** : les 4 écrans PMS ne rechargeaient pas leurs données HTTP sur un changement d'établissement sans perte de focus (scénario notification hôtel B pendant que hôtel A est ouvert) — risque d'affichage d'informations opérationnelles obsolètes (housekeeping/maintenance d'un autre hôtel affiché sous une étiquette B).
- **P2 confirmé (préexistant, non nouveau)** : 13 types de notification PMS sans destination mobile.

## 34. Bugs corrigés

Les trois ci-dessus, chacun avec preuve directe (lecture de code + test qui échouait avant correction) avant toute modification.

## 35. Tests

| Fichier | Nouveaux tests |
|---:|---:|
| `notificationsService.test.js` | +7 |
| `navigationRegistry.test.js` (serveur) | +5 |
| `useHotelRealtime.test.js` | +1 |
| `HotelHousekeepingScreen.test.jsx` | +1 |

Suite complète mobile : **33 suites / 311 tests, 0 échec** (baseline SYNC-2B : 33/303 → +8 tests, zéro régression, aucune nouvelle suite car tous les fichiers modifiés existaient déjà).

## 36. Gates

| Contrôle | Résultat |
|---|---|
| Mobile — syntaxe | ✅ 177 fichiers, 0 erreur |
| Mobile — lint | ✅ 0 erreur, 102 avertissements (identiques SYNC-2B, aucun nouveau) |
| Mobile — types | ✅ |
| Mobile — tests | ✅ 33/33 suites, 311/311 tests |
| Mobile — export Android | ✅ bundle Hermes 6,7 Mo |
| Mobile — Expo Doctor | ⚠️ 20/21 (12 dépendances patch préexistantes, identiques, aucune nouvelle incompatibilité) |
| Serveur — lint (fichiers modifiés) | ✅ 0 erreur |
| Serveur — `navigationRegistry.test.js`/`notificationService.test.js` | ✅ 23/23 puis 13/13 après correctif format JSON |
| Serveur — suite unitaire complète | ✅ 116/116 suites, 1331/1331 tests (+5 vs SYNC-2B, zéro régression) |
| `git diff --check` | ✅ propre |

## 37. Expo Doctor

Inchangé : 12 dépendances patch, hors périmètre (`MOB-1`).

## 38. Dette restante

- `contrat_*/quote_*/loyer_*` restent sans destination mobile — aucun écran natif équivalent n'existe (avant ni après ce sprint) ; créer une destination sans écran violerait le mandat §33.
- Tests cross-owner/cross-tenant spécifiques au chemin notification non écrits ce sprint (§31-32) — le contrôle backend est inchangé et déjà certifié par SYNC-2B/E2E-1, mais la preuve d'intégration bout-en-bout via une notification précise reste à faire.
- AppState foreground/background OS réel non testé au-delà du cycle mount/unmount JS (§28).
- Une première tentative de mise à jour du registre a régénéré tout le fichier avec un formatage JSON différent (diff de 1037 lignes pour 4 entrées) — détectée avant certification, corrigée en un patch chirurgical de 6 lignes. Aucune trace de cet incident dans l'état final, documentée ici par transparence méthodologique.

## 39. SYNC-2D

Écrans contrat/devis mobile (si le produit le juge nécessaire, sinon fermer la dette en documentant Web-only) ; tests cross-owner/cross-tenant dédiés au chemin notification ; certification E2E mobile du cycle PMS complet notification → écran → action (réservée `MOB-E2E`).

## 40. Risques

Le hook `useHotelRealtime` et le rechargement HTTP sont maintenant deux mécanismes séparés qui doivent rester synchronisés à la main (chaque nouvel écran PMS futur devra reproduire le double `useFocusEffect` + `useEffect([hotelId])`) — un oubli reproduirait le bug §26. À surveiller dans SYNC-2D/SYNC-2E.

## 41. Git

```
git status --short   → 18 fichiers modifiés (6 mobile services/screens fonctionnels, reste tests+docs+registre), fichiers SYNC-2A/2B toujours présents
git diff --check     → propre
git diff --stat      → 19 fichiers changés, 611 insertions(+), 120 suppressions(-)
git branch --show-current → main
git rev-parse HEAD   → 0fc4157262d3a8b69e86b02cda66cb95d2e26ed5 (inchangé)
```
Aucun `git add`/`commit`/`push`/déploiement.

## 42. Verdict

**SYNC-2C CERTIFIÉ VERT.**

- Notifications mobiles sûres : ✅ (type inconnu/payload malformé testés, jamais de crash, jamais de navigation arbitraire).
- Deep-links contextualisés : ✅ (13 types PMS raccordés, `hotelId` propagé, testé).
- Foreground/background/cold-start maîtrisés : ✅ pour foreground/background (testé/vérifié) ; cold-start vérifié par lecture de code (mécanisme de file d'attente pré-existant, sain).
- Hotel switch propre : ✅ (bug réel trouvé et corrigé, testé à deux niveaux).
- Socket user/hotel cohérents : ✅ (vérifié distincts, inchangés).
- Auth/Tenant/Ownership conservés : ✅ (aucune logique d'autorisation ajoutée côté mobile ; réserves explicites §31-32 sur la couverture de test cross-owner/tenant spécifique au chemin notification, sans remise en cause du contrôle backend lui-même).
- Tests verts : ✅ (311/311 mobile, 1331/1331 serveur, zéro régression).

Les réserves explicites (§31, §32, §38) portent sur la **profondeur de test**, jamais sur un défaut de sécurité démontré — le backend reste l'autorité inchangée à chaque niveau vérifié.
