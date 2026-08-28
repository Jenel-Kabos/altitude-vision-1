# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Audit des relations cross-tenant (create/update/populate)

## Création — tenant/owner fourni par le client ?

`grep -rn "tenant: req.body.tenant\|owner: req.body.owner"` sur `controllers/`+`services/` → **aucune occurrence**. Vérifié explicitement pour :
- `Accommodation`/`Property` (déjà établi lors du mandat `HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1` : `tenant: actingUser.platformTenant?._id || actingUser.platformTenant || null`, jamais depuis le body).
- `ApiKey` : `tenant: tenant || null` où `tenant` vient du paramètre serveur (`req.platformTenant._id`), jamais de `req.body.tenant` (le contrôleur ne le lit jamais dans `req.body`).
- `Conversation` : `tenant` est calculé par `resolveConversationTenantId` (dérivé de `activeTenantId(req)` pour le staff, ou de la ressource Property pour un client) — jamais un champ accepté tel quel depuis le body.

**Aucune relation de création cross-tenant pilotable par le client n'a été trouvée.**

## Mise à jour — `...req.body`/`Object.assign` sans whitelist

`grep -rn "Object.assign(.*req.body)\|findByIdAndUpdate(.*req.body)"` — plusieurs occurrences légitimes trouvées (ex. `contratController.js:174`, domaine sans tenant, hors périmètre — voir `_OBJECT_ID_AUDIT.md`). Pour les domaines tenant-scopés (Accommodation/Hotel/Property/Conversation), les contrôleurs déjà audités (HZ-01→HZ-07) construisent leurs objets de mise à jour à partir de listes de champs explicites (`ALLOWED_FIELDS`, `buildAccommodationData`, etc.), jamais un spread brut de `req.body` sur un document déjà chargé sans re-vérification du tenant. Non re-détaillé ligne à ligne ce sprint au-delà de cette confirmation structurelle (cohérent avec les certifications HZ déjà obtenues et revérifiées vertes).

## Relations cross-tenant via ObjectId fourni par le client

- `Conversation.relatedProperty`, `Hotel` (via `HotelReservation`), `Accommodation.hotel` : la création de ces relations est déjà couverte par HZ-01→HZ-06 (validation de l'existence ET de l'appartenance tenant de la ressource référencée avant liaison — ex. `resolveHotel` dans `accommodationService.js`, déjà audité lors du mandat `HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1`).
- Aucune nouvelle relation cross-tenant pilotable par le client n'a été identifiée dans le périmètre Messaging audité ce sprint — HF-FINAL-01 est un problème de **lecture/suppression/envoi** sur une ressource existante, pas de **création** d'une relation cross-tenant falsifiée.

## Populate sensible

- `getStaffInbox` peuple `participants` (name/email/photo/role) et `relatedProperty` (title/images) — **c'est exactement le contenu exposé par HF-FINAL-01** lors de la fuite de liste (voir `_FINDING_MATRIX.md`), pas une fuite additionnelle distincte via populate lui-même : le populate est correct dans son principe (il peuple ce que la requête a le droit de renvoyer) — c'est la requête en amont qui est en cause, pas le populate.
- Aucun autre populate cross-tenant historique trouvé dans les surfaces auditées ce sprint (Dev Portal, Dashboard Analytics) — les `populate` de `apiPlatformAdminController.js` (`apiKey`) portent sur des documents déjà eux-mêmes filtrés par tenant en amont.

## Documents / téléchargements

`messageController.js::downloadAttachment` (seul endpoint de téléchargement audité en détail ce sprint dans le périmètre Messaging) : confirmé **CLEAN** — la connaissance de `messageId`+`attachmentId` ne suffit pas, `staffAllowed` exige un tenant résolu ET correspondant exactement à celui de la conversation (voir `_OBJECT_ID_AUDIT.md`). Les autres endpoints de documents/factures (`documentRoutes.js`, `rentalDocumentRoutes.js`, finance) n'ont pas été ré-audités avec la même rigueur ce sprint — `NON CONFIRMÉ`, pas déclarés propres par défaut.

## Conclusion

Aucune nouvelle relation de création/mise à jour cross-tenant pilotable par le client n'a été démontrée. Le populate impliqué dans HF-FINAL-01 n'est pas une cause additionnelle, seulement le vecteur d'exposition du contenu déjà mal filtré en amont.
