# Opérations hôtelières v2 (Sprint E) — housekeeping, inspection, maintenance

> État de certification et limites de recette C/D.1.1 :
> voir [SPRINT_CD11_CERTIFICATION.md](./SPRINT_CD11_CERTIFICATION.md).

**Statut : Sprint E — moteur opérationnel d'exploitation des chambres.**
Ferme la boucle ouverte par le Sprint D : après un check-out,
`Room.status = 'cleaning'` restait un cul-de-sac — aucun mécanisme ne
ramenait la chambre dans le stock exploitable. Ce sprint ajoute le cycle
complet `cleaning → inspection → available`, avec sortie de service
(`out_of_service`) et retour via maintenance. **Aucune facturation, aucun
paiement, aucun minibar, aucune clé électronique, aucun OTA/Channel
Manager, aucune application mobile housekeeping, aucune planification RH,
aucune maintenance préventive, aucun achat** — hors périmètre, voir §11.

---

## 1. Audit initial

### 1.1 Comment une chambre passait à `cleaning` (avant ce sprint)

`checkOutService.performCheckOut` (Sprint D) transitionne la chambre via
`roomAssignmentService.releaseRoom({..., nextRoomStatus: 'cleaning'})` —
seul chemin qui met une chambre à `cleaning`. Une fois là, **rien** dans le
codebase ne la faisait avancer : `Room.ROOM_STATUS_TRANSITIONS.cleaning`
autorisait déjà `→ inspection`, mais aucun service ne déclenchait cette
transition — elle restait accessible uniquement via `roomController.update`
(changement de statut manuel par le staff, Sprint D). Aucune notion de
tâche de ménage, d'inspection ou de ticket de maintenance n'existait.

### 1.2 Notifications existantes (réutilisées telles quelles)

`notificationService.notify()`/`notifyStaff()` — signature inchangée,
reprise à l'identique pour les 7 notifications de ce sprint (§13). Ajout de
9 entrées dans `USER_LINKS`/`STAFF_LINKS` — aucune modification du service
lui-même.

### 1.3 Décisions d'architecture

- **`open` dérivé sur `HousekeepingTask`** : un partialFilterExpression
  MongoDB ne supporte que `$eq/$exists/$gt/$gte/$lt/$lte/$type/$and` — pas
  `$in`. Impossible d'exprimer directement "un des statuts pending/
  assigned/in_progress" dans un index partiel. Solution : un champ booléen
  `open` (vrai tant que le statut n'est pas `completed`/`cancelled`),
  maintenu exclusivement par `housekeepingService`, jamais modifié
  ailleurs — permet `partialFilterExpression: {open: true}` (comparaison
  `$eq` implicite, supportée). Même philosophie que le choix `$type:'null'`
  pour `RoomAssignment.releasedAt` (Sprint D).
- **`RoomInspection.result` nullable** : le champ n'est renseigné qu'après
  `approveInspection`/`rejectInspection` — `createInspection` (POST) crée
  une inspection "en attente de décision" (`result: null`), cohérent avec
  l'API REST donnée (POST crée la ressource, PATCH /:id/approve|reject la
  tranche). N'enfreint pas "Result : prévoir passed/failed" — ce sont les
  deux seules valeurs *possibles* une fois la décision rendue.
  Cette conception a un corrolaire direct sur les compteurs "en cours" et
  la relation avec `HousekeepingTask`, voir §5.
- **`MaintenanceTicket` jamais auto-généré** : contrairement à
  `HousekeepingTask` (auto-créée au check-out), un ticket de maintenance
  est toujours ouvert manuellement par le staff après une inspection
  échouée — la catégorie et la description exactes du problème ne sont pas
  déductibles automatiquement d'un simple `result: 'failed'`. `inspection`
  fait uniquement le lien de traçabilité.
- **`out_of_service → available` désormais interdit** (mission §9) :
  auparavant `Room.ROOM_STATUS_TRANSITIONS.out_of_service = ['available']`.
  Remplacé par `['inspection']` — seule une inspection réussie
  (`approveInspection`) ramène une chambre hors service à `available`.
  `inspection → out_of_service` reste inchangé (inspection échouée).

## 2. Modèles

### 2.1 `HousekeepingTask` (`server/models/HousekeepingTask.js`)

