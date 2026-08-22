# RBAC-3 — MATRICE DE SÉCURITÉ

## Principe non négociable

> Le payload `capabilities` est une projection UX de l'autorisation backend, pas un titre d'habilitation. `can('properties.update')` en React ne sécurise rien : il ne fait qu'afficher/masquer un bouton. Le backend réévalue **toujours** indépendamment via `protect` / `requireCapability` / `restrictTo` / garde tenant / garde ownership.

Ce principe n'a pas changé de nature entre RBAC-2 et RBAC-3 : RBAC-2 a prouvé le calcul canonique côté backend (`getEffectiveCapabilities`), RBAC-3 se contente de le **projeter** vers le client, jamais de le lui déléguer.

## Preuve : le backend ignore un rôle/des capacités forgés côté client

`requireCapability` (`server/middleware/capabilityMiddleware.js:11`) lit exclusivement `req.user?.role`, posé par `authMiddleware.protect` à partir du JWT vérifié et d'une relecture de l'utilisateur en base — **jamais** `req.body`.

Trois tests adversariaux ajoutés dans `server/__tests__/propertyAssetRoutes.mongo.integration.test.js` (describe `"POST /transition — le backend ignore un role/capabilities forgé dans le corps de la requête"`) :

1. Un `Client` envoie `{ target: 'reserve', role: 'Admin' }` → **403** (le rôle du body est ignoré).
2. Un `Client` envoie `{ target: 'reserve', capabilities: ['properties.update'], user: { role: 'Admin', capabilities: ['*'] } }` → **403** (aucune des deux tentatives d'usurpation n'atteint le guard).
3. Un `GestionnaireImmobilier` réel réussit (**200**) sans jamais avoir besoin d'envoyer `role`/`capabilities` dans le body — l'autorisation vient uniquement de l'identité vérifiée.

Résultat : 40/40 tests verts sur ce fichier (37 préexistants + 3 nouveaux).

## Garantie architecturale — pas de mapping rôle→capacités recréé côté client

- Aucun fichier `client/` ne définit `{ Admin: [...], GestionnaireImmobilier: [...] }` pour le calcul d'autorisation. Le seul mapping de ce type qui existait (`client/lib/utils/staffCapabilities.js`) n'a plus de consommateur de production (voir `RBAC3_WEB_MIGRATION_MATRIX.md`) — il n'a pas été supprimé (mandat §23) mais n'est plus la source de vérité d'aucun composant.
- `can(capability)` lit uniquement `user.capabilities`, un tableau **reçu du backend**, jamais recalculé côté client à partir du rôle.
- Le contenu de `server/utils/iamArchitecture.js` n'a été copié nulle part dans `client/`.

## Absence/session ancienne — fail closed, pas de fallback rôle

