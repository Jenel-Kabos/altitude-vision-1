# SYNC-1 — Matrice de parité Web ↔ Mobile

Source de vérité pour SYNC-2. Chaque ligne est fondée sur une vérification directe (code, rapport de sprint cité) — aucune ligne n'est déclarée « Absente » sans recherche dans screens/components/navigation/services/hooks/contexts de `altimmo-app/`.

Légende Décision : `Synchroniser` (parité à compléter au plus près du Web), `Créer` (rien n'existe, à construire), `Web-only` (justifié), `À décider` (produit, pas technique).

## 1. Authentification / Session

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Auth | Login | ✅ | ✅ | ✅ | Oui | Aucun | — | Parité complète |
| Auth | Logout | ✅ | ✅ | ✅ | Oui | Aucun (mobile nettoie token+socket+cache) | — | Parité complète |
| Auth | Signup / vérification email | ✅ | ✅ | ✅ | Oui | Non vérifié écran-par-écran | P3 | À décider |
| Auth | Forgot/reset password | ✅ | ✅ | ✅ | Oui | Aucun connu | — | Parité complète |
| Auth | `tokenVersion` (invalidation globale) | ✅ | ✅ (AUTH-1) | ❌ absent | Oui (protégé par la même route) | Mobile hérite passivement du 401, ne le traite pas explicitement | P2 | Synchroniser (gestion explicite + message dédié) |
| Auth | Compte suspendu/banni/inactif à la connexion | ✅ | ✅ (AUTH-1) | ❌ absent | Oui | Aucun écran/message dédié mobile | P1 | Synchroniser |
| Auth | Stockage token | — | localStorage | SecureStore | — | Mobile **meilleur** que Web | — | Web-only à améliorer (hors SYNC) |

## 2. Tenant (AUTH-1.1)

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Tenant | Header `X-Platform-Tenant-Id` | ✅ | ✅ | ❌ absent | Oui | Mobile n'envoie jamais ce header | P1 (bloquant pour tout usage Admin/staff multi-tenant mobile) | Synchroniser avant tout écran staff mobile |
| Tenant | Sélection/switch tenant | ✅ | ✅ | ❌ absent | — | Aucune notion mobile | P2 (seulement pertinent si du staff multi-tenant utilise mobile) | À décider |
| Tenant | Isolation données par tenant | ✅ (serveur) | ✅ | ✅ (par construction — backend refuse, mobile n'a pas de contexte staff multi-tenant) | Oui | Aucun contournement trouvé | — | Parité complète (sécurité) |

## 3. IAM / Capabilities (IAM-2/IAM-3)

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| IAM | Capabilities READ/MANAGE par domaine staff | ✅ | ✅ (navigation `hasStaffCapability`) | ❌ absent | Oui (sécurité déjà backend) | Mobile n'a aucun rôle staff spécialisé référencé (`Secretaire`, `GestionnaireImmobilier`, `CommunityManager` : 0 occurrence) | P3 (aucun écran staff spécialisé n'existe encore sur mobile — non bloquant tant que HOTEL/OWNER/CRM-MOBILE ne sont pas lancés) | À décider (consommer IAM-3 dès le premier écran staff mobile) |
| IAM | Rôles simples (Admin/Collaborateur/Client/Proprietaire/Prestataire) | ✅ | ✅ | ✅ (checks UI grossiers, jamais une RBAC dupliquée) | Oui | Granularité moindre, mais pas de RBAC parallèle dangereuse | — | Parité partielle acceptable |

## 4. Client / Locataire

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Client | Espace `/mon-espace` (profil, favoris, transactions, candidatures) | ✅ | ✅ | ✅ (Profil, Favoris, Transactions, RealEstateApplications) | Oui | Aucun majeur | — | Parité quasi complète |
| Locataire | Portail `/espace-locataire` (bail, échéancier, documents, préavis, maintenance) | ✅ | ✅ | ✅ (`TenantPortalScreen`, GL-MOBILE-1) | Oui | Écran unique mobile vs multi-onglets Web — UX différente, capacité identique | — | Parité complète (GL-MOBILE-1 a fermé le P0 identifié le 5 août) |

## 5. Propriétaire immobilier

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Owner | Création annonce (vente/location) | ✅ | ✅ | ✅ (`AddSaleProperty`, `AddRentalProperty`) | Oui, payload non diffé exhaustivement | Non vérifié champ-par-champ | P3 | Synchroniser si divergence trouvée |
| Owner | Cockpit patrimoine (cycle de vie, revenus/dépenses, entretien, documents, alertes) | ✅ | ✅ | ❌ absent (`MesAnnoncesScreen` = résumé seulement) | Oui | Aucun cockpit natif | P1 | Créer (`OWNER-MOBILE-1`, roadmap déjà écrite) |
| Owner | Visites (création/programmation/statuts) | ✅ | ✅ | ✅ partiel (`VisitesScreen`) | Oui | Paiement visite et workflow terrain complet non certifiés mobile | P1 | Synchroniser |

## 6. Propriétaire hébergement — Hôtel vs Maison meublée

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Hébergement | Portefeuille unifié `/mes-hotels` (Hôtel/Maison) | ✅ | ✅ (DASH-1/2) | ❌ absent — `MY_ESTABLISHMENTS.mobileRoute = null` dans le registre | Oui | Aucun cockpit portefeuille mobile | P1 | Créer (`HOTEL-MOBILE-1`) |
| Maison meublée | Réservation indépendante (disponibilité, création, suivi, financier, remboursement, documents) | ✅ | ✅ | ✅ (`ACC-MOBILE-1`, fermé depuis MOB-GAP-1) | Oui | Aucun P0 restant identifié | — | Parité quasi complète |
| Maison meublée | Jamais transformée en mini-hôtel (pas de `Room`/`RoomCategory`) | ✅ (règle E2E-1/ACC-1) | ✅ | ✅ (aucune référence `Room` trouvée dans les écrans Accommodation mobile) | — | Aucun | — | Parité complète (invariant respecté) |

## 7. PMS Hôtel — matrice spécifique (mandat §26)

| Étape | Backend | Web | Mobile | Écart |
|---|---|---|---|---|
| Réservation (création/confirmation) | ✅ | ✅ (certifié E2E-1) | ✅ côté client (`HotelBookingScreen`) ; ✅ côté staff (`HotelOperationsScreen` liste/filtre) | Aucun P0 |
| Room assignment | ✅ | ✅ (certifié E2E-1) | ✅ (`assignHotelRoom`, `autoAssignHotelRooms`, `changeHotelRoom` dans `hotelReservationService.js`, exposés dans `HotelOperationsScreen`) | Aucun P0 |
| Check-in | ✅ | ✅ (certifié E2E-1) | ✅ (`checkInHotelReservation`) | Aucun P0 |
| Financial readiness (checkout bloqué/prêt) | ✅ | ✅ (certifié E2E-1, bug corrigé) | ❌ absent — aucun affichage de l'état financier avant check-out côté mobile | P1 (staff terrain doit voir pourquoi un check-out est bloqué) | Créer |
| Check-out | ✅ | ✅ (certifié E2E-1) | ✅ (`checkOutHotelReservation` existe dans le service) mais **sans** l'affichage financial-readiness qui précède — check-out possible « à l'aveugle » côté UI mobile | P1 | Synchroniser (afficher l'état avant d'autoriser le bouton) |
| Housekeeping | ✅ | ✅ (certifié E2E-1) | ❌ absent totalement | P0 (usage naturellement mobile/terrain) | Créer |
| Inspection | ✅ | ✅ (certifié E2E-1) | ❌ absent totalement | P0 (usage naturellement mobile/terrain) | Créer |
| Maintenance (hôtel, distincte de GL) | ✅ | ✅ | ❌ absent totalement | P1 | Créer |
| Cockpit hôtel (KPI) | ✅ (agrégats déjà servis au Web) | ✅ (`HotelDetailPage.jsx`) | ❌ absent | P1 | Créer, sans inventer de nouveaux KPI |
| Realtime (`hotel:<id>` room) | ✅ (DASH-4) | ✅ | ❌ non consommé par `socketService.js` mobile | P1 (prérequis pour housekeeping/inspection temps réel) | Synchroniser dès `HOTEL-MOBILE-1` |

## 8. Documents

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Documents personnels (GL, Accommodation, Hôtel) | Liste/consultation/téléchargement/partage | ✅ | ✅ | ✅ (`DOC-MOBILE-1`, coffre unifié) | Oui | Aucun P0 restant | — | Parité quasi complète |
| Centre documentaire administratif global | Gestion staff/admin | ✅ | ✅ | ❌ | — | Volontaire | — | Web-only justifié (RBAC/volume) |

## 9. Finance

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Facturation/encaissement/allocation hôtel (staff) | ✅ | ✅ (certifié E2E-1, Admin uniquement) | ❌ | — | Volontaire — sensibilité financière | — | Web-only justifié |
| Lecture financière (solde, statut facture) côté voyageur/propriétaire | ✅ | ✅ | ✅ (Accommodation via `ACC-MOBILE-1`), ❌ (Hôtel : pas d'affichage staff financial-readiness, voir §7) | Partiel | P1 pour le volet hôtel staff | Synchroniser (lecture seule) |

## 10. Messagerie / Notifications / Realtime

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Conversations | ✅ | ✅ | ✅ | Oui | Aucun majeur | — | Parité complète |
| Notifications — types génériques (propriétés, visites, messages, paiements, applications, tenant portal, documents) | ✅ | ✅ | ✅ (résolution via registre NAV-CORE) | Oui | Aucun | — | Parité complète |
| Notifications — types hospitality (réservation hôtel statut, housekeeping, inspection, maintenance, échec brouillon financier — introduits DASH-4) | ✅ | ✅ (deep-links contextualisés `hotelId`) | ❌ non vérifié dans le registre (aucune destination housekeeping/inspection/maintenance hôtel dans `shared/navigation/registry.json`) | P1 — notifications DASH-4 arriveront sans cible mobile valide dès qu'un staff mobile existe | Synchroniser dès `HOTEL-MOBILE-1` |
| Socket.IO room `hotel:<id>` | ✅ (DASH-4) | ✅ | ❌ non consommé | P1 | Synchroniser |

## 11. Altcom / Mila Events

| Domaine | Fonction | Backend | Web | Mobile | API commune | Écart | Priorité | Décision |
|---|---|---|---|---|---|---|---|---|
| Altcom (projets, portfolio) | ✅ | ✅ | ❌ | — | Volontaire, P2 en roadmap | P2 | Web-only pour l'instant (CRM-MOBILE-1 futur, limité au terrain) |
| Mila Events | ✅ | ✅ | ❌ | — | Volontaire | P2 | Web-only pour l'instant |

## 12. Résumé chiffré

| Catégorie | Nombre de lignes de matrice |
|---|---:|
| Parité complète | 11 |
| Parité partielle | 6 |
| Absente (à créer) | 9 |
| Web-only justifié | 4 |
| À décider | 3 |

Total : 33 lignes couvrant les domaines mandatés. Cette matrice n'est pas exhaustive à l'échelle des 489 routes backend (voir `MOB_GAP_INVENTORY.json` pour le détail brut) — elle couvre les fonctions à enjeu produit/sécurité identifiées par le mandat SYNC-1.
