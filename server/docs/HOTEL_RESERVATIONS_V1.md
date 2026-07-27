# Réservations hôtelières v1 (Sprint C) — inventaire et disponibilités

> Finalisation C/D.1.1, parcours Mobile public et preuves de certification :
> voir [SPRINT_CD11_CERTIFICATION.md](./SPRINT_CD11_CERTIFICATION.md).

**Statut : Sprint C — moteur initial de réservation.** Disponibilité par
catégorie, création/modification/annulation, prévention du surbooking,
expiration des demandes non confirmées. **Aucune chambre physique, aucun
check-in/check-out, aucune facture, aucun paiement en ligne** — voir §14
(hors périmètre) et le futur Sprint D.

---

## 1. Audit initial

### 1.1 État avant ce sprint

`Hotel` → `RoomCategory` → `RatePlan` (Sprint B2) formaient déjà la chaîne
établissement/catégorie/tarif, mais **aucune notion de disponibilité,
d'inventaire ni de réservation n'existait** : `RoomCategory.unitsAvailable`
était un simple compteur informatif jamais consommé par une logique de
stock. Les routes Hôtel (`hotelRoutes.js`) et les dashboards (Établissements,
Mes hôtels, Modération Hôtellerie) étaient opérationnels et inchangés par
ce sprint.

### 1.2 Services de notification/journalisation (réutilisés tels quels)

`notificationService.notify()`/`notifyStaff()` acceptent déjà `{recipient,
type, title, body|message, data|metadata}` — signature reprise à l'identique
pour les 5 notifications de ce sprint (aucune modification du service).
`actionLogService.logAction()`/`buildAuteur()` — même convention que tous
les contrôleurs existants.

### 1.3 Transactions MongoDB — absence confirmée

Recherche exhaustive (`grep -rn "startSession\|withTransaction"`) : **aucun
précédent** dans ce codebase, et aucune garantie que l'infrastructure
MongoDB de ce projet tourne en replica set (prérequis strict de
`session.startTransaction()`). `propertyTransactionService.js` documente
déjà ce choix pour Property+satellites via un pattern de compensation
applicative — **la même philosophie est reprise ici** (voir §5).

### 1.4 Cron existant (réutilisé prudemment)

`server.js` exécute déjà `visiteAutomationService.processVisitAutomation()`
toutes les 5 minutes pour expirer des demandes de visite non confirmées —
pattern directement répliqué pour `hotelReservationExpiryService` (même
fréquence, même structure `cron.schedule('*/5 * * * *', ...)`, fonction pure
acceptant `now` en paramètre pour rester testable sans horloge système).

### 1.5 Numérotation — `mongoose-sequence`

Déjà utilisé par `Document.js` (`docNumber`) pour un compteur atomique
DB-backed — repris à l'identique pour `HotelReservation.sequenceNumber`,
transformé en référence lisible `RES-AAAA-NNNNNN` par une fonction **pure**
(`buildReservationReference`, testable sans DB) appliquée en `pre('save')`.

### 1.6 Risques de concurrence identifiés

Le risque central : deux requêtes simultanées vérifiant puis réservant le
même stock ("check-then-act") sans protection atomique. Confirmé comme LE
point critique du sprint — voir §5.

### 1.7 Incompatibilités avec l'existant

Aucune. `HotelReservation`/`RoomInventory` sont des modèles entièrement
nouveaux, sans impact sur `Accommodation`, `SaleManagement`,
`RentalManagement` ou la Gestion Locative.

---

## 2. Architecture

```
Hotel
  ↓
RoomCategory
  ↓
RoomInventory  (stock par nuit)
  ↓
HotelReservation  (consomme/libère RoomInventory via hotelAvailabilityService)
```

`RatePlan` reste rattaché à `RoomCategory` (Sprint B2, inchangé) ;
`HotelReservation.ratePlan` référence le tarif utilisé et en conserve un
**instantané** (`rateSnapshot`) indépendant de toute modification ultérieure
du `RatePlan`.

---

## 3. Modèles

### 3.1 `HotelReservation` (nouveau)

Champs conformes à la liste minimale de la mission, plus :
`rateSnapshot` (instantané tarifaire), `pendingExpiresAt` (expiration),
`rejectionReason` (distinct de `cancellationReason`). `createdBy` et
`guestUser` sont **volontairement non requis** : une demande publique peut
venir d'un visiteur sans compte (mission §8) — seule l'identité
`guest.{firstName,lastName,email}` est obligatoire dans tous les cas.

