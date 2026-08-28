# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Audit des requêtes (find/aggregate/count)

## Pattern "staff sans tenant → requête globale" (mandat §11)

Recherche explicite de `tenant ? {...} : {}`, `if (tenant) filter.tenant = ...`, `req.platformTenant || undefined` et équivalents dans `controllers/`+`services/` :

| Occurrence | Fichier | Verdict |
|---|---|---|
| `ApiKey.find(tenant ? {tenant} : {})` | `services/publicApi/apiKeyService.js:104` | **CLEAN** — appelant (`apiPlatformAdminController.listKeys`) passe toujours `req.platformTenant._id`, garanti non-null par `requireTenantScope` au niveau routeur (fail-closed) |
| `tenantConversationFilter` (`activeTenantId(req) ? {$or:[...]} : {}`) | `controllers/conversationController.js:38` | **🔴 HF-FINAL-01** — aucune garde routeur équivalente sur `/staff-inbox`, le cas `{}` (aucun filtre) est réellement atteignable par un staff légitime |
| `...(tenantId ? {tenant: tenantId} : {})` | `controllers/dashboardAnalyticsController.js:23` | **CLEAN** — `requireTenantScopeForAnalytics` au niveau routeur empêche un staff ambigu d'atteindre ce code avec `tenantId` vide (403 avant même le contrôleur) ; la branche `role==='Proprietaire' → tenantId:null` est un choix de conception distinct (scope par ownership, hors du périmètre tenant), non ré-audité en profondeur ce sprint |
| `...(activeTenantId(req) ? {tenant: activeTenantId(req)} : {})` (Message, `getUnreadCount`) | `controllers/conversationController.js:423` | **Faible impact** — fuite d'un compteur agrégé uniquement (pas de contenu), même cause racine que HF-FINAL-01, mentionnée dans le blast radius |

## Listes tenant-scoped — branches vérifiées

Pour les domaines déjà certifiés (HZ-01→HZ-07), `find`/`countDocuments`/`populate`/pagination/tri ont été revérifiés cohérents entre eux via la ré-exécution du cluster de tests (137/137 verts) — aucune divergence du type "find scopé mais countDocuments global" trouvée dans ces surfaces.

Pour le Dev Portal (`apiPlatformAdminController.js`), vérifié explicitement : `listApiKeys` (find), `getCallLogs` (find + validation de `apiKeyId`), `getWebhookSubscriptions` (find) sont TOUS filtrés par le même `tenant: req.platformTenant._id` — aucune divergence.

## Agrégations (`aggregate([...])`) — priorité mandat §16/§24

- `dashboardAnalyticsController.js::accommodations` (ligne 26) : le `$match` sur `independent` (qui inclut conditionnellement `tenant`) est bien le **premier stage** du pipeline — le tenant est appliqué avant tout `$lookup`/`$group` en aval. Protégé en amont par le garde routeur fail-closed (voir tableau ci-dessus).
- Les autres fonctions d'agrégation du même fichier (hotels, reporting) suivent le même schéma structurel (`$match` en tête) par lecture rapide du fichier — **non vérifiées ligne à ligne avec le même niveau de preuve que la fonction `accommodations`**, marquées `NON CONFIRMÉ` à ce niveau de détail plutôt que supposées identiques.
- Finance (`FinancialDocument`/`FinancialPayment`/`PaymentAllocation`) : agrégations non examinées en détail ce sprint au-delà de la vérification de `assertFinancialScope` (fail-closed confirmé pour l'accès par hôtel) — **NON CONFIRMÉ** pour d'éventuels rapports agrégés multi-documents.

## Conclusion

Le seul cas confirmé où l'absence de garde routeur laisse une requête réellement dégénérer en accès global est `tenantConversationFilter` dans `getStaffInbox`/`keepAttributedConversations` (HF-FINAL-01). Toutes les autres occurrences du pattern `tenant ? {...} : {}` identifiées dans le code sont protégées en amont par une garde de routeur fail-closed qui empêche le cas `{}` d'être réellement atteint par un appelant légitime.
