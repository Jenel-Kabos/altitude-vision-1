# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Cause racine

## Où la résolution du tenant devient ambiguë

`services/platformTenant/tenantContextService.js::resolveEffectiveTenantContext` (ligne 110-123) : pour un utilisateur avec `OrgMembership` active dans **plus d'un** `PlatformTenant` (`tenants.length > 1`) et aucun `X-Platform-Tenant-Id` explicite, la fonction retourne `null` **par construction** — un choix de conception délibéré (l'ambiguïté doit être tranchée explicitement), pas un bug. Même résultat (`null`) pour un utilisateur sans aucune adhésion et sans fallback legacy.

## Où `conversationController.js` ignorait cette ambiguïté

`activeTenantId(req) = req.platformTenant?._id` — `undefined` dans les deux cas ci-dessus. Trois points traitaient cela comme « rien à vérifier » :
1. `tenantConversationFilter(req)` → `{}` (aucun filtre) au lieu de restreindre.
2. `keepAttributedConversations(req, conversations)` → `if (!activeTenantId(req)) return conversations;` (aucun filtrage).
3. `assertConversationAccess(req, conversation)` → `if (activeTenantId(req)) {...}` (ignoré si absent), puis seul `isStaff || isParticipant` reste requis — `isStaff` étant vrai pour **tout** rôle `ALL_STAFF`, de **tout** tenant.

`messageController.js::sendMessage` reproduisait le même défaut (`if (req.platformTenant) {...}`, chemin `conversationId`) sans second contrôle avant d'autoriser l'envoi. `messageController.js::getMessages` avait le même défaut pour la dimension tenant (voir limite ci-dessous).

## Pourquoi `/count/unread` était déjà sûre

`routes/conversationRoutes.js:38` (avant comme après ce hotfix) : `router.get('/count/unread', requireTenantScopeForStaffOrPlatformOperator, getUnreadCount);`. Ce middleware (`middleware/tenantContext.js::createRequireTenantScope({allowPlatformWide:false, requireWhen: staff-or-operator})`) est exécuté **avant** le contrôleur et **bloque explicitement** (403, `res.status(403)` puis `next(error)`) quand `resolved === false` pour un staff/PlatformOperator. Aucune des autres routes de ce fichier ne portait ce même garde au niveau routeur — c'est l'écart exact.

## Primitive canonique réutilisée (pas une nouvelle politique)

`requireTenantScopeForStaffOrPlatformOperator` — déjà définie dans `middleware/tenantContext.js`, déjà importée dans `conversationRoutes.js`, déjà prouvée correcte par son usage existant sur `/count/unread`. Son prédicat `requireWhen: ({req, isPlatformOperator}) => isPlatformOperator || ALL_STAFF.includes(req.user?.role)` en fait un **no-op garanti** pour tout rôle non-staff (Client/Proprietaire) — c'est cette propriété précise qui permet de l'appliquer sans risque de régression sur des routes partagées entre staff et clients (`GET /:conversationId`, `.../messages`, `mark-read`, `DELETE`).

## Pourquoi les autres routes n'étaient pas sûres

Elles ne portaient **aucune** garde de routeur — seule `attachTenantContext` (qui ne bloque jamais, par conception, pour ne pas casser l'accès des clients, cf. bandeau POST-E2E-1 du fichier) s'appliquait, laissant chaque contrôleur entièrement responsable de sa propre frontière — frontière qui, pour le staff ambigu, n'existait tout simplement pas.

## Limite explicitement documentée, hors périmètre de ce hotfix

`messageController.js::getMessages` (`GET /api/messages/:conversationId`) ne vérifie **jamais** l'appartenance de l'appelant à la conversation (ni `participant`, ni `isStaff`) — même quand le tenant est correctement résolu et correspondant. C'est une **cause racine différente** (absence totale de contrôle d'ownership, pas un contournement de frontière tenant ambiguë) : la dimension tenant de cette route est corrigée par ce hotfix (garde routeur ajoutée), mais l'absence de contrôle participant/staff en tenant résolu **n'est pas corrigée ici**, conformément au mandat (« ne pas élargir automatiquement »).

**Classé : `NEW_MESSAGING_FINDING_OUT_OF_SCOPE` — absence de vérification participant/staff sur `GET /api/messages/:conversationId`, indépendante de HF-FINAL-01, à traiter dans un sprint dédié séparé (RBAC/ownership Messaging).**

Également classé `NEW_MESSAGING_FINDING_OUT_OF_SCOPE` (déjà documenté dans `_RED_REPRODUCTION.md`) : `errorMiddleware.js` retourne 500 au lieu de 404 pour les erreurs `assertResourceTenant*` (nom d'erreur non reconnu, `err.statusCode` jamais lu génériquement) — un défaut de contrat HTTP préexistant, sans impact sur l'autorisation réelle (aucune fuite), non corrigé ici.
