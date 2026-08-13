# PLATFORM-ADMIN-1 — Audit préalable

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`

## 1. Architecture actuelle

### 1.1 Modèle User
`server/models/User.js:43-48` — `role` enum : `['User','Client','Proprietaire','Collaborateur','Secretaire','GestionnaireImmobilier','CommunityManager','Communicant','Admin','Prestataire']`. Aucun champ tenant, aucun flag global (`isSuperAdmin`/`isPlatformAdmin`) n'existe sur `User` ni ailleurs dans le dépôt.

### 1.2 Modèles PlatformTenant / Organisation
- `PlatformTenant` : `rootOrgUnit` (1:1 avec un `OrgUnit` racine), `status` (`trial/active/suspended/archived`).
- `OrgUnit` : hiérarchie auto-référencée, `ancestors[]` matérialisé, racine = `type:'organization'`.
- `OrgMembership` : `{user, orgUnit, roleInUnit, status}` — seul lien entre `User` et un tenant, **jamais direct**.
- `PlatformTenantFeature/Settings/Subscription/Theme/Domain` : configuration par tenant, quotas déclaratifs non appliqués (dette connue, hors périmètre).

Chemin de résolution : `User` → `OrgMembership` (active) → `OrgUnit` → remontée `ancestors` → racine `organization` → `PlatformTenant.rootOrgUnit`.

### 1.3 Résolution de contexte tenant (`server/services/platformTenant/tenantContextService.js`)
Trois fonctions centrales :
- `resolveAvailableTenantsForUser(userId)` — tenants réellement accessibles via `OrgMembership` active.
- `resolveLegacyTenantForUser(userId)` — compatibilité bornée : uniquement si l'utilisateur a **zéro** membership ET est le créateur prouvé (`createdBy` + antériorité de date) d'exactement un tenant.
- `resolveEffectiveTenantContext(userId, requestedTenantId)` — orchestre les deux : tenant explicite validé contre les tenants disponibles → sinon 1 seul tenant disponible → sinon `legacy_fallback` → sinon `null`.

### 1.4 Middleware (`server/middleware/tenantContext.js`)
`requireTenantScope` appelle `resolveEffectiveTenantContext` ; si `null`, 403 avec l'un de trois messages selon le cas (aucun tenant / tenant demandé non accessible / contexte ambigu). Sinon attache `req.platformTenant`, `req.tenantScopeUserIds` (+ miroir sur `req.user.*`).

### 1.5 Remnants PlatformOperator existants
`server/routes/platformTenantRoutes.js` contient déjà `assertOwnTenantOrPlatformOperator` et `rejectUnprovenPlatformOperation`, mais ce sont des **noms trompeurs** : la fonction n'autorise **jamais** un accès à un tenant dont l'utilisateur n'est pas membre (elle jette systématiquement avant toute vérification d'opérateur, faute d'opérateur réel à vérifier). `GET /` et `POST /` (liste/création globale de tenants) sont **inconditionnellement bloquées** pour tout le monde. Confirmé par commentaire explicite (lignes 1-26) et par `TENANT_CERT_3_FINAL_REPORT.md:246` : *« Aucune identité PlatformOperator positive canonique n'existe ; les opérations globales HTTP échouent donc fermées. »* — c'est exactement la dette que ce sprint doit fermer.

Aucun autre remnant : aucune référence "PlatformOperator" côté client, aucune UI de sélection de tenant, aucun header `X-Platform-Tenant-Id` jamais envoyé par le frontend actuel (confirmé par recherche exhaustive).

### 1.6 Portée de `requireTenantScope`
Utilisé par la quasi-totalité des domaines métier : Property/Portfolio, Gestion Locative, Hôtel, Conversations/Messages, Documents, Finance (dashboard), CRM, Marketing, Reporting, ERP, API Platform Admin, ActionLog, Export. **Paiement et Contrat font exception** : ils résolvent le tenant directement via `resolveTenantForUser(userId)` dans un `router.param('id', …)` dédié, sans passer par le middleware — mais via la **même fonction centrale** `resolveEffectiveTenantContext`.

Conséquence architecturale majeure : la quasi-totalité des contrôleurs consomment `req.platformTenant`/`req.tenantScopeUserIds` comme des valeurs opaques déjà résolues, ou délèguent à des paramètres de service déjà optionnels (`tenantId`, `scopeUserIds`). **Une correction centralisée dans `resolveEffectiveTenantContext` + `requireTenantScope` se propage donc à presque tout le système sans toucher individuellement chaque contrôleur.**

Exceptions nécessitant un correctif dédié, identifiées par lecture directe :
- `server/controllers/reportingController.js:21-29` (`scopeParams`) — **force** activement `tenantId: activeTenant._id` même quand `reportingService.js` supporte déjà nativement un mode "toutes tenants" (paramètre `tenantId` optionnel partout, `resolveEffectiveOrgUnitId` retourne `null` proprement).
- `server/routes/platformTenantRoutes.js` — garde bespoke, pas `requireTenantScope`.
- `server/routes/paiementRoutes.js:54`, `server/routes/contratRoutes.js:41` — appellent `resolveTenantForUser(userId)` **sans** transmettre l'en-tête de sélection explicite.
- `server/services/finance/financialAuthorizationService.js:60-87` — capacités **indexées par `role`** (`FINANCIAL_CAPABILITIES[user.role]`), indépendantes du tenant ; `assertFinancialScope` lit `user.platformTenant` (donc bénéficie de la résolution centrale) mais le bypass `role === 'Admin'` (ligne 83) ne couvre pas un opérateur qui n'aurait pas ce rôle.
- `server/controllers/apiPlatformAdminController.js` — force `req.platformTenant._id` partout ; **décision retenue : pas de mode global** pour les clés API (cohérent avec le principe métier « une clé API tenant ne devient jamais globale », mission §32) — un opérateur doit sélectionner un tenant explicite, comme un Tenant Admin le ferait.

## 2. RCA des deux 403 rapportés

### `GET /api/properties/portfolio`
`server/routes/propertyRoutes.js:24-30` : `authController.protect` → `restrictTo(...STAFF_IMMO)` → **`requireTenantScope`** → `propertyPortfolioController.list`. La chaîne s'arrête au milieu : `requireTenantScope` résout `resolveEffectiveTenantContext(userId, null)` → l'opérateur central (aucune `OrgMembership`, pas prouvé créateur unique d'un tenant) → `null` → 403 *"Accès refusé : aucun tenant SaaS actif résolu pour cet utilisateur."* (`tenantContext.js:36`). Le contrôleur n'est jamais atteint.

### `GET /api/conversations/count/unread`
`server/routes/conversationRoutes.js:23,28` : `router.use(authController.protect, requireTenantScope)` monté pour **toutes** les routes de conversation → même résolution, même échec, même 403. `getUnreadCount` (`conversationController.js:345-350`) qui utilise `activeTenantId(req) = req.platformTenant?._id` n'est jamais atteint.

**Cause racine unique et commune aux deux** : un compte destiné à administrer toute la plateforme n'a, par construction correcte, **aucune** `OrgMembership` — c'est exactement le profil qu'un opérateur plateforme doit avoir (il n'appartient à aucun tenant en particulier). Le système actuel n'a aucun moyen de distinguer ce cas légitime d'un compte réellement orphelin/mal configuré : les deux produisent le même 403 fail-closed. La correction n'est donc pas de contourner `requireTenantScope`, mais de lui donner les moyens de reconnaître un `PlatformOperator` réel et de lui offrir un chemin explicite (sélection de tenant via l'en-tête déjà prévu `X-Platform-Tenant-Id`/`X-Tenant-Id`, jamais utilisé jusqu'ici faute d'émetteur légitime).

## 3. Décision d'architecture

**Nouveau modèle canonique `PlatformOperator`**, pas un booléen sur `User` (voir mission §9-10 — traçabilité/révocation/attribution nécessitent un historique, pas un simple flag). Un document par utilisateur, statut mutable (`active/suspended/revoked`), jamais supprimé physiquement.

**Capacités explicites** (`platform.*`), pas un mode "tout ou rien" — un opérateur ne reçoit que les capacités qui lui sont accordées.

**Sémantique de scope à deux modes**, jamais déduite implicitement :
- **Mode plateforme** (aucun tenant sélectionné) : réservé aux capacités *authentiquement* transversales déjà supportées nativement par le service concerné (liste des tenants, reporting exécutif consolidé — `reportingService.js` le permet déjà). **Jamais** fabriqué pour un domaine qui n'a pas déjà cette capacité native (Property Portfolio, Conversations, clés API : pas de mode global inventé — l'opérateur doit sélectionner un tenant, exactement comme un Tenant Admin).
- **Mode tenant sélectionné** (en-tête `X-Platform-Tenant-Id` présent) : l'opérateur agit *comme si* il était membre du tenant choisi — réutilise à l'identique tout le chemin de résolution déjà existant et déjà testé (`req.platformTenant`, `req.tenantScopeUserIds`), sans branche de code séparée pour la donnée elle-même.

Ce choix minimise la surface de code nouveau et — point essentiel pour la sécurité — **réutilise le chemin déjà certifié par TENANT-CERT-3-FINAL pour la lecture/écriture des données**, la seule nouveauté étant *qui a le droit de choisir n'importe quel tenant cible*.

## 4. Plan d'implémentation

1. `server/models/PlatformOperator.js` + `server/constants/platformOperatorCapabilities.js`.
2. `server/services/platformOperator/platformOperatorService.js` (resolve/grant/suspend/revoke/list, intégration ActionLog).
3. `server/scripts/bootstrapPlatformOperator.js` (CLI, dry-run par défaut, jamais de promotion automatique).
4. `tenantContextService.js` : nouvelle fonction `resolvePlatformOperatorContext`, intégrée dans `resolveEffectiveTenantContext` (source unique de vérité, propage à `requireTenantScope`, `resolveTenantForUser`, donc Paiement/Contrat).
5. `tenantContext.js` : messages distincts pour opérateur non scopé, `req.isPlatformOperatorContext`.
6. `platformTenantRoutes.js` : `assertOwnTenantOrPlatformOperator` et `GET/POST '/'` réellement gated par capacité opérateur.
7. `reportingController.js` : mode plateforme natif pour opérateur sans tenant sélectionné.
8. `paiementRoutes.js`/`contratRoutes.js` : transmission de l'en-tête à `resolveTenantForUser`.
9. `financialAuthorizationService.js` : bypass explicite et audité pour opérateur actif avec capacité finance, jamais implicite.
10. Routes de gestion des opérateurs (`platformOperatorRoutes.js`) — jamais auto-promotion, jamais accessible à un Tenant Admin.
11. `ActionLog` : champs additifs (`scopeMode`), traçage des attributions/révocations et interventions cross-tenant.
12. Frontend : sélecteur de contexte minimal dans `AdminDashboard.jsx`, section nav "PLATEFORME" visible uniquement si opérateur actif.
13. Tests adversariaux + positifs + régression tenant complète.

## 5. Risques identifiés avant implémentation

- Le bypass `role === 'Admin'` dans `financialAuthorizationService.js:83` doit être laissé strictement inchangé pour ne pas élargir un comportement déjà certifié — le nouveau chemin opérateur est **additif**, jamais une modification de la condition existante.
- `resolveLegacyTenantForUser` ne doit jamais être modifié pour reconnaître un opérateur — il reste strictement l'ancien mécanisme de compatibilité bornée, indépendant.
- Le mode plateforme (aucun tenant) ne doit jamais être la valeur par défaut silencieuse d'un `tenantId` absent pour un utilisateur non-opérateur — la vérification `PlatformOperator.status === 'active'` doit être positive et explicite avant toute branche de contournement.
