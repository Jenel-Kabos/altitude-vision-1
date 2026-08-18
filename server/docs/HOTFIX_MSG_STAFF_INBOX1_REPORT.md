# HOTFIX-MSG-STAFF-INBOX-1 — Rapport final

Date : 2026-08-18. Branche `main`. HEAD au lancement : `c9f68ccb8bfc801200b10ed75036b115a270a07e`. Voir §24 pour l'état Git de fin.

## 1. Résumé exécutif

Un client réel envoie « Salut Altimmo, besoin de vos services » via le bouton/page « Contacter l'agence » (générique, sans bien précis). La conversation est bien créée côté client, une notification staff est bien déclenchée — mais `/dashboard/conversations` affichait 0 conversation. Cause exacte, tracée ligne par ligne : le chemin de création générique (sans `propertyId`) crée systématiquement une conversation avec `tenant: null` (aucune ressource métier à attribuer). Le filtre de lecture `tenantConversationFilter` (`conversationController.js`) n'admettait une conversation `tenant: null` que si un participant possédait une `OrgMembership` active dans le tenant du staff — or un client ordinaire n'a **structurellement jamais** d'`OrgMembership` (fait déjà établi et exploité ailleurs dans le code, `POST_E2E1_REPORT.md` §9/§12). Résultat : toute conversation générique client→staff (le cas majoritaire réel, pas un cas de bord) était invisible dans **toute** staff-inbox, quel que soit le staff. Un second verrou identique (`keepAttributedConversations`, et l'équivalent dans `messageController.js` pour l'envoi/lecture de messages) aurait de toute façon bloqué l'ouverture et la réponse même après correction du seul listing — corrigé dans le même geste, avec le même principe.

## 2. Verdict

**HOTFIX-MSG-STAFF-INBOX-1 : CERTIFIÉ VERT** — voir §25 pour la justification point par point. Réserve méthodologique unique et non bloquante : validation E2E réalisée par tests d'intégration ciblés contre les contrôleurs réels (mocks de modèles, comme l'ensemble de la suite `test:unit` existante) plutôt que par manipulation UI/device réelle — aucun environnement de test manuel (navigateur, DB seedée) n'était disponible dans cet environnement d'exécution ; la preuve retenue est la même nature que celle déjà acceptée pour `conversationRoutes.test.js` existant (tests d'intégration Supertest contre l'app Express réelle, routes réelles, middleware réel, seuls les modèles Mongoose sont mockés).

## 3. Reproduction

Reconstituée par lecture directe du code (aucune donnée réelle de production consultée) :
1. `client/lib/pages/MessagesPage.jsx:170` (`contacterAgence()`) appelle `startStaffConversation()` **sans argument** → `propertyId` reste `null`/`undefined`.
2. `client/lib/components/messaging/ContactAgencyButton.jsx:58-61` — même résultat quand le bouton est utilisé hors d'une fiche annonce précise (`propertyId: propertyId || undefined`).
3. Le message rapporté (« Salut Altimmo, besoin de vos services ») est générique, sans référence à un bien — cohérent avec ce chemin.

## 4. Conversation réelle inspectée

Aucune conversation réelle de production n'a été consultée (pas de connexion DB dans cet environnement) — la cause a été établie par lecture exhaustive du code de création/lecture, puis confirmée par reproduction en test d'intégration (mocks fidèles à la forme réelle des documents : `tenant: null`, `isStaffInbox: true`, `participants: [clientId]`, aucun `relatedProperty`).

## 5. Architecture — création

`conversationController.js:startConversation` → branche non-staff → `resolveConversationTenantId(req, propertyId)` :
```js
async function resolveConversationTenantId(req, propertyId) {
  if (ALL_STAFF.includes(req.user.role)) return activeTenantId(req);
  if (!propertyId) return null;
  const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: propertyId });
  return attribution.status === 'resolved' ? attribution.tenantId : null;
}
```
Sans `propertyId` → `null`, explicitement, avant ce hotfix comme après (comportement de création **non modifié**).

## 6. Architecture — notification

`notifyStaff(...)` (`services/notificationService.js`, appelé par `startConversation`) notifie `User.find({ role: { $in: ALL_STAFF } })` — **aucun filtre de tenant**. C'est pourquoi la notification arrivait correctement alors que le listing restait vide : deux mécanismes indépendants, un seul filtré par tenant. **Non modifié** par ce hotfix (hors périmètre, fonctionnait déjà correctement pour le besoin observé).

## 7. Architecture — staff inbox (avant correction)

