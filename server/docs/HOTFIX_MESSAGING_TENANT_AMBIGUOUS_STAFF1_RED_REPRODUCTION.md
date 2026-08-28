# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Reproduction rouge → verte

## Commande

```
npx jest __tests__/messagingTenantAmbiguousStaff.mongo.integration.test.js
```

Fixtures : Tenant A, Tenant B (`createTenantFixture`), staff mono-tenant A, staff mono-tenant B, staff multi-tenant (adhésion active A **et** B, `addTenantMember` ×2), staff sans aucune adhésion, PlatformOperator (`grantOperator`, aucun tenant sélectionné par défaut), client A (participant de la conversation A), client B (participant de la conversation B). Deux conversations `isStaffInbox:true` sentinelles, une par tenant (`SENTINEL-A`/`SENTINEL-B`), jamais de données réelles.

## AVANT correctif (rouge)

```
Test Suites: 1 failed, 1 total
Tests:       12 failed, 12 passed, 24 total
```

Échecs observés (extraits exacts) :

| Test | Attendu | Reçu (avant fix) |
|---|---|---|
| staff multi sans en-tête → `/staff-inbox` | 403 | **200** (conversations A et B mélangées) |
| staff sans adhésion → `/staff-inbox` | 403 | **200** |
| PlatformOperator global → `/staff-inbox` | 403 | **200** |
| staff ambigu → `GET /:conversationId` (B) | 403 | **200** (contenu complet de B renvoyé) |
| staff ambigu → `DELETE /:conversationId` (B) | 403, DB intacte | **200**, `deletedCount` positif |
| staff ambigu → `PATCH /:conversationId/mark-read` (B) | 403 | **200** |
| staff ambigu → `POST /api/messages` (conversationId=B) | 403, aucun message créé | **201**, message réellement créé, `lastMessage` de B écrasé |
| staff ambigu → `GET /api/messages/:conversationId` (B) | 403 | **200** (messages de B renvoyés) |

Effets de bord confirmés en base AVANT correctif (mêmes assertions que l'audit final) :
- `Conversation.findById(convB._id)` → `null` après l'appel DELETE ambigu (suppression réelle).
- `Message.countDocuments({conversation: convB._id})` → incrémenté après l'appel POST ambigu (message réellement inséré dans la conversation d'un autre tenant).

## APRÈS correctif (vert)

```
Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total
```

Tous les scénarios ambigus renvoient désormais `403` (`TenantContextError`, "Contexte tenant ambigu : sélectionnez explicitement un tenant accessible.") **avant** que le contrôleur ne s'exécute — confirmé par les assertions DB post-appel (aucune suppression, aucun message créé, `lastMessage` de B inchangé).

## Root cause exacte (confirmée par les deux exécutions)

Avant : `attachTenantContext` seul (ne bloque jamais) + `assertConversationAccess`/`tenantConversationFilter`/`keepAttributedConversations`/`sendMessage` traitant `activeTenantId(req)` falsy comme « rien à vérifier ». Après : `requireTenantScopeForStaffOrPlatformOperator` (déjà utilisée par `/count/unread`) intercepte la requête AVANT le contrôleur pour tout staff/PlatformOperator dont le tenant n'est pas résolu — le code vulnérable de `assertConversationAccess` n'est simplement plus jamais atteint dans cet état, sans qu'une seule ligne de `conversationController.js`/`messageController.js` n'ait dû être modifiée.

## Découverte annexe pendant la reproduction (documentée, non corrigée)

Les scénarios "staff A → ressource B, tenant déjà résolu des deux côtés mais différent" (tests 8/10/12) attendaient initialement un `404` (sémantique déjà établie par `assertResourceTenantOrUnattributed`, `error.statusCode = 404`). L'exécution réelle a révélé un **500**, pas un 404 — `errorMiddleware.js` ne lit jamais `err.statusCode` génériquement, seulement `res.statusCode` (déjà 200 à ce stade, car aucun code n'appelle `res.status()` avant de lever cette erreur précise) et une liste de noms d'erreurs explicitement reconnus (`err.name`), qui ne contient pas le nom (absent) de cette erreur. **Le refus est réel et confirmé sans fuite de données** (aucune conversation supprimée, aucun message créé) — seul le code HTTP est incorrect. Documenté dans `_ROOT_CAUSE.md` comme `NEW_MESSAGING_FINDING_OUT_OF_SCOPE` : cause racine différente (bug de sérialisation d'erreur générique, préexistant, affectant potentiellement d'autres appelants de `assertResourceTenant*` au-delà de la messagerie) — **non corrigé dans ce hotfix**, conformément au principe d'un seul root cause par correctif.
