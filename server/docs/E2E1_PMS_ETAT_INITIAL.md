# E2E-1 — État initial avant implémentation du scénario PMS navigateur

Date : 2026-08-14. Référence : branche `main`, HEAD `0cebcd5bbd180ff8a7814139a0f4a42dade9d2ba` (confirmé identique à DASH-4). Ce document précède toute écriture de code de ce sprint.

## 1. Infrastructure Playwright

`client/playwright.config.js` : `testDir: ./e2e`, `fullyParallel: false`, `workers: 1`, `retries: 0`, `trace: on`, `screenshot: only-on-failure`, `video: on`. Deux projets : `desktop-chromium`, `mobile-chromium`. Un **unique** `webServer` (`server/scripts/start-accommodation-e2e.js`) partagé par **toutes** les specs `e2e/*.spec.js` : il démarre un `MongoMemoryReplSet` unique, seed toutes les fixtures nécessaires à toutes les specs existantes (accommodation, contrats, real-estate, DASH-4 hospitality…), lance le serveur Express réel (port 5000) et Next.js dev (port 3000), avec un faux fournisseur de paiement local (port 5051) et `test-utils/externalNetworkGuard.js` bloquant tout réseau externe réel. **Conséquence directe pour E2E-1** : les nouvelles fixtures PMS doivent être ajoutées à ce même `seed()`, jamais un second webServer/DB.

## 2. Parcours et fixtures DASH-4 déjà présents (réutilisés, jamais dupliqués)

- Owner A = `rentalOnboardingOwner` (`rental-owner-e2e@example.test` / `E2eOwnerRental!2026`), déjà membre actif du tenant `platformTenant` (`Tenant E2E`).
- Hotel A = `dash4HotelA` (`66e200000000000000000051`), Hotel B = `dash4HotelB` (`66e200000000000000000053`), tous deux `tenant: platformTenant`, `manager`/`createdBy: rentalOnboardingOwner`, `publicationStatus: publie`.
- Maison C = `dash4Accommodation` (`66e200000000000000000055`), `accommodationType: villa_meublee`, non liée à un `Hotel`.
- Hôtel « étranger » déjà disponible pour un test cross-owner **sans nouvelle fixture** : `ids.hotel` (`66e200000000000000000011`, `manager: ids.owner`, le compte Admin `owner-e2e@example.test`, tenant différent implicitement car aucun `tenant` explicite sur ce Hotel historique — donc `unresolved`, jamais `platformTenant`). DASH-4 l'utilise déjà comme `FOREIGN_HOTEL` dans `dash4-hospitality-realtime.spec.js`.
- **Gap** : ni `dash4HotelA` ni `dash4HotelB` n'ont de `RoomCategory`/`Room` — nécessaires pour piloter une réservation réelle jusqu'au check-in. À ajouter.

## 3. Cartographie des écrans réels

| Écran | Route | Composant | Notes |
|---|---|---|---|
| Login | `/login` | page login existante | `#email`/`#password` + bouton « Se connecter » (pattern déjà utilisé par DASH-4) |
| Portail propriétaire | `/mon-espace-proprietaire` (redirection post-login) | — | Confirmé par DASH-4 (`toHaveURL(/\/mon-espace-proprietaire\|.../)`) |
| Portfolio | `/mes-hotels` | `MyHotelsPage.jsx` | Carte hôtel → CTA « Ouvrir le centre opérationnel » → `/mes-hotels/:hotelId` ; carte maison → « Ouvrir l'exploitation » → `/mes-hebergements/:id` |
| Cockpit hôtel | `/mes-hotels/:hotelId` | `HotelDetailPage.jsx` | KPI du jour + CTA « Réservations », « Housekeeping », « Maintenance », « Finances », « Chambres », « Tarifs », « Calendrier » |
| Réservations | `/mes-hotels/reservations?hotelId=:id` | `MyHotelReservationsPage.jsx` | Route **plate** (pas `[hotelId]/reservations`), `hotelId` en query param |
| Housekeeping + Inspection | `/mes-hotels/:hotelId/housekeeping` | `HousekeepingDashboardPage.jsx` | **Une seule page** gère ménage ET inspection (boutons Inspecter/Approuver/Rejeter inline) — pas d'écran inspection séparé |
| Maintenance | `/mes-hotels/:hotelId/maintenance` | `MaintenanceDashboardPage.jsx` | Assigner/Démarrer/Résoudre/Clôturer/Ré-inspecter/Approuver/Rejeter inline |
| Finance (lecture) | intégré à la carte réservation | `HotelFinancialDocumentPanel.jsx` | `canManage={false}` côté propriétaire — lecture seule, `data-testid="hotel-financial-document"` |
| Override Admin checkout | `/dashboard/hotel-reservations` | `AdminHotelReservationsPage.jsx` | Réservé Admin, `RoomAssignmentPanel isAdmin` → dérogation financière via `window.confirm`/`window.prompt` |
| Maison meublée | `/mes-hebergements/:id` | existant DASH-2/DASH-3 | Non-PMS, aucune `Room` |