- `can()` retourne `false` si `user.capabilities` est absent ou ne contient pas la capacité demandée — jamais `true` par défaut (mandat §20).
- Pour une session `localStorage` créée avant ce sprint (`user.capabilities` absent), un effet dédié dans `AuthContext.jsx` appelle `GET /users/me` une seule fois pour rafraîchir l'identité complète (y compris `capabilities`) — **jamais** un fallback `ROLE_CAPABILITIES[user.role]` local (interdit explicitement par le mandat §22). En cas d'échec réseau, l'état reste fail-closed (`capabilities` toujours absent, `can()` retourne `false`) sans boucle de retry — testé (`AuthContextCan.test.jsx`, scénario "échec réseau").
- Ce mécanisme est transitoire et documenté comme tel dans le code (`AuthContext.jsx`, commentaire au-dessus de l'effet) : il s'éteint naturellement à mesure que les sessions antérieures expirent ou sont rafraîchies par un nouveau login.

## `/me` — garde d'exposition

`payload.capabilities` n'est ajouté à la réponse de `GET /users/:id` (dont `/me`) **que** lorsque `requesterId === String(user._id)` — même garde que le champ `platformOperator` préexistant. Un Admin consultant la fiche d'un autre utilisateur via cette route générique ne reçoit jamais les capacités de ce tiers (mandat §12).

## Divergences caractérisées (non corrigées dans ce sprint)

Deux pages identifiées par RBAC-1 comme divergentes par rapport à `isStaffImmo`/`properties.update` ont été réinvestiguées avec preuve backend :

### `GestionLocativePage.jsx` — `canManage = isAdmin || user?.role === 'GestionnaireImmobilier'` (lignes 1308, 1737)

Exclut `Collaborateur`, contrairement à `isStaffImmo`/`properties.update`. Verdict **mixte selon l'action** :
- Désactivation d'un mandat de gestion (`POST /rental-management/:id/deactivate`) : backend utilise `restrictTo('Admin', 'GestionnaireImmobilier')` (`server/routes/rentalManagementRoutes.js:65`) — **cosmétique**, frontend et backend s'accordent, Collaborateur exclu des deux côtés.
- Édition/suppression de biens gérés et création/mise à jour de mandat (`proprietaireRoutes.js`, `rentalManagementRoutes.js` création/update) : backend utilise `STAFF_IMMO`/`rental.manage`, qui **incluent** Collaborateur — **écart réel** : un Collaborateur autorisé côté backend voit le bouton masqué/bloqué côté UI.

### `TransactionsPage.jsx` — `isAdmin = ['Admin','Collaborateur'].includes(user?.role)` (ligne 331)

Exclut `GestionnaireImmobilier`. Toutes les routes réellement appelées (`GET /transactions`, `finalize`, `cancel`, etc.) utilisent `restrictTo(...STAFF_DOC)` = `['Admin','Secretaire','Collaborateur']` (`server/routes/transactionRoutes.js`) — **cosmétique** : le frontend est plus restrictif que nécessaire dans son propre domaine (`STAFF_DOC`, pas `properties.update`), mais le backend exclut déjà GestionnaireImmobilier indépendamment. Aucun accès non autorisé possible.

Effet aparté noté au passage (hors mandat, à tracer séparément) : le bouton de validation de virement est affiché à `Collaborateur` (gated par `isAdmin`) alors que la route réelle `PATCH /:txId/paiements/:pId/valider` est `adminOnly` (Admin seul) — mismatch UI-permissive/backend-strict, sans risque de sécurité (le backend bloquerait), mais UX trompeuse.

**Aucune correction appliquée** à ces deux pages dans ce sprint : la preuve backend existe maintenant, mais toute correction nécessite une validation utilisateur explicite (mandat §27-28 — "jamais 'ça semble logique'").

## Drift indépendant identifié — non traité ici

Le post-login redirect pour `Proprietaire` diverge entre deux résolveurs indépendants :
- `client/lib/navigation/postAuthDestination.js` (utilisé par login email, inscription, vérification email) → `/mon-espace-proprietaire`, qui délègue ensuite à `resolveOwnerDestination` selon les `businessProfiles` réels.
- `client/app/auth/google-redirect/page.jsx` (login Google uniquement) → hardcode `/mes-biens`, sans jamais consulter `businessProfiles`.

Ce drift est un choix de **destination UX post-connexion**, pas une question d'autorisation : l'accès à `/mes-biens` et `/mes-hotels` reste indépendamment protégé au niveau de la route elle-même, quel que soit le résolveur qui y a mené l'utilisateur. Conformément au mandat §33/§71, **ce drift n'est pas corrigé dans RBAC-3** — il est indépendant du modèle de capacités. Recommandation : ouvrir un `HOTFIX-AUTH-POSTLOGIN-ROUTING-1` dédié pour unifier les deux résolveurs.

## Systèmes spécialisés — non modifiés

Aucun fichier `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator`/`platformOperatorConstants`, `hotelAccessConstants`, `tenantContext*`, `tenantResourceAttributionService`, ownership (`propertyAssetController.js`, `propertyAssetLifecycleService.js`) n'a été touché par RBAC-3. `businessProfiles`/`UserBusinessProfile`/`userBusinessProfileService.js` non plus.
