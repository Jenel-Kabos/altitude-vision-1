# Opérations hôtelières v1 (Sprint D) — chambres, affectation, check-in/check-out

**Statut : Sprint D — exploitation physique de l'établissement.** Transforme
une réservation (Sprint C, abstraite/nuitée-par-catégorie) en séjour réel :
chambres physiques, affectation chambre↔réservation, arrivée, départ, statut
de chambre. **Aucun ménage automatique, aucune maintenance, aucun minibar,
aucune facture/paiement, aucun channel manager/OTA, aucune clé électronique**
— voir §11 (hors périmètre) et le futur Sprint E (Housekeeping/Maintenance).

---

## 1. Audit initial

### 1.1 État avant ce sprint

La chaîne `Hotel → RoomCategory → RatePlan → RoomInventory → HotelReservation`
(Sprints B2/C) gérait la commercialisation et la disponibilité **au niveau
catégorie** — jamais une chambre individuelle. `RoomInventory` est un
compteur abstrait de stock par nuitée et par catégorie ; il ne référence
aucune chambre physique. `HotelReservation` ne connaissait que sa
`roomCategory`, jamais de numéro de chambre. Le cycle de statuts
(`ALLOWED_TRANSITIONS`) s'arrêtait à `confirmed`/`cancelled`/`expired`/
`rejected` — `checked_in`/`checked_out` étaient déjà présents dans l'enum
`RESERVATION_STATUSES` mais absents des transitions, avec un commentaire
explicite les réservant à un sprint ultérieur. C'est ce sprint.

### 1.2 Dépendances identifiées et impact de l'introduction de `Room`

- `RoomCategory` (Sprint B2) : `Room` y référence une catégorie exacte —
  aucune modification du modèle `RoomCategory` lui-même.
- `RoomInventory` (Sprint C) : **délibérément non couplé** à `Room` (voir
  §1.3) — aucune modification.
- `HotelReservation` (Sprint C) : `ALLOWED_TRANSITIONS` étendu pour activer
  `confirmed → checked_in → checked_out` (déjà annoncé, jamais câblé).
  Aucun autre champ modifié.
- Dashboards/pages publiques Hôtel (Sprint B2/C) : aucune régression --
  `Room`/`RoomAssignment` sont additifs, aucune route existante modifiée.

### 1.3 Décision d'architecture : `Room` et `RoomInventory` restent découplés

