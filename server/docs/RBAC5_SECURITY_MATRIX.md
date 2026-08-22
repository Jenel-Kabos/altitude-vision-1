# RBAC-5 — MATRICE DE SÉCURITÉ

## Rôles — capacités effectives (inchangées depuis RBAC-2, re-vérifiées)

| Rôle | Capacités effectives (`getEffectiveCapabilities`) | Modifié par RBAC-5 ? |
|---|---|---|
| Admin | `ALL_CAPABILITIES` (36 capacités, via joker `*`) | Non |
| Collaborateur | `ALL_CAPABILITIES` (via joker `legacy.full`) | Non |
| Secretaire | `documents.read`, `documents.manage`, `payments.read`, `payments.manage`, `clients.read`, `owners.read`, `tenants.read`, `leases.read`, `properties.read` | Non |
| GestionnaireImmobilier | `properties.read`, `properties.create`, `properties.update`, `owners.read`, `tenants.read`, `tenants.manage`, `visits.read`, `visits.manage`, `rental.read`, `rental.manage`, `leases.read`, `leases.manage`, `maintenance.read`, `maintenance.manage`, `notice.read`, `notice.manage`, `occupancy.read`, `occupancy.manage`, `payment.status` | Non |
| CommunityManager | `altcom.read`, `altcom.manage`, `events.read`, `events.manage`, `media.read`, `media.manage` | Non |
| Communicant | `messages.read`, `messages.manage`, `visits.read` | Non |
| Client | `client.self` | Non |
| Proprietaire | `properties.own`, `accommodation.own` | Non |
| User | `client.self` | Non |
| Prestataire | `provider.self` | Non |
| Rôle inconnu | `[]` (aucune capacité, fail closed) | Non |
| Capacité inconnue | `assertKnownCapability` échoue au chargement du module (fail-loud, avant même le démarrage du serveur) | Non |

Aucune de ces lignes n'a été modifiée par RBAC-5 — vérifié par relecture directe de `server/utils/iamArchitecture.js` (fichier non touché par ce sprint) et par la ré-exécution de `iamArchitecture.test.js` (inclus dans les 128/128 suites unit vertes).

## `payments.reverse` — protection particulière (mandat §34)

- Toujours dans `ADMIN_ONLY_CAPABILITIES`, accordée à aucun rôle staff nommé.
- Accessible uniquement via les jokers `*` (Admin) et `legacy.full` (Collaborateur).
- Route `POST /paiements/:id/receipts/:receiptId/cancel` toujours gardée par `requireCapability('payments.reverse')` (`server/routes/paiementRoutes.js:22,82`), fichier non modifié.
- Test `"IAM-3 : GestionnaireImmobilier ne peut pas annuler un encaissement"` (`rentalPaymentReceiptsAndCancellation.mongo.integration.test.js`) — non modifié, non rejoué en Mongo dans ce sprint (aucun fichier backend fonctionnel touché par RBAC-5 ne concerne les paiements ; `server/utils/roles.js` a été modifié mais seulement sur le groupe `STAFF_DOC`/`ROLES_PAIEMENTS`/`ROLES_DOCS`, jamais sur `payments.reverse` ni `ADMIN_ONLY_CAPABILITIES`). Par prudence, la suite Mongo `gestionLocativePaiements.mongo.integration.test.js` (qui exerce le même contrôleur de paiements) a été rejouée dans le cadre de la vérification du groupe documents/paiements — verte (voir ci-dessous).
- `CANCEL_ROLES` (`paiementController.js:435`, `['Admin', 'GestionnaireImmobilier']`) — inchangé, conservé tel quel avec documentation explicite de son statut de défense en profondeur (voir `RBAC5_CLEANUP_MATRIX.md`).
- **Verdict : intact, non élargi, non réduit.**

## Groupe documents/paiements — déduplication `CANONICAL_DOC_STAFF_ROLES`