Statuts : `pending | confirmed | cancelled | expired | rejected` (jamais
`checked_in/checked_out/no_show`, réservés à un sprint ultérieur). Sources :
`public_web | owner_dashboard | admin_dashboard`.

Référence : `RES-AAAA-NNNNNN`, compteur global (jamais remis à zéro par
année — choix assumé, documenté en §10, pour éviter une seconde dimension
de scoping sans bénéfice réel à ce stade) via `mongoose-sequence`, garanti
sans collision par la même bibliothèque déjà utilisée en production pour
`Document.docNumber`.

### 3.2 `RoomInventory` (nouveau)

Un document par `(roomCategory, date)` — `date` toujours normalisée à
minuit UTC. `totalUnits` par défaut = `RoomCategory.unitsAvailable` au
moment de la première réservation sur cette nuit (jamais dupliqué/recalculé
en dehors de ce point d'entrée). `availableUnits` est un **virtuel**, jamais
persisté, toujours `Math.max(0, totalUnits - blockedUnits - reservedUnits)`.

---

## 4. Service de disponibilité (`hotelAvailabilityService.js`)

`getAvailability` / `assertAvailability` / `reserveInventory` /
`releaseInventory` / `rebuildInventory`, exactement les 5 fonctions
demandées (+ `ensureInventoryExists`, interne).

**Règles de dates** : `checkOutDate` strictement postérieure à
`checkInDate` (nuit de départ jamais consommée — `getNightDates` retourne
`[checkIn, checkOut)`) ; toutes les dates normalisées en UTC minuit
(`normalizeDate`), éliminant toute ambiguïté de fuseau horaire côté
appelant ; une date d'arrivée passée est refusée pour toute création
**publique ou propriétaire** (`assertNotPast`), sauf `allowPast: true`
— réservé au staff, jamais activé par défaut, jamais accessible à un
propriétaire (vérifié côté contrôleur).

---

## 5. Stratégie anti-surbooking (point critique du sprint)

**Aucune transaction MongoDB** (voir §1.3). Stratégie retenue :

1. **Une nuit = un document** `RoomInventory` (clé unique
   `{roomCategory, date}`).
2. **Mise à jour atomique conditionnelle** par nuit :
   ```js
   RoomInventory.findOneAndUpdate(
     { roomCategory, date, isClosed: {$ne:true}, stopSell: {$ne:true},
       $expr: { $lte: [ {$add:['$reservedUnits', roomsCount]},
                        {$subtract:['$totalUnits','$blockedUnits']} ] } },
     { $inc: { reservedUnits: roomsCount } },
     { new: true },
   )
   ```
   MongoDB garantit nativement l'atomicité d'une opération sur un document
   unique, **y compris en standalone** (pas besoin de replica set) —
   contrairement à une paire "lire puis écrire" qui laisserait une fenêtre
   de course entre deux requêtes concurrentes.
3. **Compensation applicative** si une nuit échoue : toutes les nuits déjà
   réservées par CET appel sont immédiatement libérées avant de renvoyer
   l'échec — **jamais de réservation partielle exposée** (mission §5).
4. **Modification** (`updateReservation`) : le nouveau stock est réservé
   **avant** que l'ancien soit libéré (jamais l'inverse), pour ne jamais
   ouvrir de fenêtre où une autre réservation pourrait s'insérer sur les
   anciennes dates avant leur libération volontaire.

Retour d'échec : **409** avec `unavailableDates` (dates en conflit
uniquement — jamais `totalUnits`/`blockedUnits` exacts exposés côté public).

**Preuve par le test** : `hotelAvailabilityService.test.js` simule deux
`reserveInventory()` concurrents (`Promise.all`) sur une catégorie à 1 seule
unité — exactement un des deux appels réussit, l'autre échoue proprement
(jamais les deux, jamais un état incohérent). Le mock reproduit fidèlement
la sémantique atomique réelle d'un `findOneAndUpdate` Mongo (lecture +
condition + mutation en un seul appel synchrone sur un état partagé) ; les
tests unitaires démontrent donc que **la logique du service** respecte
cette atomicité — l'atomicité elle-même reste une garantie native de
MongoDB, pas quelque chose qu'un test unitaire peut re-prouver sans serveur
réel (voir §11, limite assumée).

