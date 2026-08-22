# RBAC-1 — Matrice des menus frontend

Source : `client/lib/pages/dashboard/AdminDashboard.jsx` (`NAV_SECTIONS`, le sidebar réellement rendu — `DashboardSidebar.jsx` est du code mort orphelin, non audité davantage) et `client/lib/navigation/dashboardProfiles.js` (mini-dashboards par profil). Mobile : `altimmo-app/src/navigation/` (aucun menu équivalent — la navigation mobile n'est pas filtrée par rôle au niveau navigateur, seulement au niveau des items de menu `ProfilScreen.jsx`).

| Menu | Web roles | Mobile roles | Backend capability réelle | Drift |
|---|---|---|---|---|
| Dashboard (accueil) | Tous connectés (routage différencié `DashboardHome.jsx`/`RoleDashboardOverview.jsx`/`OwnerDashboard.jsx`/`ClientOverview.jsx` selon rôle) | N/A (pas d'équivalent dashboard staff mobile) | N/A (page composite) | Non applicable |
| ERP | `['Admin']` | N/A | `restrictTo('Admin')` + `requireTenantScope` (`erpRoutes.js`) | Aucun |
| Tenants (plateforme) | `['Admin']` | `PlatformTenantRuntimeContext` : `role==='Admin'` | `restrictTo('Admin')` (`platformTenantRoutes.js`) | Aucun |
| Organisation | `['Admin']` | N/A | `restrictTo('Admin')` (`organizationRoutes.js`) — **sans frontière tenant**, documenté | Aucun |
| API publique | `['Admin']` | N/A | `restrictTo('Admin')` + `requireTenantScope` | Aucun |
| Centre de Pilotage | `['Admin','GestionnaireImmobilier']` | N/A | NON CONFIRMÉ (route précise non tracée dans cet audit) | NON CONFIRMÉ |
| Sales / Rentals / Properties | `ROLES_ALTIMMO` (`AdminDashboard.jsx:32`) ; `ManagePropertiesPage.jsx` élargit à `+CommunityManager` pour l'ajout | N/A | `restrictTo(...STAFF_IMMO)` (portfolio), `restrictTo(...STAFF_CM,'Proprietaire')` (création — inclut bien CommunityManager) | **Potentiel — à vérifier** : le menu de navigation liste `ROLES_ALTIMMO` (sans CM) mais le bouton "Ajouter" à l'intérieur de la page accepte CM (cohérent avec le backend création, donc probablement PAS un vrai drift une fois la bonne route identifiée — à confirmer en RBAC-2) |
| Établissements (Hôtellerie) | `[...ROLES_ALTIMMO,'Proprietaire']` | N/A | `restrictTo(...ROLES_ALTIMMO)` + `HotelStaffAssignment` pour le détail opérationnel | Le menu de haut niveau suit le rôle global ; le contenu réel de la page est ensuite re-filtré par `HotelStaffAssignment`, jamais par le rôle seul — cohérent avec l'architecture documentée |
| Modération (Property/Hotel/Accommodation/autres) | `ROLES_MOD = ['Admin','Collaborateur']` (4 liens) | N/A | `restrictTo(...ROLES_MODERATION)` | Aucun |
| Documents | `ROLES_DOCS` | N/A | `restrictTo(...STAFF_DOC)` + `requireCapability('documents.read'/'documents.manage')` | Aucun (valeurs identiques) |
| Finance (Hôtel) | `['Admin']` | N/A | NON CONFIRMÉ précisément (probablement `financialAuthorizationService`, plus permissif que Admin seul pour d'autres rôles hôteliers via capacités — **à vérifier, candidate drift**) | NON CONFIRMÉ |
| Users | `['Admin']` | N/A | `restrictTo('Admin')` | Aucun |
| Notifications (envoi) | `['Admin']` | N/A | NON CONFIRMÉ | NON CONFIRMÉ |
| Sessions actives / Historique / Export marketing / Publicités | `['Admin']` chacun | N/A | NON CONFIRMÉ en détail (probable `restrictTo('Admin')`) | NON CONFIRMÉ |
| CRM | `ALL_STAFF` | N/A | `restrictTo(STAFF hardcodé dupliquant STAFF_ALL)` + `requireTenantScope` | Valeurs identiques malgré la duplication (§D dans DUPLICATION_MATRIX) |
| Boîte de Réception / Messages contact / Messages clients | `ALL_STAFF` (3 liens) | `ConversationsScreen.jsx` : `STAFF_ROLES=['Admin','Collaborateur']` local | `restrictTo(...ALL_STAFF)` (conversationRoutes) | Le web nav-menu est cohérent avec le backend ; **le mobile réduit localement `isStaff` à 2 rôles seulement** — drift potentiel si un Secretaire/GestionnaireImmobilier/CommunityManager/Communicant utilise l'app mobile en contexte staff (NON CONFIRMÉ si un tel écran mobile staff existe réellement en pratique — l'agent mobile n'a trouvé cet usage que dans `ConversationsScreen.jsx`) |
| Litiges | `ROLES_LITIGES` | N/A | `restrictTo(...ROLES_LITIGES)` | Aucun |
| Emails | `ROLES_DOCS` | N/A | `restrictTo(...STAFF_ALL)` (`companyEmailRoutes.js` router.use) puis `restrictTo('Admin')` sur certaines sous-routes | Le menu limite l'accès à `ROLES_DOCS` (3 rôles) alors que le backend `router.use` de base autorise `STAFF_ALL` (6 rôles) — **le web est plus restrictif que ce que le backend permettrait**, donc pas une fuite de sécurité, mais une incohérence UX potentielle (des rôles staff autorisés par le backend n'ont pas de lien pour y accéder) — **P2, à documenter pour RBAC-2** |
| Marketing Automation | `ROLES_CM` (menu) | N/A | NON CONFIRMÉ précisément câblé à `requireCapability` ou `restrictTo` | `MarketingDashboardPage.jsx` a son propre check local `Admin/CommunityManager` (exclut Collaborateur) — drift déjà noté en §E de `RBAC1_DUPLICATION_MATRIX.md` |
| Mila Events / Altcom Portfolio | `ROLES_CM` | N/A | `requireCapability('events.manage'/'altcom.manage')` | Aucun |
| Estimations/Devis | `ROLES_ESTIM` (5 rôles, menu) | N/A | `ROLES_ESTIMATION` (5 rôles) pour la majorité des routes, **mais une route hardcodée `restrictTo("Admin","Collaborateur")` plus stricte** (`estimationRoutes.js:24`) | **Drift avéré** — le menu promet l'accès à 5 rôles, mais au moins une action backend spécifique le restreint à 2. À déterminer laquelle est correcte en RBAC-2. |

## Réponse directe (mandat §27/§28)

- **Ce que Web/Mobile reçoivent après authentification** : `{_id, name, email, role, phone, photo, isEmailVerified}` (`authController.createSendToken`) — **ni `businessProfiles`, ni `capabilities`, ni `tenantContext` dans la réponse de connexion elle-même**. `businessProfiles` est récupéré séparément par un second appel (`getEffectiveProfiles(userId)`) déclenché après le montage de `AuthContext`. Le contexte tenant est résolu séparément aussi (`PlatformTenantRuntimeContext`, uniquement pour les Admin). Aucune capacité n'est jamais transmise dans le payload d'authentification — chaque système de capacités (§`RBAC1_CAPABILITY_MATRIX.md`) est recalculé indépendamment côté client à partir du seul `role`.