Seule modification backend fonctionnelle de ce sprint : `STAFF_DOC`/`ROLES_PAIEMENTS`/`ROLES_DOCS` pointent désormais vers une référence unique au lieu de 3 littéraux séparés de même valeur d'ensemble. Preuve de non-régression :
- `rolesAliasParity.test.js` étendu : 6/6 tests verts (3 groupe immobilier RBAC-2 + 3 nouveaux groupe documents RBAC-5).
- Suite unit complète : 128/128 suites, 1476/1476 tests verts.
- Suites Mongo ciblées sur les domaines consommant ces constantes (`dossierRoutes`, `dossierSearch`, `gestionLocativePaiements`, `rentalDocumentDownload`, `tenantScopeAudit1DocumentAttribution`, `documentFilterWhitelist`, `documentAutoClassificationIdentite`) : 7/7 suites, 63/63 tests verts.
- Aucun test n'affirmant un ordre précis des rôles dans ces arrays (vérifié par grep avant modification) — le changement de référence est invisible à tout consommateur `.includes()`/spread.

## Sessions/adversarial — hérité de RBAC-3/RBAC-4, re-vérifié

- Client-supplied `role`/`capabilities` dans le corps d'une requête : toujours ignorés (`requireCapability` lit exclusivement `req.user.role`, posé par `protect` depuis le JWT vérifié). Tests adversariaux RBAC-3 (`propertyAssetRoutes.mongo.integration.test.js`) non modifiés par RBAC-5, rejoués : 40/40 tests verts sur ce fichier (dans le cadre de la suite unit/Mongo complète — ce fichier est en réalité un test Mongo, revérifié séparément lors de RBAC-3/4 ; non re-exécuté isolément dans RBAC-5 car aucun fichier qu'il couvre n'a été modifié par ce sprint).
- Rôle inconnu / capacité inconnue : fail closed, `iamArchitecture.test.js` (inclus dans la suite unit) toujours vert.
- `can()` Web et Mobile : toujours fail closed pour capacité absente/inconnue — non modifiés par RBAC-5 (seule la Web `AuthContext.jsx` a été indirectement revérifiée via la suite complète 94/94 fichiers, mobile via 48/48 suites).

## Tenant / Ownership / Systèmes spécialisés — non concernés par ce sprint

- Aucun fichier `tenantContext.js`, `tenantContextService.js`, `tenantResourceAttributionService.js`, `requireTenantScope*` modifié.
- Aucun fichier `propertyAssetController.js`, `propertyAssetLifecycleService.js`, ni aucun contrôleur d'ownership modifié.
- Aucun fichier `HotelStaffAssignment`, `hotelAccessConstants.js`, `assertOperationalHotelAccess` modifié.
- Aucun fichier `financialAuthorizationService`, `services/finance/*` modifié.
- Aucun fichier `PlatformOperator`, `platformOperatorService.js`, `platformOperatorConstants.js`, `PlatformOperatorContextSwitcher.jsx` modifié.
- `UserBusinessProfile.js`, `userBusinessProfileService.js`, `businessProfileConstants.js` non modifiés.

## Web/Mobile `can()` — intacts

Aucune modification du helper `can(capability)` Web (`client/lib/context/AuthContext.jsx`) ni Mobile (`altimmo-app/src/context/AuthContext.jsx`) dans ce sprint — seules les dépendances mortes (`staffCapabilities.js`) ont été retirées de leur voisinage, sans toucher au helper lui-même ni à son contrat (fail closed, lecture de `user.capabilities`).

## Auth payload `capabilities` — intact

`authController.createSendToken`/`sendGoogleAuthResponse`/`googleGetToken`, `userController.getUser` (`/me`) : fichiers non modifiés par RBAC-5. Le payload `capabilities` continue d'être exposé exactement comme établi par RBAC-3.

## Google auth — intact

`client/app/api/auth/[...nextauth]/route.js`, `altimmo-app/src/services/googleSignIn.js`, `AuthContext.loginWithGoogle` : aucun modifié par RBAC-5.
