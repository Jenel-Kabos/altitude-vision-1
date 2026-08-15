# DASH-3 — État initial de l’exploitation hébergement

Date : 2026-08-14  
Branche/HEAD : `main` / `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba`  
Préflight : travaux DASH-1/2 non commités présents et conservés.

## 1. Architecture hébergement actuelle

DASH-2 fournit le portefeuille `/mes-hotels`, puis les briques opérationnelles divergent : `Accommodation` indépendante dispose d’une fiche légère complète côté dashboard staff; `Hotel` dispose d’un centre PMS et de pages spécialisées, mais ces fiches sont sous le layout `/dashboard`, interdit au rôle `Proprietaire`. Le portefeuille propriétaire ne les ouvre donc pas.

## 2. Modèles

`Accommodation` + `Property` représentent la maison meublée; `AccommodationReservation`, `AccommodationNightLock`, `AccommodationAvailabilityBlock` et `RatePlan` portent séjour, disponibilité et tarif. `Hotel`, `RoomCategory`, `RoomInventory`, `Room`, `HotelReservation`, `RoomAssignment`, `HousekeepingTask`, `RoomInspection` et `MaintenanceTicket` portent le PMS. `FinancialDocument`, lignes, paiements et allocations sont communs par domaine/établissement.

## 3. Routes

Les routes réelles existent pour availability/calendrier/blocages/réservations d’accommodation, disponibilité/inventaire/réservations/chambres d’hôtel, check-in/out, housekeeping, inspection, maintenance et finance. `dashboard-analytics` expose déjà une agrégation consolidée par module.

## 4. Controllers

Les controllers délèguent majoritairement les transitions aux services métier. Les domaines hôteliers utilisent le scope central d’hôtel; le controller analytics ne vérifie toutefois pas l’ownership d’un `accommodationId` explicite et refuse actuellement `Proprietaire` pour le module accommodations.

## 5. Services

Les services centraux existants sont réutilisables : `accommodationReservationService`, `hotelAvailabilityService`, `hotelReservationService`, `checkInService`, `checkOutService`, `roomAssignmentService`, `housekeepingService`, `inspectionService`, `maintenanceService` et les services financiers F2.

## 6. Pages

Maison : `AccommodationDetailPage` couvre overview, réservations, création, calendrier/blocages et finance. Hôtel : `HotelDetailPage` couvre fiche et liens PMS, avec seulement des compteurs de chambres. Les pages réservations, inventaire, chambres, housekeeping, maintenance et finance existent. Leur emplacement sous `/dashboard` bloque leur usage direct par le propriétaire.

## 7. Maison meublée

Le modèle fonctionne au niveau établissement sans `Room`. Le détail léger est adapté, mais il n’existe pas sous le layout propriétaire et les cartes DASH-2 ne sont pas cliquables vers ce détail.

## 8. Hôtel

Le PMS complet existe. Le défaut principal est le raccordement : la carte propriétaire renvoie seulement vers catégories/tarifs sous `/dashboard`; aucun cockpit quotidien propriétaire canonique n’est accessible.

## 9. Réservation

Maison : `pending → confirmed → checked_in → checked_out`, avec annulation/no-show selon la table réelle. Hôtel : `pending → confirmed → checked_in → checked_out`, avec rejet/annulation/expiration avant séjour. La réservation hôtelière garde un snapshot tarifaire et consomme l’inventaire atomiquement par nuit.

## 10. Chambre

Statuts réels : `available`, `reserved`, `occupied`, `cleaning`, `inspection`, `out_of_service`. `RoomAssignment` impose une seule affectation active par chambre. La réservation porte une catégorie; l’affectation physique intervient séparément.

## 11. Check-in

Réservation obligatoirement `confirmed`, chambre(s) compatible(s) et disponible(s), affectation contrôlée, puis réservation `checked_in` et chambre(s) `occupied`. Le brouillon financier est créé après le commit; son échec ne rollbacke pas le séjour et produit une alerte de reprise, conformément à la politique existante.

## 12. Check-out

