# SYNC-1 — État initial de l'audit de parité Web ↔ Mobile

Date : 2026-08-15. Branche `main`, HEAD `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (arbre propre au démarrage, `git status --short` vide). Ce document précède toute conclusion de comparaison et fixe les faits vérifiés en code avant classification.

## 0. Méthode

Chaque affirmation ci-dessous provient d'une lecture directe de fichiers réels (`grep`/`find`/`Read`) ou de rapports de sprints déjà certifiés, jamais d'une supposition. Quand un rapport antérieur (notamment `WEB_MOBILE_PARITY_AUDIT.md`, daté du 5 août) est cité, son contenu a été revérifié contre l'état actuel du code lorsque des sprints postérieurs (`ACC-MOBILE-1`, `GL-MOBILE-1`, `DOC-MOBILE-1`, `NAV-CORE-1`) ont pu le rendre obsolète.

## 1. Rapports de référence lus

| Rapport | Périmètre confirmé |
|---|---|
| `E2E1_PMS_REPORT.md` | Web/API — cycle PMS hôtelier certifié navigateur, `altimmo-app/` explicitement non touché |
| `DASH4_REALTIME_E2E_REPORT.md` | Web/API — room Socket.IO `hotel:<id>`, notifications hospitality, GO SOUS RÉSERVES |
| `DASH3_HOSPITALITY_REPORT.md` | Web/API — housekeeping/inspection/maintenance/finance hôtel |
| `DASH2_OWNER_REPORT.md`, `DASH1_REPORT.md` | Web — portefeuille propriétaire unifié `/mes-hotels`, dashboards |
| `IAM3_STAFF_PERMISSIONS_REPORT.md` | Serveur + client web uniquement — capabilities READ/MANAGE staff, `altimmo-app/` non touché |
| `IAM2_ARCHITECTURE_REPORT.md` | Serveur + client web uniquement — projection de rôles composables, `altimmo-app/` non touché |
| `WEB_MOBILE_PARITY_AUDIT.md` (MOB-GAP-1, 5 août) | Audit mobile précédent, baseline avant 4 sprints mobiles ultérieurs |
| `MOBILE_SCREEN_INVENTORY.md`, `MOBILE_PARITY_ROADMAP.md` | Inventaire écrans et roadmap issus de MOB-GAP-1 |
| `ACC_MOBILE_1_REPORT.md`, `GL_MOBILE_1_REPORT.md`, `DOC_MOBILE_1_REPORT.md`, `NAV_CORE_1_ARCHITECTURE.md` | Sprints mobiles réalisés depuis le 5 août — ont fermé une partie des écarts identifiés par MOB-GAP-1 |

**Constat clé** : quatre sprints mobiles (`MOBILE-NAV-1`/`NAV-CORE-1`, `GL-MOBILE-1`, `ACC-MOBILE-1`, `DOC-MOBILE-1`) ont eu lieu **entre** MOB-GAP-1 (5 août) et SYNC-1 (15 août). L'audit MOB-GAP-1 n'est donc plus l'état courant : il sert de baseline historique, pas de vérité actuelle. Aucun sprint `HOTEL-MOBILE-1`, `OWNER-MOBILE-1`, `PAY-MOBILE-1` ou `CRM-MOBILE-1` n'existe (vérifié : aucun fichier `server/docs/HOTEL_MOBILE*`, `OWNER_MOBILE*`, `PAY_MOBILE*`, `CRM_MOBILE*`).

## 2. Inventaire brut — Web (`client/`)

- 171 fichiers `page.jsx`/`page.js` sous `client/app/` (Next.js App Router).
- 61 fichiers service sous `client/lib/services/`.
- Constantes dédiées hôtel : `hotel.js`, `hotelReservation.js`, `housekeeping.js`, `maintenance.js`, `room.js`, `accommodation.js` — toutes présentes.

## 3. Inventaire brut — Mobile (`altimmo-app/`)

- 50 fichiers sous `altimmo-app/src/screens/` (dont 5 fichiers de test `__tests__/*.test.jsx`), soit 45 écrans réels après retrait des tests.
- 20 fichiers service sous `altimmo-app/src/services/` (hors tests) : `accommodationReservationService.js`, `annonceService.js`, `api.js`, `cacheService.js`, `hotelReservationService.js`, `navigationService.js`, `notificationApiService.js`, `notificationsService.js`, `personalDocumentService.js`, `propertyMapper.js`, `publicationPayloads.js`, `publiciteService.js`, `realEstateApplicationService.js`, `reviewService.js`, `secureAttachmentService.js`, `socketService.js`, `tenantPortalService.js`, `transactionService.js`, `userBusinessProfileService.js`, `visiteService.js`.
- Constantes : `accommodation.js`, `accommodationAmenities.js`, `amenities.js`, `locations.js`, `propertyTypes.js`, `rentalProperty.js`. **Aucune** constante `hotel`/`housekeeping`/`maintenance`/`room` côté mobile (absence confirmée par `ls`).
- Écrans hôtel existants : `Hotels/HotelBookingScreen.jsx` (réservation client), `Hotels/MyHotelReservationsScreen.jsx`, `Hotels/HotelReservationDetailScreen.jsx`, `Hotels/HotelOperationsScreen.jsx` (opérations staff — voir §6).
- Écrans hébergement/documents/locataire ajoutés depuis le 5 août : `Accommodation/MyAccommodationReservationsScreen.jsx`, `Accommodation/AccommodationBookingScreen.jsx`, `Accommodation/AccommodationReservationDetailScreen.jsx`, `Documents/MyDocumentsScreen.jsx`, `Documents/PersonalDocumentDetailScreen.jsx`, `TenantPortal/TenantPortalScreen.jsx`.

## 4. Backend commun — source d'autorité confirmée

Express/Mongoose reste l'unique source de vérité métier pour les deux clients (JWT partagé, RBAC serveur). Modèles structurants confirmés : `User`, `Property`, `Hotel`, `Room`, `RoomCategory`, `HotelReservation`, `HousekeepingTask`, `RoomInspection`, `Accommodation`, `AccommodationReservation`, `RentalManagement`, `Contrat`, `Proprietaire`, `Locataire`, `FinancialDocument`, `FinancialPayment`.

## 5. Auth Mobile — vérifié en code (voir aussi §8 du rapport final)

- Stockage du JWT : `expo-secure-store` (`altimmo-app/src/services/api.js`), **plus sûr** que `localStorage` côté Web.
- 401 : intercepteur Axios purge le token et invalide la session (`api.js`, `AuthContext.jsx`).
- `tokenVersion` : **absent** — aucune occurrence dans `altimmo-app/src/` (`grep -rn "tokenVersion"` vide).
- Comptes suspendus/bannis/inactifs : **aucune gestion dédiée** à la connexion côté mobile ; seul un libellé de notification (`account_suspended`) existe, sans logique de session associée.
- Header tenant/plateforme (`X-Platform-Tenant-Id`) : **absent**, confirmé par recherche exhaustive.
- Notion de tenant/multi-tenant switching : **absente** côté mobile (le mot « tenant » n'y désigne que le locataire immobilier).
- Capabilities IAM-3 : **aucune** notion de `capability`/`hasStaffCapability` côté mobile ; seuls des checks de rôle grossiers (`STAFF_ROLES = ['Admin', 'Collaborateur']`) pilotent l'UI, jamais une RBAC dupliquée fine.
- Logout : nettoyage complet (token, socket, cache mémoire, état utilisateur) confirmé dans `AuthContext.jsx`.

## 6. Socket.IO et PMS Mobile — vérifié en code

- `altimmo-app/src/services/socketService.js` : authentifie via JWT (`auth: { token }`), gère la reconnexion et le rafraîchissement de token, rejoint des rooms de conversation (`join-room`/`leave-room`). **Aucune** room `hotel:<id>` référencée nulle part dans `altimmo-app/src` — le canal DASH-4 n'est pas consommé par le mobile.
- `HotelOperationsScreen.jsx` (96 lignes, toujours actif) : sélection d'hôtel, liste réservations, inventaire 7 jours + stop-sell, affectation/changement de chambre, check-in, check-out. **Zéro** occurrence de housekeeping, inspection ou maintenance dans ce fichier.
- Aucun écran `Housekeeping`/`Inspection` n'existe dans `altimmo-app/src/screens` (recherche exhaustive, seuls des résultats de la maintenance locative GL-MOBILE-1 apparaissent, modèle distinct).
- Aucun cockpit hôtel (KPI arrivées/départs/occupées/disponibles/cleaning/hors-service) n'existe côté mobile.
- `HotelOperationsScreen` est câblé directement dans `ProfilStack.jsx` **hors** du registre `shared/navigation/registry.json` (`MY_ESTABLISHMENTS` y a `mobileRoute: null`), confirmant une navigation hôtel non alignée avec le socle NAV-CORE utilisé par les autres domaines.

## 7. Registre de navigation partagé (`shared/navigation/registry.json`)

Un socle de convergence existe déjà (introduit par NAV-CORE-1, étendu par GL/ACC/DOC-MOBILE-1) : 40 destinations canoniques avec `webRoute`/`mobileRoute` pour Property, Visits, Payments, Applications, Messages, Profile, Hotel/Accommodation reservations (côté client uniquement), Tenant Portal, My Documents. Aucune destination hôtel opérationnelle (housekeeping, inspection, maintenance, finance, cockpit, room assignment) n'y figure — confirmé par lecture directe du fichier.

## 8. Ce que ce document ne couvre PAS encore

Ce document fixe les faits d'inventaire et les vérifications ciblées auth/tenant/IAM/socket/PMS. La matrice complète domaine par domaine (`SYNC1_PARITY_MATRIX.md`) et la synthèse avec verdict (`SYNC1_WEB_MOBILE_REPORT.md`) sont produites séparément, une fois les gates mobiles exécutés.
