# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Matrice des findings

## HF-FINAL-01 — Frontière tenant contournée sur la messagerie staff quand le contexte tenant est ambigu

| Champ | Valeur |
|---|---|
| ID | HF-FINAL-01 |
| Surface | `GET /api/conversations/staff-inbox`, `GET /api/conversations/:conversationId`, `GET /api/conversations/:conversationId/messages`, `PATCH /api/conversations/:conversationId/mark-read`, `DELETE /api/conversations/:conversationId`, `POST /api/messages` (chemin `conversationId`), portion `staffInboxUnread` de `GET /api/conversations/count/unread` |
| Fichiers | `server/controllers/conversationController.js` (`assertConversationAccess`, `keepAttributedConversations`, `tenantConversationFilter`, `getStaffInbox`, `getUnreadCount`), `server/controllers/messageController.js` (`sendMessage`, chemin `conversationId`) |
| Type | Contournement de frontière tenant pour un rôle STAFF quand le contexte tenant est ambigu/non résolu |
| Rôle affecté | Tout rôle de `ALL_STAFF` (Admin, Collaborateur, et tous les sous-rôles staff) ayant une adhésion (`OrgMembership` active) à **au moins deux tenants distincts**, sans en avoir sélectionné un explicitement (en-tête `X-Platform-Tenant-Id` absent) |
| Tenant A / B | Démontré avec deux tenants créés via `platformTenantService.createTenant`, un staff membre actif des deux |

## Preuve (reproduction réelle, vrai Mongo, requête HTTP réelle)

Script de diagnostic temporaire (créé, exécuté, **supprimé avant la fin de cet audit**, conformément au mandat §34) :
1. Tenant A et Tenant B créés, chacun avec son admin bootstrap.
2. Un staff (`role: 'Collaborateur'`) reçoit une adhésion active (`OrgMembership`) à la racine organisationnelle de A **et** de B.
3. Une conversation `isStaffInbox:true` est créée pour A (`lastMessage: 'SECRET-TENANT-A-MESSAGE'`), une autre pour B (`lastMessage: 'SECRET-TENANT-B-MESSAGE'`).
4. `GET /api/conversations/staff-inbox` est appelé avec le JWT du staff, **sans en-tête `X-Platform-Tenant-Id`** (comportement par défaut, aucune sélection de tenant).

Résultats observés :
```
STATUS 200
IDS RETURNED [ <id conversation A>, <id conversation B> ]
CONTAINS A? true
CONTAINS B? true
```
→ **Les deux conversations, de deux tenants distincts, sont retournées ensemble.**

Comparaison avec `GET /api/conversations/count/unread` (même précondition, même staff, sans en-tête) :
```
UNREAD STATUS 403 "Contexte tenant ambigu : sélectionnez explicitement un tenant accessible."
```
→ Cette route sœur, protégée par `requireTenantScopeForStaffOrPlatformOperator` (fail-closed), bloque correctement le même scénario. **`/staff-inbox` ne porte aucune garde équivalente** — seul `restrictTo(...ALL_STAFF)` la protège, aucun contrôle de résolution du tenant.

Avec en-tête explicite sélectionnant A :
```
SCOPED STATUS 200 IDS [ <id conversation A> ] CONTAINS B? false
```
→ Le mécanisme de filtrage tenant fonctionne correctement **quand un tenant est résolu** — la faille est uniquement l'absence de garde fail-closed quand il ne l'est pas.

Accès direct par ObjectId à la conversation B (sans en-tête, même staff ambigu) :
```
DETAIL B STATUS 200
```
→ Lecture cross-tenant réussie par simple connaissance de l'ObjectId.

Suppression directe de la conversation B (sans en-tête, même staff ambigu) :
```
DELETE B STATUS 200 { deletedCount: 0 }
CONV B STILL EXISTS AFTER DELETE ATTEMPT? false
```
→ **La conversation du tenant B a été réellement supprimée** par un staff n'appartenant pas à ce tenant de façon univoque — action destructive cross-tenant confirmée en conditions réelles.