---

## 6. Tarification

Depuis C/D.1.2, un `RatePlan` hôtelier peut contenir des
`seasonalPeriods` datées (`startDate` incluse, `endDate` exclue), chacune
avec un montant et une priorité. Le moteur résout le prix de chaque nuit ;
la priorité la plus forte gagne sur un chevauchement et un chevauchement de
priorité identique est refusé. Une nuit hors période utilise `RatePlan.amount`.
Le détail immuable est persisté dans `rateSnapshot.nightlyRates`.

`hotelReservationService.computeReservationPricing()` — **toujours**
recalculée côté serveur, jamais confiance à un total envoyé par le client
(aucun champ de prix n'est même lu depuis les paramètres d'entrée de
`createReservation`/`updateReservation`).

```
unitPrice = RatePlan.amount (actif, appartenant à la catégorie)
subtotal  = unitPrice × nights × roomsCount
totalAmount = subtotal + taxes + fees − discount
```

`taxes`/`fees`/`discount` restent à **zéro** : audit confirmé, aucune
structure de taxation ou de code promo n'existe ailleurs dans ce codebase à
ce jour — les inventer aurait été une règle métier non demandée. Documenté
comme limite explicite (§14).

`rateSnapshot` (`rateType`, `amount`, `currency`) fige l'état du tarif au
moment de la réservation — une modification ultérieure du `RatePlan`
(Sprint B2, `ManageHotelRatesPage`) ne change jamais une réservation
existante.

---

## 7. Statuts et transitions

```
pending → confirmed
pending → rejected
pending → cancelled
pending → expired
confirmed → cancelled
```

Centralisées dans `HotelReservation.ALLOWED_TRANSITIONS` (source unique,
schéma + service) et appliquées exclusivement par
`hotelReservationService.transitionStatus()` — jamais dans un contrôleur.
Chaque transition alimente `statusHistory` (`from`, `to`, `changedBy`,
`changedAt`, `reason`). **Idempotence** : `status === to` renvoie la
réservation telle quelle sans erreur ni double libération d'inventaire — une
double annulation ne casse jamais rien. Toute autre transition hors de la
liste ci-dessus est rejetée (409).

---

## 8. Création — 3 parcours

| Parcours | Source | Statut initial | Contrôle |
|---|---|---|---|
| Public (`POST /api/hotels/:hotelId/reservations`) | `public_web` | `pending` (toujours) | `auth.optionalAuth` — fonctionne sans compte |
| Propriétaire (`POST /api/hotel-reservations/owner`) | `owner_dashboard` | `pending` | `hotel.manager === req.user.id` |
| Admin (même route, rôle staff) | `admin_dashboard` | `pending` | `ROLES_ALTIMMO`, aucune restriction d'hôtel |

Aucune règle métier ne justifie une création publique directement
`confirmed` dans ce sprint — `pending` systématique, conformément à la
recommandation par défaut de la mission.

---

## 9. Modification et annulation

Modification (`updateReservation`) : dates/catégorie/chambres/voyageurs/
demandes particulières, réservée aux statuts `pending`/`confirmed`. Tout
changement de dates/catégorie/nombre de chambres **réserve le nouveau stock
avant de libérer l'ancien** (§5) et **recalcule systématiquement le prix**.

Annulation : change le statut, libère l'inventaire, **conserve le document**
(jamais de suppression physique), enregistre `cancelledBy`/
`cancellationReason`, idempotente.

---

## 10. Expiration (§11)