## 4. Réservations

CTA « + Réservation manuelle » sur `MyHotelReservationsPage` révèle un formulaire : `ID Hôtel`/`ID Catégorie`/`ID Tarif` (champs texte bruts, pré-remplis par `initialHotelId` via le query param), dates, `roomsCount`/`adults`, et **prénom/nom/email client obligatoires** (le téléphone n'est pas requis par la validation cliente). Soumission → `createOwnerHotelReservation`. Statut initial `pending`.

## 5. Check-in

Sur une réservation `confirmed` : `RoomAssignmentPanel` affiche « Affecter chambre » (ouvre un select « Choisir une chambre disponible », peuplé via `GET /rooms?roomCategoryId=&status=available`), puis « Check-in » — **le bouton Check-in utilise directement `selectedRoomId` de ce select, sans exiger un clic préalable sur « Confirmer »** (confirmé en lisant `RoomAssignmentPanel.jsx`, `handleCheckIn`). Le serveur (`checkInService.js`) assigne la chambre s'il n'y a pas encore d'affectation, puis passe `Room.status → occupied`.

## 6. Check-out

Bouton « Check-out » (état `checked_in`). Le composant affiche en continu l'état financier (`data-testid="checkout-financial-readiness"`, statuts `ready`/`warning`/`blocked`). Si `blocked` et acteur non-Admin : bouton désactivé, aucune 500. Le check-out nominal appelle `checkOutHotelReservation` → confirmation navigateur (`window.confirm`) puis succès.

## 7. Override Admin

Route réelle `/dashboard/hotel-reservations`, réservée Admin, avec le même `RoomAssignmentPanel` mais `isAdmin`. Le flux de dérogation utilise `window.confirm`/`window.prompt` (dialogues navigateur natifs, interceptables par Playwright via `page.on('dialog', ...)`). **Testable réellement**, pas de bouton à inventer.

## 8. Housekeeping / Inspection

Après check-out : tâche `HousekeepingTask` visible sur `/mes-hotels/:hotelId/housekeeping`, boutons `Démarrer`/`Terminer`. Une fois `completed` : bouton `Inspecter` crée une `RoomInspection`, puis `Approuver`/`Rejeter` apparaissent **sur la même ligne**, sans rechargement de page.

## 9. Maintenance

**Gap réel identifié : aucune UI de création de ticket de maintenance.** `client/lib/services/maintenanceService.js` exporte `createMaintenanceTicket`, mais aucune page ne l'appelle (`grep` confirmé : zéro usage en dehors du fichier de service lui-même). Le reste du cycle (assigner/démarrer/résoudre/ré-inspecter/approuver/rejeter/clôturer) est entièrement exposé sur `/mes-hotels/:hotelId/maintenance`. Confirmé aussi côté service serveur (`inspectionService.js:rejectInspectionCore`) : le rejet d'inspection passe la chambre à `out_of_service` **sans créer automatiquement de ticket** — la création reste une étape manuelle sans UI propriétaire/admin découverte à ce stade.

## 10. Finance (contexte checkout)

Le brouillon financier est créé **automatiquement côté serveur au check-in** (DASH-3 confirmé), jamais via un bouton propriétaire (`canManage={false}` sur cette page). Aucune UI propriétaire ne permet de facturer/finaliser une créance — donc aucune UI ne permet non plus de *provoquer* un blocage financier volontairement. La précondition du scénario « checkout bloqué » (§16 mission) devra être construite via les services financiers existants en amont du test (jamais un raw Mongo write, jamais une nouvelle route), exactement comme le fait déjà `start-accommodation-e2e.js` pour ses propres préconditions.

## 11. Realtime

`useHotelRealtime` (DASH-4) déjà câblé sur `HotelDetailPage`/dashboards contextualisés. Les mises à jour housekeeping/maintenance/inspection émettent déjà un événement `hotel:<id>` (voir `DASH4_REALTIME_E2E_REPORT.md`).

## 12. Deep-links

`dash4-hospitality-realtime.spec.js` prouve déjà la restauration de contexte par URL directe (`/mes-hotels/:hotelId`, `/mes-hebergements/:id`) et via une notification synthétique (`link: /mes-hotels/:hotelId/maintenance`). E2E-1 réutilise ce patron pour le contexte housekeeping/réservation.

## 13. Blockers / gaps réels identifiés

| # | Gap | Sévérité | Action |
|---|---|---|---|
| 1 | `dash4HotelA`/`B` n'ont pas de `RoomCategory`/`Room` | Bloquant pour le scénario nominal | Ajouter au seed (§14) |
| 2 | Aucune UI de création de ticket de maintenance | P2, hors chemin nominal | `NON TESTÉ E2E` pour la création ; reste du cycle testé avec un ticket créé hors UI (précondition, pas un contournement d'UI existante) |
| 3 | Aucune UI propriétaire pour provoquer un blocage financier | P2, attendu par conception (`canManage=false`) | Précondition construite via services financiers existants avant le test, jamais une nouvelle route |
| 4 | Override Admin checkout sur route séparée (`/dashboard/hotel-reservations`), jamais visitée par un propriétaire | Non un bug — séparation des rôles voulue | Scénario dédié avec connexion Admin distincte |

Aucun de ces gaps ne nécessite une nouvelle fonctionnalité métier : uniquement des fixtures supplémentaires et une précondition construite via des services déjà testés.

## 14. Fixtures synthétiques à ajouter

Dans `start-accommodation-e2e.js`, additivement (jamais retirer les fixtures DASH-1/2/3/4 existantes) :
- `RoomCategory` pour `dash4HotelA` (nouvelle, ex. « Standard A »), avec `RatePlan` associé.
- `Room` A1 physique sous cette catégorie, statut `available`.
- Idem pour `dash4HotelB` (`RoomCategory`/`Room` B1) — nécessaire pour un futur scénario mais surtout pour ne pas casser l'hypothèse implicite qu'un hôtel « publié » a un inventaire cohérent.
- Aucun nouvel `Owner`/`Tenant` : Owner A, Hotel A/B, Tenant déjà présents suffisent. L'hôtel étranger cross-owner réutilise `ids.hotel` déjà existant.
- Aucun `Guest` `User` dédié : le formulaire de réservation manuelle capture un snapshot client (prénom/nom/email), jamais un compte `User` obligatoire (confirmé §12 `DASH3_HOSPITALITY_REPORT.md`).

## 15. Scénario PMS nominal (papier, avant code)

```text
login (Owner A) → /mon-espace-proprietaire
→ /mes-hotels → carte Hôtel A → « Ouvrir le centre opérationnel »
→ /mes-hotels/:hotelA → CTA « Réservations »
→ /mes-hotels/reservations?hotelId=hotelA → « + Réservation manuelle »
  → remplir Catégorie/Tarif/dates/client → « Créer »
→ réservation pending visible → « Confirmer »
→ statut confirmed → RoomAssignmentPanel : « Affecter chambre » → sélectionner Room A1 → « Check-in »
→ statut checked_in, panneau financier visible (data-testid hotel-financial-document, non vide)
→ « Check-out » → confirm() → statut checked_out
→ /mes-hotels/:hotelA/housekeeping → tâche Room A1 visible → « Démarrer » → « Terminer »
→ « Inspecter » → « Approuver »
→ vérification indirecte : chambre de nouveau proposable (retour sur l'écran d'affectation d'une nouvelle réservation, ou vérification API support GET /rooms status=available)
```

## 16. Stratégie

1. Ajouter les fixtures manquantes (§14) — aucune fonctionnalité nouvelle, uniquement des données.
2. Écrire le scénario nominal seul, l'exécuter isolément, corriger les bugs réellement démontrés (jamais supposés).
3. Ajouter les 7 scénarios restants un par un, chacun isolément exécutable.
4. Exécuter le lot complet DASH-4 + E2E-1.
5. Exécuter toutes les gates. Produire `E2E1_PMS_REPORT.md`.

Aucune correction n'est appliquée avant qu'un test l'ait démontrée nécessaire.