Réservation obligatoirement `checked_in`. F2.3 évalue document, lignes, paiements, allocations et solde; un blocage renvoie `CHECKOUT_BLOCKED_FINANCIAL`. Seul un Admin avec capacité dédiée peut déroger avec motif et audit. Le succès libère les affectations, passe les chambres en `cleaning` et crée les tâches de ménage.

## 13. Housekeeping

Transitions : `pending → assigned/in_progress → completed` ou annulation. L’index unique partiel `{room, open:true}` empêche les doubles tâches ouvertes concurrentes. La fin du ménage fait `cleaning → inspection`.

## 14. Inspection

Une inspection ouverte est unique par chambre. Succès : `inspection → available` uniquement sans maintenance ouverte. Échec : `inspection → out_of_service` et blocage d’inventaire physique. Une réinspection post-maintenance est supportée.

## 15. Maintenance

Le domaine hôtelier est `MaintenanceTicket`, distinct de `RentalMaintenanceTicket`. L’ouverture place la chambre hors service et marque les réservations affectées à réassigner. Résolution autorise une réinspection; clôture suit la résolution.

## 16. Finance

F2.1 facturation, F2.2 paiements, F2.3 politique de check-out, F2.4 PDF/email et F2.5 dashboard financier sont **IMPLÉMENTÉS** dans le code actuel. DASH-3 ne doit pas les recréer. Les actions externes ne seront pas exercées sur une infrastructure réelle.

## 17. Ownership

Hôtel : `Hotel.manager` legacy ou `HotelStaffAssignment` actif avec capacité, via `hotelAccessScopeService`; les enfants dérivent l’hôtel depuis leur ressource. Maison : `Property.owner`/`Accommodation.createdBy`; les réservations portent `owner`. Défaut analytics démontré : un `accommodationId` n’est pas contrôlé avant agrégation.

## 18. Tenant

Le tenant reste distinct de l’établissement. Les modèles portent un tenant lorsque résolu; le middleware/runtime le borne. Changer d’URL établissement ne change jamais le tenant.

## 19. Multi-établissement

Le scope HTTP hôtel est correct et les URLs portent `hotelId`. L’absence de lien propriétaire vers les fiches empêche toutefois le switch opérationnel cohérent Hotel A/Hotel B/Maison C. Aucun contexte local persistant n’est nécessaire.

## 20. Duplications

Les compteurs de chambres de `HotelDetailPage` refont une réduction locale alors que `dashboard-analytics/hotels` agrège déjà chambres, réservations, housekeeping, maintenance et finance. Les vues staff et propriétaire peuvent réutiliser les mêmes composants plutôt que créer un PMS V2.

## 21. Code legacy

Les commentaires de sprint ancien annonçant l’absence de Room/réservations sont historiques; les modèles ont depuis été ajoutés. `Hotel.manager` reste la compatibilité legacy assumée. Les alias `/dashboard/etablissements` et les routes `/dashboard/hotels` coexistent.

## 22. Bugs

- **P0** : analytics accommodation par identifiant sans contrôle owner/tenant démontré.
- **P1** : aucun workflow métier hôtelier cassé démontré; anti-surbooking, check-in/out, housekeeping et maintenance sont couverts.
- **P2** : fiches d’exploitation inaccessibles au propriétaire; cartes portfolio non raccordées; cockpit hôtel quotidien incomplet; analytics accommodation propriétaire refusée.
- **P3** : filtres housekeeping/maintenance par ID libre dans les pages staff; absence d’actions directes depuis les KPIs.
- **P4** : alias et commentaires legacy.

## 23. P0/P1/P2/P3/P4

Correction prévue : borner analytics accommodation; accepter le propriétaire seulement après ownership exact; rendre les deux fiches existantes accessibles sous le shell propriétaire; réutiliser l’analytics hôtel sélectionné pour un today board fiable et actionnable. Aucun modèle, rôle ni workflow financier nouveau.

## 24. Architecture cible

`/mes-hotels` reste le portefeuille. Une maison ouvre `/mes-hebergements/:id`, sans concept Room. Un hôtel ouvre `/mes-hotels/:hotelId`, qui réutilise `HotelDetailPage`; son overview charge en parallèle la fiche et une seule agrégation sélectionnée. Les actions profondes conservent `hotelId` dans l’URL et les gardes backend restent la preuve d’accès.