| Champ | Type | Notes |
|---|---|---|
| `room` / `hotel` | ObjectId | requis |
| `reservation` | ObjectId → HotelReservation | `null` pour une tâche manuelle |
| `type` | enum `checkout_cleaning`/`refresh`/`deep_cleaning` | requis |
| `priority` | enum `low`/`normal`/`high`/`urgent` | défaut `normal` |
| `status` | enum `pending`/`assigned`/`in_progress`/`completed`/`cancelled` | défaut `pending` |
| `open` | Boolean dérivé | défaut `true`, voir §1.3 |
| `assignedTo` | ObjectId → User | défaut `null` |
| `notes`, `startedAt`, `completedAt` | | |
| `createdBy`/`updatedBy` | ObjectId → User | |

Transitions (`HousekeepingTask.HOUSEKEEPING_STATUS_TRANSITIONS`) :
```
pending → assigned, in_progress, cancelled
assigned → in_progress, cancelled
in_progress → completed, cancelled
completed / cancelled → (terminal)
```
Index : `{room:1}` unique partiel (`open:true`) — anti double-tâche
ouverte (mission §3) ; `{status:1}` ; `{hotel:1, status:1}`.

### 2.2 `RoomInspection` (`server/models/RoomInspection.js`)

| Champ | Type | Notes |
|---|---|---|
| `room` | ObjectId → Room | requis |
| `housekeepingTask` | ObjectId → HousekeepingTask | requis (réutilisé pour une ré-inspection post-maintenance, §5) |
| `inspector` | ObjectId → User | requis |
| `result` | enum `passed`/`failed`, nullable | `null` = en attente |
| `notes`, `inspectedAt` | | |

Index : `{room:1}`, `{housekeepingTask:1}`.

### 2.3 `MaintenanceTicket` (`server/models/MaintenanceTicket.js`)

| Champ | Type | Notes |
|---|---|---|
| `room` / `hotel` | ObjectId | requis |
| `inspection` | ObjectId → RoomInspection | défaut `null` |
| `category` | enum `plumbing`/`electricity`/`furniture`/`cleanliness`/`security`/`other` | requis |
| `priority` | enum `low`/`normal`/`high`/`urgent` | défaut `normal` |
| `status` | enum `open`/`assigned`/`in_progress`/`resolved`/`closed` | défaut `open` |
| `description` | String | requis |
| `assignedTo`, `resolvedAt`, `createdBy`, `updatedBy` | | |

Transitions (`MaintenanceTicket.MAINTENANCE_STATUS_TRANSITIONS`) :
```
open → assigned, in_progress, resolved
assigned → in_progress, resolved
in_progress → resolved
resolved → closed
closed → (terminal)
```
`OPEN_MAINTENANCE_STATUSES = [open, assigned, in_progress]` — utilisé par
`inspectionService.approveInspection` (mission §8). Index : `{room:1}`,
`{status:1}`, `{hotel:1, status:1}`.

## 3. Génération automatique (mission §3)

`checkOutService.performCheckOut` appelle désormais
`housekeepingService.createTask({..., type:'checkout_cleaning',
priority:'normal'})` juste après avoir libéré la chambre vers `'cleaning'`.
Un 409 (tâche déjà ouverte, cas de relance/double-appel) est absorbé
silencieusement — le check-out ne doit jamais échouer à cause d'une tâche
de ménage préexistante ; toute autre erreur remonte normalement.

## 4. `housekeepingService.js`

- **`createTask`** — crée la tâche ; E11000 (index unique partiel) → 409
  "Une tâche de ménage est déjà ouverte pour cette chambre." ; notifie le
  staff (`housekeeping_task_created`).
- **`assignTask`** — `pending → assigned` ou réaffectation (`assigned →
  assigned` avec un nouvel `assignedTo`, pas un changement de statut) ;
  notifie individuellement l'employé assigné.
- **`startTask`** — `→ in_progress`, `startedAt` renseigné.
- **`completeTask`** — **le pont central du sprint** : `→ completed`,
  `open:false`, `completedAt` renseigné, ET transition atomique de la
  chambre `Room.findOneAndUpdate({_id, status:'cleaning'}, {$set:{status:
  'inspection'}})` — c'est ce qui répond à l'objectif "faire revenir cette
  chambre dans le stock exploitable". Notifie le staff.
