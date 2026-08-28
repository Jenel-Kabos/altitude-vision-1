# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Flux avant/après

## AVANT

```
GET /api/messages/:conversationId
  → protect (auth, 401 sinon)
  → attachTenantContext (résout req.platformTenant, ne bloque jamais)
  → requireTenantScopeForStaffOrPlatformOperator (HF-FINAL-01 — no-op pour Client/Proprietaire ;
     pour staff/PO, exige un tenant résolu, 403 sinon)
  → messageController.getMessages :
      Conversation.findById(conversationId)   // aucun filtre d'autorité
      if (req.platformTenant) assertResourceTenantOrUnattributed(...)  // tenant SEULEMENT, jamais participant
      Message.find({conversation})            // TOUS les messages, sans vérification
      Message.updateMany({..., isRead:false}, {isRead:true})  // effet de bord, sans vérification
      → 200, contenu complet
```

## APRÈS

```
GET /api/messages/:conversationId
  → protect (inchangé)
  → attachTenantContext (inchangé)
  → requireTenantScopeForStaffOrPlatformOperator (inchangé, HF-FINAL-01 non touché)
  → messageController.getMessages :
      Conversation.findById(conversationId)
      await assertConversationAccess(req, convDoc)   // NOUVEAU : tenant (identique à avant) + isStaff-ou-participant
        → si ni staff, ni participant : 403 (ConversationAccessError), FONCTION INTERROMPUE ICI
      Message.find({conversation})            // atteint SEULEMENT si autorisé
      Message.updateMany(...)                 // atteint SEULEMENT si autorisé
      → 200, contenu complet (comportement historique pour tout acteur autorisé)
```

## Extraction (pourquoi un service, pas un import controller→controller)

`assertConversationAccess` est déplacée telle quelle (aucune ligne de logique modifiée) dans un nouveau fichier `services/messagingAuthorizationService.js`. `conversationController.js` importe désormais cette fonction au lieu de la définir localement (ses 4 sites d'appel existants restent inchangés textuellement). `messageController.js` importe la même fonction. Ceci évite d'introduire un nouvel edge controller→controller (catégorie déjà suivie comme dette architecturale limitée par le checker canonique — `npm run architecture:check` la compte explicitement), en respectant le sens de dépendance déjà dominant dans tout le projet (controller → service).

## Ce qui n'a pas changé

- `attachTenantContext`, `requireTenantScopeForStaffOrPlatformOperator` : non touchés (imports, ordre, comportement).
- `assertResourceTenantOrUnattributed`, `resolveResourceTenant` (`tenantResourceAttributionService.js`) : non touchés.
- Le contenu et l'ordre de la requête `Message.find`/`Message.updateMany`/`serializeMessage` : strictement identiques pour tout appelant qui passe la nouvelle vérification.
- `conversationController.js` : les 4 fonctions qui utilisaient déjà `assertConversationAccess` continuent de l'utiliser, avec un comportement identique (seule la localisation du code — désormais un import — change, jamais la logique).