`hotelReservationExpiryService.processReservationExpiry(now)` — cron toutes
les 5 minutes (`server.js`, même fréquence que le cron Visites existant),
fonction pure testable sans dépendre de l'horloge système. Trouve les
`pending` dont `pendingExpiresAt <= now`, transitionne vers `expired`
(libère l'inventaire), notifie le staff en un seul batch. Durée par défaut :
**48h** (`PENDING_EXPIRY_HOURS`, `hotelReservationService.js`) — volontairement
simple, ajustable sans migration.

---

## 11. API

| Méthode | Route | Scope |
|---|---|---|
| GET | `/api/hotels/:hotelId/availability` | Public |
| POST | `/api/hotels/:hotelId/reservations` | Public (`auth.optionalAuth`) |
| GET | `/api/hotel-reservations/mine` | Client connecté |
| GET | `/api/hotel-reservations/:id` | Client (sa réservation) / propriétaire / staff |
| PATCH | `/api/hotel-reservations/:id/cancel` | Client / propriétaire / staff |
| GET/POST | `/api/hotel-reservations/owner` | Propriétaire (+ staff) |
| PATCH | `/api/hotel-reservations/:id`, `/:id/confirm`, `/:id/reject` | Propriétaire / staff |
| GET | `/api/hotel-reservations/admin/list`, `/status/pending` | Staff (`ROLES_ALTIMMO`) |

Ordre des routes conforme à l'audit de routage du mois précédent : toutes
les routes littérales (`/mine`, `/owner`, `/admin/list`, `/status/pending`)
précèdent les actions nommées (`/:id/cancel`...), elles-mêmes avant le
fallback générique `/:id`.

---

## 12. Permissions

Centralisées dans `assertReservationAccess()` (contrôleur) : client
propriétaire de la réservation (`guestUser`), propriétaire de l'hôtel
(`hotel.manager`), ou staff (`ROLES_ALTIMMO`) — jamais autre chose. Un
propriétaire ne peut jamais créer/modifier/décider sur un hôtel tiers
(vérifié par test). L'endpoint public d'availability ne renvoie que
`{available, nights:[{date,available}]}` — aucun champ interne, aucune
donnée personnelle, et **aucune route publique ne liste les réservations**.

---

## 13. Dashboards et pages publiques

- **Propriétaire** (`/mes-hotels/reservations`) : liste, recherche,
  filtres statut, confirmer/rejeter/annuler, création manuelle (limite :
  sélection par ID texte, pas encore de sélecteur en cascade — voir §14).
- **Admin** (`/dashboard/hotel-reservations`) : liste globale paginée,
  recherche, filtres statut, détail dépliable avec historique des statuts.
- **Client** (`/mes-reservations-hotel`) : ses réservations, statut, dates,
  hôtel/catégorie, montant, annulation si autorisée.
- **Fiche hôtel publique** (`HotelBookingWidget.jsx`) : catégorie, tarif,
  dates, chambres, adultes/enfants, "Vérifier la disponibilité" → prix
  estimé → "Demander la réservation" (jamais "Payer").

---

## 14. Limites assumées avant la phase suivante

- **Aucun `Room` physique, check-in/check-out, facture, paiement en ligne,
  remboursement, housekeeping, channel manager/OTA** — conforme à la
  contrainte explicite de ce sprint.
- **Taxes/frais/remise** : structure prête (champs sur `HotelReservation`)
  mais toujours à zéro — aucune règle de taxation n'existe ailleurs dans ce
  codebase à inventer sans cadrage métier.
- **Référence non re-scopée par année** (compteur global) — voir §3.1,
  décision assumée pour la simplicité.
- **Concurrence testée par simulation fidèle, pas par une vraie base
  MongoDB concurrente** (aucun `mongodb-memory-server` dans ce projet) —
  l'atomicité elle-même est une garantie MongoDB, pas quelque chose qu'un
  test unitaire peut re-prouver indépendamment.
- **Création manuelle propriétaire** : sélection d'hôtel/catégorie/tarif
  par identifiant texte, pas encore de sélecteur en cascade — UX à
  améliorer dans un sprint dédié.
- **Aucune vue calendrier** (mission §14 : volontairement une vue tabulaire).

## 15. Addendum C/D.1 — contrat désormais applicable

Les limites historiques ci-dessus sont levées par C/D.1. Les clients Web et
Mobile envoient une `reservationRequestId` générée avant l'appel. L'index unique partiel
`{ hotel, reservationRequestId }` et l'empreinte métier stable garantissent
qu'un rejeu identique retourne la réservation existante sans reprendre de
stock ; un rejeu différent retourne `RESERVATION_IDEMPOTENCY_CONFLICT`.

`roomsCount > 1` est pris en charge de bout en bout : plusieurs affectations
actives, auto-affectation déterministe (étage puis numéro), check-in et
check-out atomiques. Les dates contractuelles sont conservées ;
`actualCheckInAt` et `actualCheckOutAt` enregistrent le réel, et un départ
anticipé libère les nuits futures sans appliquer de politique financière.

Les clients Web et Mobile utilisent le même contrat backend. Pour un invité
authentifié, les événements sont internes ; pour une réservation anonyme,
l'email snapshot est utilisé. La collection d'événements empêche les doubles
notifications lors des retries.