- **`cancelTask`** — `→ cancelled`, `open:false`. Ne touche jamais au
  statut de la chambre (hors périmètre : annuler une tâche ne signifie pas
  que la chambre change d'état).

## 5. `inspectionService.js`

- **`createInspection`** — si `room.status === 'out_of_service'`, transition
  atomique `out_of_service → inspection` (ré-inspection post-maintenance,
  mission §9) puis crée l'inspection ; si `room.status === 'inspection'`
  (cas normal post-ménage), crée directement ; sinon 409. `result: null` à
  la création.
- **`approveInspection`** — 409 si déjà tranchée ; **vérifie d'abord qu'aucun
  ticket de maintenance ouvert n'existe pour la chambre** (mission §8,
  `MaintenanceTicket.OPEN_MAINTENANCE_STATUSES`) ; transition atomique de la
  chambre `inspection → available` EN PREMIER (si elle échoue — course
  perdue — l'inspection n'est jamais marquée "passed" à tort) ; puis
  `result: 'passed'`. Notifie le staff (`room_returned_to_service`).
- **`rejectInspection`** — même garde d'ordre (chambre d'abord), transition
  `inspection → out_of_service`, `result: 'failed'`. Notifie le staff
  (`room_inspection_failed`).

## 6. `maintenanceService.js`

`createTicket` (notifie le staff), `assignTicket` (réaffectation possible,
notifie l'individu), `startWork`, `resolveTicket` (`resolvedAt`, notifie le
staff — "la chambre peut être ré-inspectée"), `closeTicket` (clôture
administrative, `resolved → closed`). Aucune de ces fonctions ne touche au
statut de la chambre — celui-ci ne change que via `inspectionService`
(mission §8 : le retour en service passe TOUJOURS par une inspection
réussie, jamais directement à la résolution du ticket).

## 7. Contrôleurs et routes

Ownership : même convention que Sprint D (`assertHotelAccess`, propriétaire
= `hotel.manager`, ou staff `STAFF_ROLES`). Un client n'est jamais
`hotel.manager` — il ne franchit donc jamais cette garde (mission §14),
même mécanisme que `roomController`/`roomAssignmentController`.

| Méthode | Route | Contrôleur |
|---|---|---|
| GET | `/api/housekeeping` | liste filtrable hotelId/status/priority |
| POST | `/api/housekeeping` | création |
| PATCH | `/api/housekeeping/:id/assign` | |
| PATCH | `/api/housekeeping/:id/start` | |
| PATCH | `/api/housekeeping/:id/complete` | |
| PATCH | `/api/housekeeping/:id/cancel` | |
| POST | `/api/inspections` | création (result: null) |
| PATCH | `/api/inspections/:id/approve` | |
| PATCH | `/api/inspections/:id/reject` | |
| GET | `/api/maintenance` | liste filtrable hotelId/status/priority/category |
| POST | `/api/maintenance` | création |
| PATCH | `/api/maintenance/:id/assign` | |
| PATCH | `/api/maintenance/:id/start` | |
| PATCH | `/api/maintenance/:id/resolve` | |
| PATCH | `/api/maintenance/:id/close` | |

Les endpoints GET liste et `:id/assign` ne figuraient pas dans l'exemple
donné par la mission (§15) mais sont strictement nécessaires aux dashboards
(§10-11) et à la fonction `assignTask`/`assignTicket` déjà exigée par les
services (§4/§8) — ajoutés en respectant les conventions REST existantes,
pas une extension de périmètre métier.

## 8. Dashboards

- **`/dashboard/housekeeping`** (`HousekeepingDashboardPage.jsx`) — tableau
  chambre/hôtel/type/priorité/statut/employé/heure, filtres hôtel (ID)/
  statut/priorité. Actions : assigner, démarrer, terminer, annuler. Pour
  une tâche `completed`, un bouton "Inspecter" crée l'inspection puis
  affiche Approuver/Rejeter — referme la boucle ménage → inspection sans
  changer de page.
- **`/dashboard/maintenance`** (`MaintenanceDashboardPage.jsx`) — tableau
  chambre/catégorie/priorité/technicien/statut, filtres hôtel/statut/
  priorité/catégorie. Actions : assigner, démarrer, résoudre, clôturer.
  Pour un ticket `resolved`, un bouton "Ré-inspecter" réutilise
  `ticket.inspection.housekeepingTask` (populate à deux niveaux côté
  contrôleur) pour créer la ré-inspection sans redemander l'ID à
  l'utilisateur, puis Approuver/Rejeter.