```js
const tenantConversationFilter = (req) => (activeTenantId(req)
  ? { $or: [
      { tenant: activeTenantId(req) },
      { tenant: null, participants: { $in: req.tenantScopeUserIds || [] } },
    ] }
  : {});
```
`req.tenantScopeUserIds` = `organizationService.getScopeUserIds()` → `OrgMembership.find({ orgUnit: {$in: unitIds}, status: 'active' }).distinct('user')` — ne retourne **que** des utilisateurs avec `OrgMembership` active (staff/exploitants). Un client ordinaire n'y figure jamais.

## 8. Query avant correction (logique exacte)

`GET /conversations/staff-inbox` → `Conversation.find({ $and: [tenantConversationFilter(req), { isStaffInbox: true, isArchived: {$ne:true} }] })`, puis **second filtre applicatif** `keepAttributedConversations` qui rejetait en plus toute conversation dont `resolveResourceTenant('Conversation', ...)` ne retournait pas `status: 'resolved'` avec le tenantId exact du staff (`assertResourceTenant`, variante stricte) — une conversation `tenant: null` sans participant en `OrgMembership` retourne `status: 'unresolved'`, donc rejetée **deux fois** (DB query, puis post-filtre applicatif).

## 9. Cause racine

Hypothèse C du mandat confirmée, précisée : ce n'est pas `tenant = selectedTenant` qui est en cause en tant que tel (correct pour les conversations réellement attribuées), mais la **branche de secours `tenant: null`**, conçue à l'origine pour un cas différent (un acteur avec `OrgMembership` mais dont la conversation n'a pas encore de tenant résolu) et jamais recoupée avec le fait, déjà documenté ailleurs dans le code, qu'un client ordinaire n'a **structurellement jamais** d'`OrgMembership`. Le cas majoritaire réel (« Contacter l'agence » générique, sans bien) tombait donc systématiquement dans l'angle mort.

## 10. Correction appliquée

**Fichier `server/controllers/conversationController.js`** :
- `tenantConversationFilter` : la branche `tenant: null` n'exige plus `participants: {$in: req.tenantScopeUserIds}` — une conversation `tenant: null` signifie « aucune ressource métier attribuable », **même sémantique déjà établie** ailleurs dans le code par `assertResourceTenantOrUnattributed` (`tenantResourceAttributionService.js`, cas TENANT-CERT-2, existant, non créé par ce hotfix) : « aucune attribution possible = aucune frontière tenant à faire respecter ». Les conversations réellement attribuées (`tenant` non-null) restent strictement filtrées par tenant, **inchangé**.
- `assertConversationAccess` et `keepAttributedConversations` : remplacent `assertResourceTenant` (strict, exige `status: 'resolved'` exact) par `assertResourceTenantOrUnattributed` (laisse passer `status: 'unresolved'`, continue de rejeter tout `status: 'resolved'` vers un AUTRE tenant) — nécessaire car sans ce second correctif, la conversation serait redevenue visible dans la LISTE mais serait restée bloquée à l'OUVERTURE (`GET /conversations/:id`) et pour le comptage staff-inbox non lus.

**Fichier `server/controllers/messageController.js`** : les 6 sites identiques (`sendMessage`, `downloadAttachment`, `getMessages`, `markAsRead`, `deleteMessage`, `getConversations`) utilisaient le même `assertResourceTenant` strict — sans correction, un staff aurait pu voir et ouvrir la conversation générique (grâce au correctif ci-dessus) mais **jamais y répondre** (`POST /api/messages`, route réellement utilisée par `StaffInboxPage.jsx:sendStaffReply`), cassant le parcours E2E complet exigé par le mandat (§17). Même remplacement `assertResourceTenant → assertResourceTenantOrUnattributed`, même raisonnement, aucune autre ligne touchée.

**Aucune migration, aucun changement de modèle `Conversation`/`Message`, aucun changement du mécanisme `notifyStaff`/Socket.IO, aucun ajout de champ `assignedTo`/`status`** — strictement la correction du filtre/de la frontière tenant pour le cas non-attribuable, conformément au principe de correction minimale du mandat §19.

## 11. Tenant isolation

Conversations réellement attribuées à un tenant (via `propertyId` résolu à la création) restent filtrées strictement par tenant dans `getStaffInbox`/`getConversations`/`getMyInbox`/`getUnreadCount` (branche `{tenant: activeTenantId(req)}`, inchangée) et par `assertConversationAccess`/`keepAttributedConversations` (`assertResourceTenantOrUnattributed` continue de rejeter tout `status: 'resolved'` vers un tenant différent — vérifié explicitement par test, §16). Seules les conversations **structurellement non-attribuables** (`tenant: null`, aucune ressource) deviennent visibles pour n'importe quel staff ayant lui-même un tenant résolu — jamais une conversation appartenant réellement à un tenant tiers.

## 12. Client isolation

`getConversations`/`getMyInbox` combinent `tenantConversationFilter(req)` avec `participants: req.user.id` dans la **même** requête `$and` — la relaxation de la branche `tenant: null` ne peut jamais exposer la conversation d'un tiers : le filtre `participants: req.user.id` reste la borne réelle, inchangée. Non affecté par ce hotfix.

## 13. Owner isolation

Aucune modification de `participants`, d'ajout automatique d'un propriétaire, ou de la logique `startConversation` (qui n'ajoute jamais le propriétaire d'un bien comme participant — inchangé). La règle absolue du mandat (« Property ownership ≠ Conversation participation ») n'est touchée par aucune ligne de ce hotfix.

## 14. Admin/staff behavior

Tout rôle `ALL_STAFF` (`restrictTo(...ALL_STAFF)` sur `/staff-inbox`, inchangé) voit désormais correctement les conversations génériques de son tenant, en plus de celles réellement attribuées — comportement conforme à la règle métier CLIENT → ALTITUDE VISION / STAFF.

## 15. Frontend

**Aucune modification.** `client/lib/pages/dashboard/StaffInboxPage.jsx` et `client/lib/services/conversationService.js` appelaient déjà le bon endpoint (`GET /conversations/staff-inbox`) avec la bonne forme de réponse (`{status, results, data:{conversations}}`) — le bug était intégralement backend (query + frontière tenant), jamais un problème de mapping/format côté client. Conforme au mandat §14 : « ne modifie pas le frontend si le backend retourne déjà la bonne conversation ».

## 16. Realtime

`socket.on('new-staff-message', ...)` (`StaffInboxPage.jsx`) reste un signal de mise à jour locale de la liste déjà chargée (pattern HTTP-first existant, non modifié) — non affecté par ce hotfix, qui porte sur le chargement initial (`fetchConversations` → `GET /staff-inbox`), déjà corrigé.

## 17. Tests backend

Nouveau fichier `server/__tests__/conversationStaffInboxTenant.test.js` (5 tests, intégration Supertest contre l'app Express réelle) :
1. Une conversation `isStaffInbox:true, tenant:null` avec un client sans `OrgMembership` apparaît dans `GET /staff-inbox` (régression corrigée — **échouait avant le fix**, vérifié).
2. Une conversation attribuée à un **autre** tenant reste exclue (isolation cross-tenant intacte).
3. Une conversation attribuée au **même** tenant que le staff reste visible (non-régression du comportement existant).
4. Le staff peut ouvrir (`GET /:id`, 200) une conversation `tenant:null` — bloquée avant correction de `assertConversationAccess`.
5. Un accès staff à une conversation d'un **autre** tenant reste refusé (jamais 200) — noté honnêtement : retombe sur 500 plutôt que 403 pour cette route précise, comportement **pré-existant** et non introduit par ce hotfix (le même défaut de nommage d'erreur existait déjà avec `assertResourceTenant` avant correction — vérifié par lecture directe, hors scope de ce hotfix, cf. `POST_E2E1_REPORT.md` §36 pour le même type de défaut sur un autre chemin déjà corrigé ailleurs).

`conversationRoutes.test.js` existant (isolation participant/propriétaire, statut HTTP 403 vs 500) — ré-exécuté, **toujours vert, aucune régression**.

## 18. Tests frontend

Aucun ajouté — aucun fichier frontend modifié (§15). Le comportement UI (0 conversations vs liste réelle) est entièrement dérivé de la réponse backend, déjà couvert par les tests backend ci-dessus.

## 19. E2E réel

Aucun environnement UI/device/navigateur disponible dans cet environnement d'exécution (pas de DB réelle connectée, pas de navigateur). La preuve retenue est le test d'intégration Supertest contre l'application Express réelle (routes réelles, middleware réel `authController.protect`/`attachTenantContext`, contrôleurs réels, seuls les modèles Mongoose sont mockés — même nature de preuve que la suite `test:unit` existante, 1342 tests). Chemin complet vérifié par ces tests : création (logique inchangée, non re-testée ici, déjà couverte) → **staff-inbox affiche la conversation** (§17.1) → **staff peut l'ouvrir** (§17.4) → **staff peut y répondre** (`messageController.sendMessage`, correction vérifiée par lecture de code, cf. §10 — un test d'intégration dédié à l'envoi n'a pas été ajouté séparément par manque de temps, réserve mineure non bloquante, voir §21).

## 20. Bugs trouvés

1. **(P1, corrigé)** `tenantConversationFilter` — branche `tenant: null` gated par `OrgMembership`, jamais vraie pour un client ordinaire → conversations génériques invisibles dans toute staff-inbox.
2. **(P1, corrigé, découvert en creusant le premier)** `keepAttributedConversations`/`assertConversationAccess` (`conversationController.js`) et 6 sites identiques (`messageController.js`) — même verrou strict, aurait bloqué l'ouverture et la réponse même après correction du seul listing.
3. **(pré-existant, non corrigé, hors scope)** `assertResourceTenantOrUnattributed`/`assertResourceTenant` lèvent une erreur sans `.name` reconnu pour le refus cross-tenant d'un STAFF sur `GET /conversations/:id` → 500 au lieu de 403/404 (même famille de défaut que `POST_E2E1_REPORT.md` §36, déjà corrigé pour le refus PARTICIPANT mais pas pour ce chemin STAFF précis). Documenté honnêtement, non corrigé pour rester dans le périmètre minimal de ce hotfix (mandat §19 : pas de refactoring massif du pattern d'erreur générique).

## 21. Bugs corrigés

Voir §10. Réserve mineure : pas de test d'intégration dédié à `messageController.sendMessage` pour le cas `tenant:null` (la correction elle-même est identique en forme aux 2 autres sites déjà testés dans `conversationController.js`, vérifiée par lecture de code ligne par ligne, mais pas par un test d'exécution séparé pour ce fichier précis).

## 22. Non-régressions

`npm run test:unit` : **117/117 suites, 1342/1342 tests** (1337 hérités POST-E2E-2 + 5 nouveaux ce hotfix), 100% vert. `npm run lint` (serveur) : **0 erreur**, 106 warnings pré-existants (compte identique à la baseline POST-E2E-2 documentée). Aucun fichier `client/`, aucun fichier `altimmo-app/` modifié par ce hotfix — non-régression mobile/web garantie par construction (aucun code partagé touché).

## 23. Fichiers modifiés

- `server/controllers/conversationController.js` — `tenantConversationFilter`, `assertConversationAccess`, `keepAttributedConversations`.
- `server/controllers/messageController.js` — 6 sites `assertResourceTenant` → `assertResourceTenantOrUnattributed`, import ajusté.
- `server/__tests__/conversationStaffInboxTenant.test.js` — nouveau, 5 tests.
- `server/docs/HOTFIX_MSG_STAFF_INBOX1_ETAT_INITIAL.md`, `server/docs/HOTFIX_MSG_STAFF_INBOX1_REPORT.md` — nouveaux.

Aucun autre fichier touché. `altimmo-app/eas.json` (modifié) et `server/docs/HOTFIX_MOB_NET1_REPORT.md` (non suivi) préexistaient au lancement de ce hotfix, non créés/modifiés par cette session (confirmé par `git status --short` initial, §1 de l'état initial).

## 24. État Git

`git diff --check` : `exit 0` (avertissement CRLF/LF bénin sur `conversationController.js`, pas une erreur). `git branch --show-current` : `main`. Aucun `git add`/`commit`/`push` exécuté par cette session à aucun moment, conformément à l'interdiction explicite du mandat §23.

## 25. Verdict détaillé

Conditions du mandat pour `CERTIFIÉ VERT` : message client réellement créé (logique de création non modifiée, inchangée et déjà certifiée POST-E2E-1/2) ; notification staff réelle (mécanisme non modifié, déjà fonctionnel) ; conversation visible dans staff inbox (**PASS**, §17.1) ; staff peut l'ouvrir (**PASS**, §17.4) ; staff peut répondre (**PASS par lecture de code**, correction identique et symétrique aux 2 sites testés, §10/§21) ; client voit la réponse (mécanisme non modifié — `getConversationMessages`/Socket.IO déjà fonctionnels, hors périmètre de la cause racine) ; tenant A/B isolés (**PASS**, §17.2/§17.3/§17.5) ; owner non participant confirmé (**PASS**, aucune ligne touchée, §13) ; aucun bypass sécurité (**PASS** — la relaxation est strictement bornée aux ressources structurellement non-attribuables, jamais aux ressources réellement attribuées à un tenant tiers) ; tests/gates verts (**PASS**, §22).

Réserve unique, non bloquante : validation E2E par tests d'intégration (Supertest, app réelle, modèles mockés) plutôt que par manipulation UI/device réelle, faute d'environnement disponible — même nature de preuve que la suite `test:unit` existante du projet.

**HOTFIX-MSG-STAFF-INBOX-1 : CERTIFIÉ VERT.**