## Cause racine

`activeTenantId(req) = req.platformTenant?._id`. Quand le contexte est ambigu (staff multi-tenant sans sélection explicite) ou non résolu, `req.platformTenant` est `null` (comportement documenté et voulu de `resolveEffectiveTenantContext`, voir `tenantContextService.js:110-123` — `tenants.length > 1` retourne `null` par construction). Trois fonctions de `conversationController.js` traitent alors l'absence de tenant comme « rien à vérifier » plutôt que « refuser » :
- `tenantConversationFilter(req)` retourne `{}` (aucun filtre) au lieu de restreindre.
- `keepAttributedConversations(req, conversations)` retourne la liste **sans filtrage** (`if (!activeTenantId(req)) return conversations;`).
- `assertConversationAccess(req, conversation)` ignore totalement `assertResourceTenantOrUnattributed` (`if (activeTenantId(req)) {...}`) puis n'exige plus qu'`isStaff || isParticipant` — et `isStaff` est vrai pour n'importe quel staff, de n'importe quel tenant.

`messageController.js::sendMessage` reproduit le même contournement (`if (req.platformTenant) {...}`) sans second contrôle avant d'autoriser l'envoi dans la conversation.

## Comparaison avec le reste du code (le contournement est un écart, pas la norme)

`accommodationReservationController.js:122`, `organizationController.js:42`, `propertyController.js:57/69`, et `messageController.js::downloadAttachment` (`staffAllowed = ... && conversation?.tenant && req.platformTenant && String(conversation.tenant) === String(req.platformTenant._id)`) appliquent tous un **fail-closed strict** : absence/ambiguïté de tenant → refus. `conversationController.js` est la seule surface identifiée qui inverse cette convention pour le staff.

## Blast radius

- **Confidentialité** : lecture de conversations, messages, informations de participants (nom/email/photo/rôle) et de biens liés (titre/images) d'un tenant tiers.
- **Intégrité** : suppression réelle d'une conversation et de ses messages appartenant à un autre tenant ; envoi de messages dans une conversation d'un autre tenant (usurpation potentielle de réponse staff).
- **Disponibilité** : non concernée directement.
- **Précondition d'exploitation** : un compte staff légitime avec adhésion active à ≥2 tenants — un cas structurellement supporté par le modèle de données (`OrgMembership` n'interdit pas la multi-appartenance), pas un contournement de contrôle d'accès en amont. Aucune élévation de privilège nécessaire : le comportement apparaît par défaut, dès que l'appelant omet l'en-tête de sélection de tenant (ce qu'un client HTTP simple ferait naturellement sans logique spécifique).

## Classification

