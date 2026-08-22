# RBAC-1 — Matrice des capacités existantes

Découverte majeure de cet audit : il n'existe pas une seule notion de "capability" dans ce codebase, mais **5 systèmes de capacités indépendants**, à des degrés de maturité et d'application réelle très différents. Aucun n'a été modifié.

| Capability system | Définie où | Backend enforcement | Web use | Mobile use | Domaine |
|---|---|---|---|---|---|
| **`server/utils/iamArchitecture.js` (`DEFAULT_CAPABILITIES`)** | Backend, `DEFAULT_CAPABILITIES` par rôle (ex. `properties.read`, `rental.manage`, `visits.read`, `documents.manage`, `messages.manage`, `altcom.manage`, `events.manage`) | **RÉEL — `capabilityMiddleware.requireCapability(...)`, câblé dans 10 fichiers de routes** : `rentalManagementRoutes.js`, `visiteRoutes.js`, `documentRoutes.js`, `eventRoutes.js`, `rentalMaintenanceRoutes.js`, `altcomRoutes.js`, `gestionDocumentRoutes.js`, `locataireRoutes.js`, `contratRoutes.js`, `paiementRoutes.js`. Toujours en complément d'`authController.protect`, jamais seul. | Copie manuelle (`client/lib/utils/staffCapabilities.js`), utilisée pour filtrer `AdminDashboard.jsx` NAV_SECTIONS et `RoleDashboardOverview.jsx` | Copie manuelle (`altimmo-app/src/utils/staffCapabilities.js`), **jamais consommée** (dead code) | Gestion Locative, Documents, Visites, Événements, Altcom, Maintenance, Contrats, Paiements |
| **`server/constants/hotelAccessConstants.js` (`HOTEL_OPERATIONAL_CAPABILITIES` + `HOTEL_FINANCIAL_CAPABILITY_VALUES`)** | Backend, capacités scopées à un `Hotel` précis via `HotelStaffAssignment.capabilities[]`, avec des valeurs par défaut par `assignmentRole` (`hotel_manager`, `reception`, `housekeeping`, `inspector`, `maintenance`, `finance`, `viewer`) | **RÉEL** — `hotelAccessScopeService.assertHotelCapability`/`assertOperationalHotelAccess`, consommé par les contrôleurs hôteliers (rooms, housekeeping, maintenance, room assignment — confirmé par commentaires explicites remplaçant d'anciens checks de rôle global) | NON CONFIRMÉ (aucun consommateur direct de ces valeurs de capacité trouvé côté web dans cet audit — le web semble piloter l'hôtellerie via rôle global + `businessProfiles.exploitant_etablissement`) | NON CONFIRMÉ directement (le mobile a un commentaire explicite renonçant à utiliser `hasStaffCapability` sur `HotelHousekeepingScreen.jsx`, au profit de la seule autorité backend) | Hôtellerie opérationnelle (réservations, check-in/out, chambres, ménage, inspection, maintenance) |
| **`server/services/finance/financialAuthorizationService.js` (`CAPABILITIES` + `FINANCIAL_CAPABILITIES[role]`)** | Backend, capacités financières **dérivées du rôle global** (pas d'assignation séparée comme Hotel), plus un chemin `hasPlatformOperatorFinanceCapability` pour les opérateurs plateforme | **RÉEL** — `assertFinancialCapability`, `assertFinancialScope`, `authorizeFinancialAction`, une douzaine de fonctions `assertCanX` dérivées via `withCapability(...)`, consommées par les contrôleurs financiers/hôteliers | NON CONFIRMÉ (aucune trace directe côté web dans cet audit — probablement piloté par rôle global + résultats d'API déjà filtrés) | NON CONFIRMÉ | Documents financiers, paiements, réconciliation, tableau de bord financier hôtel |
| **`server/constants/platformOperatorConstants.js` (`PLATFORM_OPERATOR_CAPABILITIES`)** | Backend, capacités **transversales plateforme** (`platform.tenants.manage`, `platform.properties.manage`, `platform.finance.manage`...), portées par le modèle `PlatformOperator` — explicitement distinct de `User.role==='Admin'` (Admin reste tenant-scopé) | RÉEL (service `platformOperatorService.js`, non détaillé ligne à ligne dans cet audit mais le modèle et les routes `platformOperatorRoutes.js` existent et sont `restrictTo('Admin')`-gated en entrée, avec vérification de capacité en second niveau) | `PlatformTenantRuntimeContext.jsx` (web) et son équivalent mobile consomment le **statut** opérateur (accès ou non au sélecteur multi-tenant), pas les capacités individuelles dans le détail audité ici | NON CONFIRMÉ en détail | Administration plateforme multi-tenant (SaaS), gouvernance cross-tenant |
| **`server/utils/roles.js` (groupes de rôles, PAS des capacités au sens strict)** | Backend, groupes nommés (`STAFF_ALL`, `STAFF_IMMO`, `STAFF_DOC`, `STAFF_CM`, `ROLES_*`) | RÉEL — c'est le système historique dominant, câblé dans `restrictTo(...)` sur la majorité des routes (voir `RBAC1_DOMAIN_MATRIX.md`) | Copié partiellement dans `client/lib/utils/staffRoles.js` (`isStaffImmo`, `isStaffDocs`) + de nombreuses redéfinitions inline (voir `RBAC1_DUPLICATION_MATRIX.md`) | NON — le mobile ne réplique aucun groupe `roles.js`, gère l'accès staff différemment (peu d'écrans staff mobile identifiés) | Transversal — tous domaines |

## Constat clé

**Le codebase a déjà, de façon organique et non coordonnée, tenté 4 fois de construire un système de capacités** (`iamArchitecture.js`, `hotelAccessConstants.js`, `financialAuthorizationService.js`, `platformOperatorConstants.js`), avec des conventions de nommage cohérentes entre elles (`domaine.action`, ex. `properties.manage`, `hotel.manage`, `platform.finance.manage`) mais **jamais unifiées en un seul registre**. `server/utils/iamArchitecture.js` est explicitement commenté comme une "projection additive" ("ne remplace aucun guard") — c'est la tentative la plus proche d'un système générique, déjà branchée sur 10 routes réelles. **C'est la fondation la plus mature à réutiliser pour RBAC-2**, plutôt que d'inventer un 6e système.

## Capacités manquantes — proposition conceptuelle (non implémentée, mandat §23)

En observant les domaines déjà couverts par au moins un des 4 systèmes existants et ceux qui ne le sont par aucun (Property/Sales/Rentals listing CRUD lui-même, Modération, CRM, Litiges, Estimations/Devis, Conversations, Business Profiles admin), une extension cohérente de la convention `iamArchitecture.js` pourrait couvrir :

```
properties.read / properties.manage / properties.moderate
sales.manage / rentals.manage          (déjà en partie couverts par rental.* existant)
moderation.property.decide / moderation.hotel.decide / moderation.accommodation.decide
crm.read / crm.manage
litiges.read / litiges.manage
estimations.read / estimations.manage / devis.manage
conversations.staff.access
business_profiles.grant / business_profiles.revoke
financial.manual.confirm               (déjà couvert par financial.payment.confirm existant)
```

Ces noms sont purement conceptuels, à valider domaine par domaine en RBAC-2 — **rien de ceci n'a été codé dans RBAC-1**.