- **Fiche établissement** (`HotelDetailPage.jsx`, mission §12) — compteurs
  disponibles/occupées/nettoyage/inspection/hors service, calculés côté
  client à partir de `GET /hotels/:hotelId/rooms` (déjà existant, Sprint D)
  — aucun nouvel endpoint agrégé, cohérent avec "créer uniquement les
  endpoints nécessaires".

## 9. Notifications (mission §13)

| Type | Déclenchée par | Destinataire |
|---|---|---|
| `housekeeping_task_created` | `createTask` | staff |
| `housekeeping_task_assigned` | `assignTask` | employé assigné |
| `housekeeping_task_completed` | `completeTask` | staff |
| `room_inspection_failed` | `rejectInspection` | staff |
| `maintenance_ticket_created` | `createTicket` | staff |
| `maintenance_ticket_assigned` | `assignTicket` | technicien assigné |
| `maintenance_ticket_resolved` | `resolveTicket` | staff |
| `room_returned_to_service` | `approveInspection` | staff |

## 10. Tests

- **Modèles** : `housekeepingTaskModel.test.js` (12), `roomInspectionModel.test.js`
  (5), `maintenanceTicketModel.test.js` (10) — défauts, champs requis, enums,
  index (dont l'index unique partiel `{room, open:true}`), tables de
  transitions. `roomModel.test.js` étendu (+3) pour la nouvelle règle
  `out_of_service → inspection` uniquement.
- **Services** : `housekeepingService.test.js` (14, dont 2 tests de
  concurrence `Promise.allSettled` prouvant l'absence de double tâche
  ouverte), `inspectionService.test.js` (12, dont la garde "ticket ouvert"
  et l'ordre chambre-avant-inspection), `maintenanceService.test.js` (10).
- **Intégration check-out** : `checkInOutService.test.js` étendu (+4) —
  câblage `createTask`, absorption du 409, propagation des autres erreurs,
  aucun appel si pas de chambre affectée.
- **Routes/permissions** : `housekeepingMaintenanceRoutes.test.js` (31) —
  CRUD + transitions des 3 ressources, rejets 403 (tiers, client), 422
  (type/catégorie/description invalides), 409 (tâche déjà ouverte,
  transition invalide, ticket ouvert bloquant), 401 sans jeton.
- **Client** : `HousekeepingDashboardPage.test.jsx` (9),
  `MaintenanceDashboardPage.test.jsx` (8), `HotelDetailPage.test.jsx` (3,
  compteurs).

**Résultats mesurés** : serveur — 61 suites, 766 tests, tous verts. Client
— 42 fichiers, 281 tests, tous verts.

## 11. Limites (avant les sprints suivants)

Volontairement absents : facturation, paiement, minibar, clés
électroniques, OTA/Channel Manager, application mobile housekeeping/
gouvernante, planning du personnel, maintenance préventive, achats. Le
moteur de réservation, l'inventaire, le check-in et le check-out du
Sprint D ne sont pas modifiés au-delà de l'intégration strictement
nécessaire (génération automatique de la tâche de ménage au check-out).
`Room` et `RoomInventory` restent découplés (Sprint D, §1.3 de
HOTEL_OPERATIONS_V1.md, inchangé).

## 13. Addendum C/D.1 — inventaire physique et commercial

`RoomInventory` demeure le stock commercial daté. `Room` demeure l'unité
physique. Une chambre `out_of_service` alimente désormais
`physicalBlockedUnits`, séparé du blocage manuel `blockedUnits`, afin de ne
pas détruire la capacité nominale. Le rejet d'inspection bloque le stock et
la validation qui suit un hors-service le restitue.

Le calendrier Web fournit semaine/mois, filtres, réservations, états
d'affectation, arrivées/départs et actions d'inventaire. Le Mobile fournit le
parcours client et une exploitation propriétaire simplifiée (affectation
manuelle/automatique, changement, check-in/out et stop-sell).

## 12. Diagramme

```
Room ──▶ HousekeepingTask ──▶ RoomInspection ──▶ MaintenanceTicket
  ▲                                  │                    │
  │                                  ▼                    │
  └────────── Room.status : cleaning → inspection ────────┘
                    (passed → available · failed → out_of_service)
```
