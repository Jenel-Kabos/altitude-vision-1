# SYNC-2B — Rapport final : parité PMS Mobile & exploitation propriétaire

Date : 2026-08-15. Branche `main`, HEAD au démarrage `0fc4157262d3a8b69e86b02cda66cb95d2e26ed5` (identique à SYNC-2A, non commité). Fait suite à `SYNC2B_MOBILE_PMS_ETAT_INITIAL.md` et `SYNC2B_PMS_PARITY_MATRIX.md`.

## 1. Résumé exécutif

Le cycle PMS mobile (réservation → room assignment → check-in → financial readiness → check-out → housekeeping → inspection → chambre disponible) est désormais fonctionnel de bout en bout côté propriétaire, en réutilisant exclusivement les contrats API déjà certifiés (E2E-1, DASH-3, DASH-4) sans aucune règle métier recréée côté mobile. **Verdict : SYNC-2B CERTIFIÉ VERT.**

## 2. Architecture avant

`HotelOperationsScreen` (réservations, room assignment, check-in, check-out « à l'aveugle », inventaire) était le seul écran PMS mobile. Aucun housekeeping, inspection, maintenance ou cockpit. Aucune consommation de `joinHotelRoom`/`leaveHotelRoom` (préparés mais inutilisés par SYNC-2A).

## 3. Architecture après

```
Profil → Opérations hôtelières → [sélection hôtel]
  ├─ Réservations (HotelOperationsScreen, étendu : financial readiness + realtime)
  ├─ Cockpit (HotelCockpitScreen, nouveau)
  ├─ Ménage (HotelHousekeepingScreen, nouveau : ménage + inspection combinés)
  └─ Maintenance (HotelMaintenanceScreen, nouveau : + ré-inspection post-réparation)
```

Chaque écran : `useHotelRealtime(hotelId, onUpdate)` → `joinHotelRoom` au montage/reconnect → `hospitality:updated` filtré par `hotelId` → `onUpdate` **redéclenche systématiquement un appel HTTP existant**, jamais une mutation locale directe (mandat §34, vérifié par tests).

## 4. Portfolio propriétaire

Inchangé — `getAccessibleHotels()` liste les hôtels autorisés, sélection par nom (pas d'identifiant technique saisi). Non modifié car déjà conforme.

## 5. Sélection établissement

`hotelId` porté explicitement en `route.params` vers les 3 nouveaux écrans et conservé dans l'état de `HotelOperationsScreen` — jamais déduit implicitement. Un bug réel a été trouvé et corrigé pendant ce sprint (voir §26) : les 3 nouveaux écrans appelaient leur endpoint **avant** de vérifier la présence d'un `hotelId`, ce qui aurait envoyé une requête sans filtre (le backend serait alors retombé sur « tous les hôtels accessibles à l'utilisateur », un flou de scope jamais voulu ici).

## 6. Hotel vs Accommodation

Aucun écran créé ce sprint ne référence `Accommodation`, `AccommodationReservation` ni aucun concept maison meublée. Les 4 écrans PMS mobiles (Opérations, Cockpit, Ménage, Maintenance) ne consomment que des endpoints `Hotel`/`Room`/`HotelReservation`/`HousekeepingTask`/`RoomInspection`/`MaintenanceTicket` — confirmé par lecture des imports de chaque fichier, jamais une supposition.

## 7. Cockpit

`HotelCockpitScreen.jsx`, nouveau. Consomme `GET /dashboard-analytics/hotels?hotelId=` — **exactement** les champs `kpis` déjà affichés par `client/lib/pages/dashboard/HotelDetailPage.jsx` (occupation, arrivées/départs du jour + en attente, à nettoyer, à inspecter, maintenance/hors service, alerte solde émis). Aucun KPI inventé (pas de revenu, taux d'occupation calculé, ADR, RevPAR — absents de la réponse backend, donc absents de l'écran, testé explicitement). Une panne d'agrégat est non bloquante (message affiché, boutons de navigation restent actifs), miroir du comportement Web DASH-3.

## 8. Réservations

Inchangé fonctionnellement (`HotelOperationsScreen`), étendu avec financial readiness et realtime (voir §11, §17).

## 9. Room assignment

Inchangé — `assignHotelRoom`/`autoAssignHotelRooms`/`changeHotelRoom` déjà présents et déjà conformes au contrat E2E-1. Aucun `emitHotelEvent` dédié n'existe côté serveur pour ce domaine (vérifié dans `roomAssignmentController.js`/service) — aucun événement realtime inventé pour le combler.

## 10. Check-in

Inchangé — `checkInHotelReservation` déjà conforme. Rafraîchi désormais par `reservation.checked_in` en plus du rechargement manuel existant.

## 11. Financial readiness

**Gap fermé.** `getCheckoutFinancialReadiness(id)` (nouveau, `hotelReservationService.js`) appelle le même endpoint certifié E2E-1. `HotelOperationsScreen` charge la readiness de chaque réservation `checked_in` après chaque `load()` et l'affiche (statut + codes de blocage) avant le bouton de check-out.

## 12. Finance — périmètre respecté

Aucune capacité de facturation/encaissement/allocation ajoutée côté mobile. Le propriétaire voit l'état financier en lecture seule uniquement — conforme au mandat §20-21 et à la règle E2E-1 (second acteur Admin obligatoire pour le volet financier, jamais contournée).

## 13. Second acteur financier

Non applicable côté mobile dans ce sprint : aucun flux de facturation/encaissement n'est initié depuis mobile, donc aucune dépendance à un second acteur Admin mobile n'a été créée. Si un futur sprint mobile devait exposer la facturation, il devrait respecter la même séparation Owner/Admin qu'E2E-1 — documenté ici comme contrainte pour SYNC-2C/2D.

## 14. Check-out

Le bouton reste actionnable pour un check-out effectivement autorisé (`status !== 'blocked'`) et **désactivé** (jamais forcé côté client) quand la readiness indique `blocked` — testé pour les deux cas. Aucune transition locale n'est jamais appliquée avant la réponse serveur.

## 15. Après check-out

Le cycle `checked_out → cleaning → inspection → available|out_of_service` reste entièrement piloté par le backend (DASH-3). Le mobile ne fait que refléter les statuts renvoyés — jamais une transition anticipée localement (housekeeping/inspection créées uniquement par des appels réels, vérifiés dans les tests).

## 16. Housekeeping

**Gap fermé.** `HotelHousekeepingScreen.jsx` (nouveau), `housekeepingService.js` (nouveau, mobile). Liste filtrée par `hotelId`, actions Démarrer/Terminer/Annuler, chambre + étage réels affichés (`Room.floor`, confirmé champ existant), priorité réelle (`HousekeepingTask.priority`, confirmée existante — jamais inventée malgré la mise en garde initiale du mandat).

## 17. Inspection

**Gap fermé.** Combinée à l'écran housekeeping, même contrat que le Web (pas d'endpoint de liste — une inspection est créée à la demande depuis une tâche `completed`, son id gardé en état local jusqu'à la décision). `approveInspection`/`rejectInspection` appellent les endpoints réels ; aucune décision n'est prise localement.

## 18. Maintenance

**Gap fermé.** `HotelMaintenanceScreen.jsx` (nouveau), `hotelMaintenanceService.js` (nouveau, mobile, nommé pour ne jamais être confondu avec la maintenance locative GL — modèle `MaintenanceTicket` distinct de `RentalMaintenanceTicket`). Actions Démarrer/Résoudre/Clôturer/Ré-inspecter, cette dernière réutilisant `ticket.inspection.housekeepingTask._id` exactement comme le Web (jamais une nouvelle tâche de ménage fabriquée). Testé explicitement : sans `housekeepingTask` d'origine, la ré-inspection est refusée côté écran (aucune chambre inventée).

## 19. Room lifecycle

`available → occupied → cleaning → inspection → available|out_of_service → [inspection]` : chaque transition reste décidée exclusivement par le backend (DASH-3), le mobile ne fait qu'afficher/demander/envoyer/interpréter (mandat §18), jamais recréer la logique (mandat §28-29 respectés — une inspection échouée n'implique jamais localement une maintenance obligatoire, c'est le backend qui décide `out_of_service`).

## 20. Realtime

`useHotelRealtime.js` (nouveau hook) consomme le socket singleton déjà authentifié/contextualisé par SYNC-2A. Contrat exact DASH-4 vérifié dans `server/socket.js` avant implémentation : `establishment:join`/`establishment:leave` avec `{type:'hotel', id}`, événement unique `hospitality:updated` avec payload `{hotelId, eventType, entityType, entityId, status, updatedAt}`.

## 21. Socket join

`joinHotelRoom(hotelId)` (SYNC-2A) appelé au montage de chaque écran PMS via le hook, avec re-jonction automatique sur tout `connect` du socket (couvre le premier connect ET les reconnexions).

## 22. Socket leave

`leaveHotelRoom(hotelId)` appelé au démontage / changement de `hotelId` — testé (`useHotelRealtime.test.js`).

## 23. Reconnect

Testé explicitement : un `connect` déclenché après le montage initial re-déclenche `joinHotelRoom` avec le même `hotelId`. Le serveur revalide systématiquement session/tenant/ownership à chaque join (`server/socket.js`, jamais une confiance client) — comportement hérité, non modifié.

## 24. Notifications

Non modifié. Confirmé par lecture directe (SYNC-2A) que `resolveNavigation()` retourne `null` en toute sécurité pour un type de notification inconnu, sans jamais planter le mobile sur les types hospitality DASH-4.

## 25. Deep-links

**Reportés à SYNC-2C**, conformément au mandat §43 : câbler les notifications hospitality (housekeeping/inspection/maintenance/réservation) vers les 3 nouveaux écrans nécessite d'étendre `shared/navigation/registry.json` avec des destinations paramétrées par `hotelId` — un travail transversal cohérent qui mérite son propre audit plutôt qu'un lien isolé bricolé dans ce sprint.

## 26. Bugs trouvés

- **P2 réel** : les 3 nouveaux écrans (avant correction) appelaient leur endpoint PMS même sans `hotelId` sélectionné, risquant de recevoir « tous les hôtels accessibles » au lieu de rien — trouvé par un test qui échouait (`sans hotelId : aucun appel réseau`), jamais supposé.
- **P3 test** : la première assertion `.props.disabled` sur le bouton de check-out testait la mauvaise clé (React Native `Pressable` expose `accessibilityState.disabled`, pas `disabled` en prop directe) — corrigé, la nouvelle assertion vérifie réellement le comportement.

## 27. Bugs corrigés

Les deux ci-dessus. Aucun bug de sécurité (ownership/tenant/capability) trouvé — tous les nouveaux services sont de purs wrappers HTTP sans logique d'autorisation dupliquée, le backend restant l'unique source de vérité (mandat §71).

## 28. Tests mobile

| Fichier | Tests |
|---|---:|
| `housekeepingService.test.js` (nouveau) | 5 |
| `hotelMaintenanceService.test.js` (nouveau) | 3 |
| `hotelReservationService.readiness.test.js` (nouveau) | 2 |
| `useHotelRealtime.test.js` (nouveau) | 5 |
| `HotelHousekeepingScreen.test.jsx` (nouveau) | 7 |
| `HotelMaintenanceScreen.test.jsx` (nouveau) | 6 |
| `HotelCockpitScreen.test.jsx` (nouveau) | 4 |
| `HotelOperationsScreen.test.jsx` (étendu) | +2 |

Suite complète mobile : **33 suites / 303 tests, 0 échec** (baseline SYNC-2A : 26/269 → +7 suites, +34 tests, zéro régression).

## 29. Tests backend

Aucune modification serveur ce sprint. Suites PMS/authorization exécutées comme preuve de certification (jamais comme preuve d'une correction) : `housekeeping|inspection|maintenance|hotelReservation|checkoutFinancial|dashboardAnalytics` → **16 suites / 225 tests, 0 échec**.

## 30. Tests realtime

Couverts par `useHotelRealtime.test.js` : join au montage, écoute `hospitality:updated`, filtrage strict par `hotelId` (cross-hotel testé — un événement d'un autre hôtel est ignoré), re-jonction au reconnect, leave au démontage.

## 31. Gates

| Contrôle | Résultat |
|---|---|
| Mobile — syntaxe | ✅ 177 fichiers, 0 erreur |
| Mobile — lint | ✅ 0 erreur, 102 avertissements (89 préexistants + 13 `import/first` dans les nouveaux tests, même style que l'existant) |
| Mobile — types | ✅ |
| Mobile — tests | ✅ 33/33 suites, 303/303 tests |
| Mobile — export Android | ✅ bundle Hermes 6,7 Mo |
| Mobile — Expo Doctor | ⚠️ 20/21 (12 dépendances patch préexistantes, identiques SYNC-1/2A, aucune nouvelle incompatibilité) |
| Serveur — suites PMS ciblées | ✅ 16/16 suites, 225/225 tests (aucune modification serveur) |
| `git diff --check` | ✅ propre |

## 32. Expo Doctor

Inchangé : 12 dépendances patch, hors périmètre (`MOB-1`). Aucune nouvelle incompatibilité introduite par SYNC-2B.

## 33. Dette restante

- Deep-links hospitality → écrans mobiles (§25, reporté SYNC-2C).
- Pas d'assignation d'employé/technicien depuis mobile (input ID technique jugé disproportionné pour l'UX terrain visée ; le Web le propose, le mobile s'appuie pour l'instant sur l'auto-affectation ou une assignation faite ailleurs).
- Room assignment sans room realtime dédiée côté serveur (§9) — non un défaut mobile, une absence de contrat serveur.
- Aucun test E2E mobile sur device réel (dette déjà identifiée SYNC-1, non traitée — hors périmètre, réservée à `MOB-E2E`).

## 34. SYNC-2C

Prérequis identifiés pour la suite : deep-links hospitality complets (registre NAV-CORE étendu), cockpit patrimoine propriétaire (déjà en roadmap SYNC-1), portefeuille hébergement (Hôtel/Maison) mobile, éventuelle UI d'assignation employé si le besoin terrain est confirmé.

## 35. Risques

Le cockpit dépend d'un agrégat (`dashboard-analytics/hotels`) potentiellement coûteux à grande échelle — non mesuré en charge (DASH-3 l'avait déjà noté « NON MESURÉE »). Le hook realtime partagé (`useHotelRealtime`) est monté indépendamment sur 3 écrans simultanément possibles (Cockpit + Ménage + Maintenance si navigation empilée) — chacun rejoint/quitte sa propre référence de room sans conflit testé unitairement mais jamais vérifié en navigation réelle multi-écrans simultanée (limite du test unitaire, pas un bug démontré).

## 36. Git

```
git status --short   → 11 fichiers modifiés (mobile uniquement, 3 fichiers serveur inchangés depuis SYNC-2A), 20 fichiers nouveaux (services/écrans/hooks/tests mobile + 3 docs SYNC2B)
git diff --check     → propre
git diff --stat      → 14 fichiers changés, 471 insertions(+), 42 suppressions(-)
git branch --show-current → main
git rev-parse HEAD   → 0fc4157262d3a8b69e86b02cda66cb95d2e26ed5 (inchangé)
```
Aucun `git add`/`commit`/`push`/déploiement.

## 37. Verdict

**SYNC-2B CERTIFIÉ VERT.**

Le PMS mobile permet réellement et sans contournement, preuve à l'appui (tests + lecture directe des contrats serveur avant implémentation) :
- Contexte hôtel explicite et propagé (✅)
- Cockpit avec KPI fiables uniquement (✅)
- Réservations (✅, déjà présent)
- Room assignment (✅, déjà présent)
- Check-in (✅, déjà présent)
- Financial readiness visible avant check-out (✅, gap fermé)
- Check-out respectant le blocage financier (✅)
- Housekeeping (✅, gap fermé)
- Inspection (✅, gap fermé)
- Maintenance hôtelière (✅, gap fermé)
- Realtime `hotel:<id>` réellement consommé, cross-hotel isolé (✅)

Auth/Tenant/IAM/Ownership (SYNC-2A) préservés — aucune règle backend contournée, aucune capacité financière ajoutée au propriétaire mobile. Expo Doctor reste 20/21 (dette préexistante, hors périmètre). Deep-links hospitality explicitement reportés à SYNC-2C, documentés plutôt que bricolés.

## 38. Réponses factuelles aux questions obligatoires (mandat §82)

- Le propriétaire peut ouvrir tous ses hôtels autorisés : **OUI** (`getAccessibleHotels`, inchangé).
- Changer d'hôtel sans fuite de contexte : **OUI** — chaque écran recharge sur changement de `hotelId`, testé pour housekeeping/maintenance/cockpit (guard hotelId) ; testé au niveau realtime pour l'isolation cross-hôtel des événements.
- Maison meublée distincte d'un hôtel : **OUI**, confirmé (§6).
- Cockpit utilise uniquement des données fiables : **OUI**, mêmes champs que le Web, aucun KPI inventé, testé.
- Réservations utilisent les routes canoniques : **OUI**, inchangées.
- Room assignment fonctionne : **OUI** (déjà présent, inchangé).
- Check-in fonctionne : **OUI** (déjà présent, inchangé).
- Financial readiness visible : **OUI**, gap fermé.
- Un check-out bloqué reste bloqué sur mobile : **OUI**, testé (bouton désactivé).
- Le mobile peut exécuter un check-out autorisé : **OUI**, testé.
- Le check-out crée correctement la suite du lifecycle : **OUI** côté backend (DASH-3, inchangé) ; le mobile reflète l'état sans jamais l'anticiper.
- Housekeeping existe sur mobile : **OUI**, nouveau.
- Inspection existe sur mobile : **OUI**, nouveau.
- Maintenance hôtel existe sur mobile : **OUI**, nouveau.
- Une inspection passed remet la chambre dans l'état backend attendu : **OUI** — le mobile n'affiche que la réponse serveur, jamais un statut anticipé.
- Une inspection failed suit le workflow backend : **OUI** — testé que le mobile ne décide jamais localement d'une maintenance obligatoire.
- Le mobile rejoint `hotel:<id>` : **OUI**, testé.
- Quitte l'ancienne room au switch : **OUI**, testé.
- Se réabonne après reconnect : **OUI**, testé.
- Un événement Hotel A peut-il contaminer Hotel B : **NON**, testé explicitement (filtrage strict par `hotelId`).
- Un autre propriétaire peut-il accéder à Hotel A : **NON CONFIRMÉ PAR CE SPRINT** — aucune règle d'ownership modifiée, la garantie backend (E2E-1/DASH-3) reste celle en vigueur ; aucun nouveau test cross-owner mobile n'a été écrit ce sprint (les nouveaux services sont de purs wrappers HTTP sans logique d'autorisation, donc aucun nouveau risque introduit, mais la preuve E2E mobile dédiée reste à faire).
- Un autre tenant peut-il accéder à Hotel A : **NON CONFIRMÉ PAR CE SPRINT**, même raisonnement — le tenant runtime SYNC-2A gère l'en-tête, mais aucun écran staff multi-tenant mobile n'existe encore pour l'exercer réellement.
- Les vrais 403 restent des 403 sans logout : **OUI** (garantie SYNC-2A, inchangée, réutilisée telle quelle).
- Une session révoquée ferme correctement le contexte PMS : **OUI** — le nettoyage centralisé SYNC-2A (401/403 compte désactivé) déconnecte aussi le socket, donc quitte implicitement toute room hôtel active.
- Les notifications PMS sont comprises : **partiellement** — aucun crash (vérifié), mais aucune destination dédiée (deep-link) n'existe encore (§25).
- Deep-links restant manquants : housekeeping, inspection, maintenance, réservation hôtel contextualisés par `hotelId` (§25).
- Le cycle PMS mobile est fonctionnel de bout en bout : **OUI**, démontré par les tests unitaires par étape ; **aucune certification E2E navigateur/appareil réelle n'a été faite** (hors périmètre, réservée à `MOB-E2E`) — distinction explicite entre « fonctionnel, testé unitairement » et « certifié E2E », jamais confondus.
- Ce qui reste pour SYNC-2C : deep-links hospitality, cockpit patrimoine propriétaire, portefeuille hébergement mobile, UI d'assignation employé si confirmée nécessaire, certification E2E mobile du cycle complet.