`RoomInventory` compte des unités abstraites par nuitée (utile pour le
moteur de disponibilité/anti-surbooking de Sprint C, qui n'a jamais besoin
de savoir QUELLE chambre physique). `Room` est un actif physique identifié
par un numéro. Les coupler aurait exigé une réconciliation permanente
(chambre mise hors service ↔ recalcul d'inventaire) hors périmètre de ce
sprint. **Limitation assumée et documentée** — voir §11.

### 1.4 Concurrence — réutilisation du pattern Sprint C

Recherche confirmée (`grep -rn "startSession\|withTransaction"`) : toujours
aucune transaction MongoDB dans ce codebase. Le risque de double affectation
(deux appels concurrents affectant la même chambre, ou la même réservation à
deux chambres) est traité par le **même principe** que
`hotelAvailabilityService` (Sprint C) : écriture atomique protégée par un
index unique, erreur de clé dupliquée (E11000) convertie en 409 métier —
jamais de `session.startTransaction()`.

### 1.5 Permissions — réutilisation intégrale de la matrice existante

`STAFF_ROLES = ['Admin', 'Collaborateur', 'GestionnaireImmobilier',
'CommunityManager']` et le pattern `assertHotelAccess(req, hotelId)`
(introduit pour `RoomCategory`, Sprint B2/audit) sont repris à l'identique
pour `Room`. Pour les actions résolues via une réservation plutôt qu'un
`hotelId` d'URL (affectation, check-in/out), un helper équivalent
(`loadReservationWithAccess`/`assertReservationAccess`) résout l'hôtel via
`reservation.hotel`.

---

## 2. Modèle `Room` (`server/models/Room.js`)

Chambre physique, appartenant à exactement un `RoomCategory`.

| Champ | Type | Notes |
|---|---|---|
| `hotel` | ObjectId → Hotel | requis |
| `roomCategory` | ObjectId → RoomCategory | requis |
| `roomNumber` | String | requis |
| `floor` | Number | défaut `0` |
| `wing` | String | optionnel |
| `status` | enum | défaut `'available'` |
| `notes` | String | optionnel |
| `features` | [String] | défaut `[]` |
| `active` | Boolean | défaut `true` |
| `createdBy` / `updatedBy` | ObjectId → User | `createdBy` requis |

**Statuts** (`Room.ROOM_STATUSES`) : `available`, `occupied`, `reserved`,
`out_of_service`, `cleaning`, `inspection`. **Pas de `maintenance`** —
volontairement absent, réservé au Sprint E.

**Transitions autorisées** (`Room.ROOM_STATUS_TRANSITIONS`, table statique
sur le modèle, source de vérité unique réutilisée par le contrôleur et les
services) :

```
available      → reserved, occupied, out_of_service
reserved       → occupied, available, out_of_service
occupied       → cleaning, out_of_service          (JAMAIS → available directement)
cleaning       → inspection, available, out_of_service
inspection     → available, cleaning, out_of_service
out_of_service → available
```

**Index** : `{hotel:1, roomNumber:1}` unique (deux chambres ne peuvent pas
partager un numéro dans le même hôtel) ; `{status:1}` (filtrage tableau des
chambres/vue globale).

## 3. Modèle `RoomAssignment` (`server/models/RoomAssignment.js`)

Lien réservation ↔ chambre. **Une réservation a au plus une chambre active
dans ce sprint** (multi-chambre hors périmètre).

| Champ | Type | Notes |
|---|---|---|
| `reservation` | ObjectId → HotelReservation | requis |
| `room` | ObjectId → Room | requis |
| `assignedBy` | ObjectId → User | optionnel |
| `assignedAt` | Date | défaut `Date.now` |
| `releasedAt` | Date | défaut `null` (affectation active) |
| `reason` | String | optionnel |

**Index anti-double-affectation** — deux index uniques **partiels**
(`partialFilterExpression: {releasedAt: {$type: 'null'}}`, et non `$exists`
puisque le champ existe toujours avec une valeur `null` par défaut) :

- `{room:1}` — une chambre ne peut avoir qu'une affectation active à la fois.
- `{reservation:1}` — une réservation ne peut avoir qu'une chambre active à
  la fois (mission §3).

Une tentative de double affectation concurrente déclenche une erreur E11000
sur l'un de ces deux index, convertie en 409 par le service — jamais de
double affectation silencieuse, prouvé par les tests de concurrence (§10).

## 4. Service `roomAssignmentService.js`

Centralise **toute** la logique d'affectation — aucune logique dupliquée
dans un contrôleur ou dans `checkInService`/`checkOutService`.

- **`getAvailableRooms({hotelId, roomCategoryId, includeReserved})`** —
  chambres actives de la bonne catégorie, `available` (ou `available` +
  `reserved` si `includeReserved`).
- **`assignRoom({reservationId, roomId, reservation, actingUser, reason})`**
  — vérifie qu'aucune affectation active n'existe déjà pour cette
  réservation (sinon 409, message dirigeant vers le changement de chambre),
  puis délègue à `createAssignment` (privé) : validation hôtel/catégorie/
  statut de la chambre, création atomique (E11000 → 409), transition de la
  chambre vers `'reserved'` (jamais `'occupied'` — seul le check-in occupe
  réellement).
- **`changeRoom({reservationId, newRoomId, reservation, actingUser,
  reason})`** — réserve la **nouvelle** chambre AVANT de libérer l'ancienne
  (même principe d'ordonnancement que `hotelReservationService.
  updateReservation`, Sprint C : jamais de fenêtre où la réservation n'a
  temporairement aucune couverture). Si le client est déjà en séjour
  (`reservation.status === 'checked_in'`), la nouvelle chambre passe
  directement à `'occupied'` (transfert physique en cours de séjour) et
  l'ancienne à `'cleaning'` ; sinon nouvelle → `'reserved'`, ancienne →
  `'available'`.
- **`releaseRoom({reservationId, actingUser, reason, nextRoomStatus})`** —
  libère l'affectation active (404 si aucune), renvoie `{assignment, room}`.
- **`getActiveAssignment(reservationId)`** — utilisé par
  `checkInService`/`checkOutService`.

**Bug réel détecté et corrigé pendant l'implémentation** : `changeRoom`
appelait initialement `assignRoom` en interne, qui rejette *toujours* un
appel si la réservation a déjà une affectation active — ce qui est
précisément la prémisse de `changeRoom`. Corrigé en extrayant le cœur
partagé (`createAssignment`, sans le contrôle "déjà affecté") utilisé par
les deux fonctions publiques, chacune décidant elle-même si ce contrôle
s'applique.

## 5. Service `checkInService.js` — `confirmed → checked_in`

1. Vérifie `reservation.status === 'confirmed'` (409 sinon) et que la
   transition est bien listée dans `HotelReservation.ALLOWED_TRANSITIONS`.
2. Cherche une affectation active existante (`getActiveAssignment`) ; si
   aucune, un `roomId` est requis (422 sinon) et `assignRoom` est appelé
   à la volée — le check-in peut donc affecter une chambre *ou* consommer
   une pré-affectation faite en amont (mission §3-4 vs §5).
3. Transition atomique de la chambre vers `'occupied'` via
   `Room.findOneAndUpdate` avec garde `status: {$in:['available',
   'reserved']}` — si une autre opération a occupé la chambre entre-temps,
   la mise à jour ne matche rien et un 409 propre est renvoyé (jamais de
   double occupation silencieuse).
4. Historise la transition (`statusHistory`), notifie le client
   (`hotel_reservation_checked_in`) si `guestUser` existe.

## 6. Service `checkOutService.js` — `checked_in → checked_out`

1. Vérifie `reservation.status === 'checked_in'` (409 sinon).
2. Libère la chambre via `releaseRoom` avec `nextRoomStatus: 'cleaning'` —
   **jamais `'available'` directement** (mission §6 : une chambre quittée
   passe obligatoirement par le nettoyage). Fonctionne aussi sans
   affectation active (garde défensive, ne casse jamais le check-out).
3. Historise la transition, notifie le client
   (`hotel_reservation_checked_out`).

## 7. Statuts de réservation — extension `ALLOWED_TRANSITIONS`

```
pending     → confirmed, rejected, cancelled, expired
confirmed   → cancelled, checked_in
checked_in  → checked_out                    (jamais annulable une fois arrivé)
checked_out → (terminal)
```

`no_show` reste délibérément absent (comme en Sprint C).

## 8. Contrôleurs et routes

### 8.1 Chambres — `roomController.js`, montées sous `/api/hotels` (mêmes
convention de nesting que `RoomCategory`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/hotels/:hotelId/rooms` | Tableau des chambres, filtres `floor`/`roomCategoryId`/`status`, réservation active attachée (batch anti-N+1) |
| POST | `/hotels/:hotelId/rooms` | Création (409 si numéro déjà pris) |
| PATCH | `/hotels/rooms/:id` | Modification, y compris changement de statut manuel (garde via `ROOM_STATUS_TRANSITIONS`) |
| DELETE | `/hotels/rooms/:id` | Suppression (409 si affectation active) |

### 8.2 Affectation — `roomAssignmentController.js`, montées sous
`/api/hotels` en routes plates (accès résolu via l'hôtel **de la
réservation**, jamais un `:hotelId` d'URL)

| Méthode | Route |
|---|---|
| POST | `/hotels/room-assignments` |
| PATCH | `/hotels/room-assignments/change` |
| PATCH | `/hotels/room-assignments/release` |

### 8.3 Check-in/out — ajoutés à `hotelReservationController.js`/
`hotelReservationRoutes.js` (Sprint C), namespace `/api/hotel-reservations`
puisqu'il s'agit de transitions de statut de réservation

| Méthode | Route |
|---|---|
| PATCH | `/hotel-reservations/:id/check-in` |
| PATCH | `/hotel-reservations/:id/check-out` |

Toutes ces routes sont placées **avant** les routes génériques `/:id/:action`
existantes (convention de routage établie lors de l'audit Sprint C).

## 9. Permissions (mission §13)

- **Propriétaire** : gère uniquement les chambres/affectations des hôtels
  dont il est `manager` (vérifié par `assertHotelAccess`/
  `loadReservationWithAccess`, jamais uniquement côté route).
- **Staff** (`STAFF_ROLES`) : accès complet, matrice existante inchangée.
- **Client (guest)** : **ne peut jamais** affecter, changer, check-in ou
  check-out lui-même — `assertReservationAccess` renvoie `role: 'guest'`
  pour son propre compte, et ce rôle est explicitement exclu de ces
  actions (même garde que `confirm`/`reject`, Sprint C). Le client ne
  choisit jamais son numéro de chambre.

## 10. Notifications et journalisation

Notifications (`notificationService.notify`, signature inchangée) :
`hotel_room_assigned`, `hotel_room_changed`, `hotel_reservation_checked_in`,
`hotel_reservation_checked_out`. Toutes échouent silencieusement
(`.catch(() => {})`) sans jamais faire échouer l'opération principale —
convention systématique du projet.

Journalisation (`actionLogService.logAction`) sur : création/suppression de
chambre, affectation, changement, libération, check-in, check-out.

## 11. Numéro de chambre côté client (mission §11)

Le client ne voit son numéro de chambre **qu'après le check-in**, jamais
avant, même si une chambre a été pré-affectée en amont. Implémenté côté
serveur (`attachRoomNumberIfCheckedIn`, `hotelReservationController.js`) :
n'attache `reservation.room = {roomNumber}` que pour les réservations dont
`status === 'checked_in'`, appliqué aux endpoints `GET /hotel-reservations/
mine` et `GET /hotel-reservations/:id`.

## 12. Tableaux de bord

- **Dashboard Hôtel → Chambres** (`RoomsPage.jsx`,
  `/dashboard/hotels/[hotelId]/rooms`) : tableau (numéro, étage, catégorie,
  statut, réservation, client) avec filtres étage/catégorie/statut, création
  de chambre, changement de statut manuel (respectant les transitions),
  suppression. Bascule vers un **plan d'étage** simple (mission §9) : liste
  groupée par étage (`Étage 1 : 101, 102...`), sans plan graphique.
- **Dashboard Réservations** (propriétaire `MyHotelReservationsPage.jsx` et
  admin `AdminHotelReservationsPage.jsx`) : composant partagé
  `RoomAssignmentPanel.jsx` ajoutant, pour les réservations `confirmed`/
  `checked_in` : Affecter chambre, Changer chambre, Check-in, Check-out,
  affichage de la chambre affectée après action.
- **Dashboard Admin → Chambres (vue globale)**
  (`AdminRoomsOverviewPage.jsx`, `/dashboard/hotel-rooms`, mission §18) :
  compteurs cliquables par statut (libre/occupée/nettoyage/inspection/
  réservée/hors service), liste filtrable tous établissements confondus.

**Limite connue** : il n'existe pas d'endpoint de lecture dédié "chambre
actuellement affectée à cette réservation" (l'API Sprint D n'expose que des
actions, voir mission §12). `RoomAssignmentPanel` n'affiche donc le numéro
de chambre qu'immédiatement après une action effectuée dans la session en
cours (affecter/changer/check-in) — pas rechargé automatiquement à
l'ouverture de la page. Acceptable pour cette v1 ; un endpoint de lecture
pourrait être ajouté en Sprint E si le besoin se confirme.

## 13. Index (mission §16)

`Room` : `{hotel:1, roomNumber:1}` unique, `{status:1}`.
`RoomAssignment` : `{room:1}` unique partiel, `{reservation:1}` unique
partiel.

## 14. Tests

- **Modèles** : `roomModel.test.js` (13 tests — défauts, champs requis,
  enum de statut sans `maintenance`, index, transitions), 
  `roomAssignmentModel.test.js` (13 tests — champs requis, défauts, les
  deux index uniques partiels).
- **Service d'affectation** : `roomAssignmentService.test.js` (13 tests) —
  cas nominaux, rejets (autre hôtel/catégorie/chambre occupée/déjà
  affectée), **concurrence** (`Promise.allSettled` : deux affectations
  simultanées de la même chambre → une seule réussit ; deux affectations
  simultanées de la même réservation → une seule réussit), ordre
  affecter-puis-libérer de `changeRoom`, échec de `changeRoom` laissant
  l'ancienne affectation intacte, `releaseRoom`/`getAvailableRooms`.
- **Check-in/check-out** : `checkInOutService.test.js` (10 tests) —
  check-in avec chambre pré-affectée, check-in avec affectation à la volée,
  422 sans chambre disponible, 409 hors statut `confirmed`, 409 sur perte de
  course (chambre occupée entre-temps), historisation ; check-out libère en
  `cleaning` (jamais `available`), 409 hors statut `checked_in`, robustesse
  sans affectation active, historisation.
- **Routes/permissions HTTP** : `hotelOperationsRoutes.test.js` (23 tests)
  — CRUD chambres avec ownership, 409 numéro dupliqué, 409 suppression
  d'une chambre affectée, affectation/changement/libération avec rejets
  403 (tiers, client), check-in/check-out avec rejets 403 (client, tiers) et
  409 (transition invalide), 401 sans jeton.
- **Numéro de chambre après check-in** : ajout à
  `hotelReservationRoutes.test.js` (2 tests) et
  `MesReservationsHotelPage.test.jsx` (2 tests côté client).
- **Client** : `RoomsPage.test.jsx` (7 tests), `RoomAssignmentPanel.test.jsx`
  (6 tests), `AdminRoomsOverviewPage.test.jsx` (2 tests), mises à jour de
  `MyHotelReservationsPage.test.jsx`/`AdminHotelReservationsPage.test.jsx`
  (mocks étendus pour les nouveaux imports).

**Résultats mesurés** : suite serveur complète — 54 suites, 642 tests, tous
verts. Suite client complète — 39 fichiers, 255 tests, tous verts.

## 15. Limites (mission §20, avant Sprint E)

Volontairement **absents** de ce sprint : ménage automatique, maintenance,
minibar, facturation, paiement, OTA/Channel Manager, clés électroniques,
application mobile spécifique. `Room` et `RoomInventory` restent découplés
(§1.3). Une réservation a au plus une chambre (multi-chambre hors
périmètre, désormais **bloqué explicitement** — voir §17.3 ci-dessous, plus
uniquement "non implémenté").

## 16. Diagramme

```
Hotel ──▶ RoomCategory ──▶ Room ──▶ RoomAssignment ──▶ HotelReservation
  │             │                        ▲                    │
  │             └──▶ RatePlan            └────────────────────┘
  └──▶ RoomInventory (Sprint C, découplé de Room — voir §1.3)
```

---

## 17. CORRECTIF FINAL (post-Sprint D) — affectation persistante et cohérence multi-chambres

Mission de contrôle qui n'ajoute **aucune fonctionnalité métier** — uniquement
des corrections d'anomalies réellement constatées à l'audit ciblé, et des
garde-fous explicites là où le comportement existant était correct mais non
prouvé par des tests dédiés.

### 17.1 Audit ciblé — constats

- **Anomalie réelle n°1 (affectation persistante)** : `RoomAssignmentPanel.jsx`
  ne stockait le numéro de chambre affectée qu'en état React local, mis à
  jour uniquement après une action (`assignRoom`/`changeRoom`/`checkIn`)
  effectuée dans la session en cours. Aucune route ne permettait de relire
  l'affectation active d'une réservation — après un rechargement de page,
  l'information disparaissait entièrement (déjà documenté comme limite
  connue en fin de Sprint D, jamais corrigé).
- **Anomalie réelle n°2 (chambre orpheline sur annulation)** :
  `hotelReservationService.transitionStatus` libérait l'inventaire abstrait
  (`RoomInventory`, Sprint C) lors d'une transition vers `cancelled`/
  `rejected`/`expired`, mais ne libérait **jamais** une éventuelle
  `RoomAssignment` active liée à cette réservation. Une chambre pré-affectée
  avant confirmation, puis dont la réservation était annulée, restait
  `reserved` indéfiniment — jamais reproposée, jamais visible comme
  disponible, sans qu'aucune action ne permette de le corriger autrement
  qu'une intervention manuelle sur la chambre elle-même.
- **Anomalie réelle n°3 (chambre désactivée visible dans le sélecteur
  d'affectation)** : `roomController.list` (utilisé à la fois par le tableau
  de bord "Chambres" et par le sélecteur de `RoomAssignmentPanel`) ignorait
  totalement le champ `active` — une chambre désactivée avec un statut
  `available` restait proposable à l'affectation.
- **Anomalie réelle n°4 (suppression physique avec historique)** :
  `roomController.remove` bloquait la suppression si une affectation était
  *active*, mais supprimait physiquement une chambre ayant un historique
  d'affectations entièrement *libérées* — perte silencieuse de l'historique
  (`RoomAssignment` orphelines de leur `Room`).
- **Points audités et confirmés déjà corrects** (aucune modification) :
  cohérence hôtel/catégorie dans `createAssignment` (§4 du correctif — déjà
  strictement vérifiée, `room.hotel`/`room.roomCategory` comparés à
  `reservation.hotel`/`reservation.roomCategory`, jamais fiée aux seuls
  identifiants transmis) ; protection anti-concurrence par index unique
  partiel + compensation (§5 — déjà atomique, pas de fenêtre `find` puis
  `create` non protégée) ; table des transitions de statut de `Room` (§7 —
  déjà complète et correcte, `occupied → available` toujours interdit sans
  passer par `cleaning`).

### 17.2 Affectation persistante — stratégie retenue

**Option A (endpoint dédié)** retenue plutôt que la projection interne
(Option B) : `GET /api/hotel-reservations/:id/room-assignment`
(`hotelReservationController.getRoomAssignment`), réutilisant
`roomAssignmentService.getActiveAssignment` (déjà existant, aucune nouvelle
requête DB inventée) et le même `assertReservationAccess` que le reste du
contrôleur. Choisie plutôt que la projection en liste (Option B) car
`RoomAssignmentPanel` est rendu **par réservation** (jamais en liste), et
une projection sur `mine`/`ownerList`/`listAdmin` aurait réintroduit un N+1
sur des endpoints déjà optimisés — un endpoint dédié, appelé un par un
depuis chaque panneau au montage, est la surface la plus proche de l'usage
réel et n'alourdit aucune route existante.

Projection minimale renvoyée (`activeRoomAssignment`) :
```
{ id, room: { id, roomNumber, floor, status, roomCategory }, assignedAt }
```
Jamais `assignedBy`, `reason`, ni aucun champ de `Room.notes`.

**Permissions** (identiques à `assertReservationAccess`, réutilisées telles
quelles) : propriétaire de l'hôtel et staff reçoivent toujours l'affectation
si elle existe ; le client (rôle `guest`) reçoit `activeRoomAssignment: null`
**sans même interroger la base** tant que `reservation.status !==
'checked_in'` (jamais un 403 — la réservation lui appartient, seule
l'information "chambre" lui est masquée, cohérent avec `getOne`/`mine` déjà
en place) ; un tiers reçoit 403 comme partout ailleurs dans ce contrôleur.

**Frontend** : `RoomAssignmentPanel.jsx` charge l'affectation via
`useEffect` au montage (`getReservationRoomAssignment`), affiche un état de
chargement (`"Chargement de l'affectation..."`), puis appelle la même
fonction de rafraîchissement (`refresh()`) après affecter/changer/check-in/
check-out — plus aucune dépendance à une valeur locale devinée depuis la
réponse d'une action. Le sélecteur de chambres disponibles appelle
désormais `getRooms(hotelId, {roomCategoryId, status:'available',
active:true})` (correctif anomalie n°3).

### 17.3 Garde-fou multi-chambres (`roomsCount !== 1`)

`roomAssignmentService.assertSingleRoom(reservation)` — fonction exportée,
appelée par `createAssignment` (donc par `assignRoom` **et** `changeRoom`)
et explicitement par `checkInService.performCheckIn` (qui ne passe pas
toujours par `createAssignment`, une affectation pouvant déjà exister).
Rejette avec **409** (convention dominante du fichier pour les conflits
d'état métier, cohérente avec "chambre déjà affectée") et le message exact
demandé : *"Cette réservation comporte plusieurs chambres et nécessite une
affectation multiple, non encore prise en charge."* Aucune modification de
`createReservation`/`updateReservation` (Sprint C) — `roomsCount` n'est
jamais forcé à 1, jamais plusieurs `RoomAssignment` créés. Le frontend
(`RoomAssignmentPanel`) reflète ce même garde-fou côté UI (bandeau
d'avertissement, boutons Affecter/Check-in masqués) — défense en profondeur,
le backend reste la seule source de vérité.

### 17.4 Cohérence hôtel/catégorie

Confirmée déjà correcte à l'audit (§17.1) — aucune modification de code,
seulement des tests supplémentaires validant explicitement les 4 scénarios
demandés (chambre d'un autre hôtel/d'une autre catégorie refusée, chambre
correcte acceptée, tentative propriétaire sur hôtel tiers refusée — déjà
couverte au niveau route par `hotelOperationsRoutes.test.js`).

### 17.5 Chevauchement des périodes

**Décision d'architecture explicite** (documentée pour éviter toute
ambiguïté future) : ce sprint ne compare **pas** de dates entre affectations
— il garantit une invariante strictement plus forte et suffisante pour
éliminer tout chevauchement : *une chambre ne peut avoir qu'une seule
affectation active à la fois, quelles que soient les dates des réservations
concernées* (index unique partiel `{room, releasedAt:null}`, inchangé).
Deux réservations aux périodes chevauchantes, incluses l'une dans l'autre,
ou identiques, ne peuvent donc **jamais** obtenir simultanément une
affectation active sur la même chambre — le chevauchement est
structurellement impossible avant même qu'une comparaison de dates soit
nécessaire. Le scénario "départ et arrivée le même jour" fonctionne par la
séquence normale libération (check-out/annulation) → nouvelle affectation,
déjà supportée. **Limite assumée** : cette conception interdit aussi de
*pré-affecter à l'avance* une chambre à une réservation future tant que
l'occupant actuel n'a pas explicitement libéré la chambre (check-out ou
annulation) — même si les dates ne se chevauchent pas réellement. Corriger
cela nécessiterait de dater chaque `RoomAssignment` et un contrôle de
chevauchement par plage (avec la même stratégie de compensation
non-transactionnelle que `hotelAvailabilityService`) — **hors périmètre de
ce correctif** (scope : "ne pas créer multi-room assignment", et cette
extension n'a pas été demandée explicitement), candidate documentée pour le
Sprint E si le besoin se confirme.

Le correctif n°2 (§17.1) s'inscrit dans cette même logique : sans lui, une
chambre annulée avant check-in restait à tort "active" indéfiniment, ce qui
aurait fini par ressembler à un chevauchement empêchant toute réaffectation
légitime. `transitionStatus` appelle désormais
`roomAssignmentService.releaseRoom` (capturant silencieusement le 404 "rien
à libérer", cas normal) lors de toute transition vers `cancelled`/
`rejected`/`expired` — ces trois statuts ne sont atteignables que depuis un
état pré-`checked_in` (voir `ALLOWED_TRANSITIONS`), donc l'affectation
libérée n'a jamais été occupée : libération directe vers `'available'`,
jamais `'cleaning'`.

### 17.6 Suppression et archivage des chambres

`roomController.remove` étend son ordre de vérification (aucun changement
de comportement pour les cas déjà corrects) :
1. 409 si une `RoomAssignment` active existe (inchangé).
2. 409 si `room.status === 'occupied'` (garde défensive ajoutée — ne dépend
   plus uniquement de la présence d'un document `RoomAssignment` actif).
3. **Nouveau** : si un historique `RoomAssignment` existe (actif ou non,
   `RoomAssignment.exists({room})`), la chambre est **archivée**
   (`active = false`, `updatedBy`, `logAction`) plutôt que supprimée —
   l'historique reste indéfiniment consultable, aucune cascade de
   suppression sur `RoomAssignment`.
4. Suppression physique réservée aux chambres sans aucun historique
   (comportement déjà en vigueur, inchangé).

Une chambre archivée (`active:false`) n'apparaît plus dans le sélecteur
d'affectation (`active:true` désormais transmis par
`RoomAssignmentPanel`), mais reste visible dans le tableau de bord
"Chambres" (`RoomsPage`, qui ne transmet jamais ce filtre) pour permettre sa
réactivation.

### 17.7 Tests ajoutés (résumé)

| Fichier | Ajouts |
|---|---|
| `roomAssignmentService.test.js` | +10 tests : garde-fou multi-chambres (4), chevauchement des périodes (6, dont concurrence et `changeRoom`) |
| `checkInOutService.test.js` | +2 tests : câblage du garde-fou multi-chambres (appel + propagation d'erreur) |
| `hotelReservationService.test.js` | +4 tests : libération de la chambre sur cancel/reject/expired, non-régression sans chambre affectée, erreur non-404 remontée |
| `hotelReservationExpiryService.test.js` | mock `roomAssignmentService` ajouté (régression corrigée, voir §17.8) |
| `hotelOperationsRoutes.test.js` | +11 tests : suppression/archivage (3), filtre `active` sur la liste (2), endpoint `GET /:id/room-assignment` (6 — propriétaire, staff, client avant/après check-in, tiers 403, 404, `null`) |
| `RoomAssignmentPanel.test.jsx` (client) | Réécrit : chargement au montage, persistance après remontage, rafraîchissement post-action (affecter/changer/check-in/check-out), garde-fou multi-chambres, filtre `active` du sélecteur |
| `RoomsPage.test.jsx` (client) | +1 test : confirmation qu'aucun filtre `active` n'est envoyé par le tableau de bord |

**Concurrence exécutée séparément** :
```
npx jest roomAssignmentService.test.js
```
→ 23/23 tests verts, incluant les 2 tests de concurrence historiques
(double affectation même chambre / même réservation) et le nouveau test de
concurrence sur périodes différentes (§17.5).

### 17.8 Régression détectée et corrigée pendant ce correctif

L'ajout de `releaseRoom` dans `hotelReservationService.transitionStatus`
(§17.5) a fait échouer `hotelReservationExpiryService.test.js` (2 tests) :
ce fichier n'important pas de mock pour `roomAssignmentService`, l'appel
réel à `RoomAssignment.findOne` (modèle non mocké) échouait silencieusement
et l'erreur était absorbée par la boucle `try/catch` du job d'expiration,
faisant chuter `result.expired` à `0`. Corrigé en ajoutant
`jest.mock('../services/roomAssignmentService', () => ({releaseRoom:
jest.fn()}))` et un mock par défaut résolvant un 404 (« rien à libérer »).
Aucune régression de production — uniquement un test insuffisamment isolé,
détecté par l'exécution complète de la suite avant validation finale.

### 17.9 Limites restantes (avant Sprint E)

- Pas de pré-affectation à l'avance sur une chambre déjà couverte par une
  affectation active, même si les dates réelles ne se chevauchent pas
  (§17.5) — nécessiterait de dater `RoomAssignment` et un contrôle de
  chevauchement par plage.
- Multi-chambres toujours non implémenté, désormais bloqué explicitement
  (409) plutôt que silencieusement incohérent.
- `Room` et `RoomInventory` toujours découplés (§1.3, inchangé).
- Ménage automatique, maintenance, minibar, facturation, paiement, OTA/
  Channel Manager, clés électroniques : toujours hors périmètre.