- **Severity : P0** (lecture ET suppression cross-tenant réelles, sans élévation de privilège requise au-delà d'un rôle staff légitime déjà multi-tenant).
- **Status : CONFIRMED_RUNTIME** (reproduit en HTTP réel contre vrai Mongo, preuve conservée ci-dessus).
- **Exploitability : STATICALLY_EXPLOITABLE + CONFIRMED_RUNTIME** (aucune barrière technique, comportement par défaut).

## Hotfix recommandé (NON appliqué — read-only)

Aligner `conversationController.js` sur la convention fail-closed déjà majoritaire dans le codebase :
1. Router : ajouter `requireTenantScopeForStaffOrPlatformOperator` (déjà utilisé par `/count/unread`, déjà importé dans ce même fichier) sur `GET /staff-inbox`.
2. `assertConversationAccess` : remplacer `if (activeTenantId(req)) {...}` par un contrôle qui, pour le STAFF, exige un tenant résolu ET correspondant (comme `messageController.js::downloadAttachment` le fait déjà) — ne jamais retomber sur `isStaff` seul.
3. `keepAttributedConversations` : ne jamais renvoyer la liste non filtrée pour un appelant STAFF sans tenant résolu.
4. `messageController.js::sendMessage` (chemin `conversationId`) : même exigence avant d'autoriser l'envoi.

Nom de sprint suggéré (à ne PAS démarrer ici) : `HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1`.

## RBAC-FINAL-01 — `GET /accommodations/:id/availability-blocks` accessible à tout utilisateur authentifié, sans ownership (finding RBAC, distinct du tenant)

| Champ | Valeur |
|---|---|
| Surface | `GET /:id/availability-blocks`, et potentiellement `POST /:id/availability-blocks` / `DELETE /:id/availability-blocks/:blockId` (même fonction d'autorisation partagée) |
| Fichiers | `routes/accommodationRoutes.js:44-47`, `controllers/accommodationReservationController.js::authorizedCalendarAccommodation` (ligne 22-28) |
| État actuel vérifié | **Toujours présent** — confirmé par lecture directe du code à la date de cet audit (pas supposé depuis l'historique) |
| Cause | La route ne porte **aucun `restrictTo(...)`** (contrairement à ses voisines `/admin/list`, `/status/pending`) — seul `auth.protect` (authentification) s'applique. `authorizedCalendarAccommodation` n'ajoute `query.tenant` que `if (isStaff(req.user) && !isPlatformWide(req.user))` (ligne 24) — pour un rôle non-staff (Client, Proprietaire d'un AUTRE bien), aucun filtre tenant NI ownership n'est appliqué : `Accommodation.findOne({_id: req.params.id})` seul, sans vérifier `property.owner === req.user.id`. La fonction sœur `calendar` (ligne 210) ajoute bien `isStaff \|\| owner===req.user.id` **après** l'appel, mais `listBlocks` (ligne 202-205) ne le fait pas. |
| Impact | Un Client ou Proprietaire authentifié quelconque peut lister les blocages de disponibilité (dates bloquées, motifs) de **n'importe quel** hébergement indépendant du système, appartenant à n'importe quel autre propriétaire/tenant, par simple connaissance/énumération de son ObjectId. `createBlock`/`deleteBlock` partagent la même fonction d'autorisation de base — **non vérifié avec certitude si un garde ownership additionnel existe plus loin dans `service.createBlock`/le bloc `deleteBlock`**, marqué `NON CONFIRMÉ` pour l'écriture, `CONFIRMED` (lecture de code) pour la lecture. |
| Classification | **RBAC FINDING, pas un finding tenant-scope au sens strict** (la fuite touche l'ownership/rôle, la dimension tenant n'est qu'une des deux couches manquantes) — classé séparément conformément au mandat §30. Severity : **P1/P2** (fuite d'information de planification, pas de données financières ni de PII directe ; à confirmer si `createBlock`/`deleteBlock` sont pareillement exposés, ce qui élèverait la sévérité). |
| Statut | STATICALLY_EXPLOITABLE (confirmé par lecture de code ligne par ligne, non reproduit en HTTP réel faute de budget temps dans cet audit — **NON CONFIRMÉ_RUNTIME**, contrairement à HF-FINAL-01) |
| Recommandation | Sprint RBAC dédié (mandat §30 le prévoit explicitement) : ajouter la même vérification `isStaff(req.user) || String(accommodation.property?.owner) === String(req.user.id)` que `calendar` à `listBlocks`, `createBlock`, `deleteBlock`. **NE PAS corriger ici.** |

## Autres findings

Aucun autre nouveau P0/P1 tenant-scope démontré dans le périmètre effectivement audité à la même profondeur (dev-portal/API keys : CLEAN, confirmé par lecture directe du code — voir `_ROUTE_INVENTORY.md`). Les domaines listés comme "non ré-audités en détail" dans `_ROUTE_INVENTORY.md` restent `UNKNOWN`/`NON CONFIRMÉ` à ce niveau de profondeur, pas certifiés propres — cette distinction est volontaire et honnête (mandat §48).
