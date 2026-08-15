# SPRINT DASH-4 — État initial realtime, notifications et E2E

Date : 2026-08-14  
Branche/HEAD : `main` / `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba`

## 1. Notifications hospitality

Le dispatcher unique est `notificationService.notify`; `notifyStaff` résout le tenant depuis `platformTenantId`, l'entité ou les métadonnées. Les producteurs hospitality identifiés couvrent réservation hôtel (création, confirmation/rejet/annulation/expiration, check-in, check-out), housekeeping (création, assignation, fin), inspection (échec, remise en service), maintenance (création, assignation, résolution) et échec de brouillon financier après check-in. Les paiements/factures utilisent surtout le ledger et les écrans financiers ; aucune notification hospitality dédiée exhaustive n'est démontrée.

## 2. Deep-links

Les liens historiques sont globaux : `/mes-hotels/reservations`, `/dashboard/housekeeping`, `/dashboard/maintenance`, `/mes-reservations-hotel` ou `/profile`. Ils ne restaurent pas toujours l'établissement. Les routes DASH-3 paramétrées existent mais ne sont pas utilisées systématiquement.

## 3. Routes ciblées

Routes propriétaires existantes : `/mes-hotels/:hotelId`, `/mes-hotels/:hotelId/{rooms,inventory,room-categories,rates,housekeeping,maintenance,finance}`, `/mes-hebergements/:accommodationId`. Réservations hôtel : `/mes-hotels/reservations?hotelId=...`. Routes staff équivalentes sous `/dashboard`. L'URL porte le contexte, l'API garde l'autorisation.

## 4. Architecture Socket.IO

Le serveur authentifie JWT, tokenVersion, compte actif et tenant effectif. À la connexion il joint uniquement la room utilisateur. Les rooms conversation sont autorisées par ressource et tenant. Aucun contexte hôtel ou accommodation n'existe initialement.

## 5. User rooms

Room `userId` utilisée pour notifications personnelles et messagerie. Elle est conservée.

## 6. Tenant rooms

Aucune room tenant générique. Le tenant est néanmoins résolu et stocké sur le socket, puis appliqué aux rooms conversation. L'absence de broadcast tenant limite l'exposition.

## 7. Hotel/accommodation rooms éventuelles

Aucune room `hotel:<id>` ni `accommodation:<id>` initialement. Les pages hospitality ne souscrivent à aucun événement établissement. Une room accommodation n'est pas justifiée par des producteurs opérationnels existants.

## 8. Events

Événements socket existants : `notification`, événements visites, location et messagerie. Aucun événement réservation/check-in/check-out/chambre/housekeeping/inspection/maintenance/finance à destination d'une room hôtel.

## 9. Listeners frontend

`useNotifications` ouvre un socket utilisateur et nettoie ses listeners. `StaffInboxPage` ouvre un socket conversation tenant-scopé. Aucun listener hospitality, aucune invalidation/refetch par `hotelId`.

## 10. Multi-établissement

Le HTTP utilise l'identifiant URL et les gardes centrales. Le temps réel ne connaît donc ni Hotel A ni Hotel B : pas de fuite démontrée par broadcast, mais aucune mise à jour cockpit n'est possible et aucune certification room ne peut être prononcée.

## 11. E2E existant

Playwright est le framework unique. Il utilise `server/scripts/start-accommodation-e2e.js`, des fixtures synthétiques et deux projets Chromium. Des specs accommodation et portefeuille hôtel existent ; le parcours propriétaire DASH-4, les deep-links hospitality et deux contextes Socket.IO ne sont pas couverts dans un lot identifiable DASH-4.

## 12. Gaps

- notifications opérationnelles sans `hotelId` ni entité, pouvant faire échouer silencieusement `notifyStaff`;
- liens globaux ambigus ;
- aucune room hôtel autorisée ;
- aucune émission opérationnelle établissement ;
- aucune reconnexion contextuelle ;
- aucun listener cockpit ;
- E2E navigateur DASH-4 absent ;
- révocation post-join non réévaluée avant émission.

## 13. P0/P1/P2/P3/P4

- P0 : une future jointure acceptant un ID libre serait cross-hotel ; elle n'existe pas encore. La conception doit obligatoirement appeler le contrôle central.
- P1 : notifications housekeeping/inspection/maintenance sans établissement ; deep-links globaux.
- P1 : isolation realtime non certifiable faute de room.
- P2 : contexte non restauré après reconnexion et cockpit non invalidé.
- P3 : risque de sockets/listeners dupliqués si le frontend est ajouté sans cleanup.
- P4 : métriques de charge non mesurées.

## 14. Plan de certification

1. Ajouter des helpers centralisés de liens hospitality et des métadonnées `hotelId`.
2. Ajouter `hotel:<id>` avec join/leave autorisé par `assertOperationalHotelAccess`, sans modifier les user rooms.
3. Émettre un événement minimal `hospitality:updated` après commit.
4. Ajouter un hook frontend contextualisé avec leave, reconnect, cleanup et refetch HTTP.
5. Tester notification, auth/join/refus/switch/reconnexion/révocation/isolation.
6. Ajouter le lot Playwright `DASH-4 E2E`, puis exécuter les gates et documenter uniquement les preuves réellement obtenues.

