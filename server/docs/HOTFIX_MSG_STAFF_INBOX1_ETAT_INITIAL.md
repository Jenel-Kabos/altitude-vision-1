# HOTFIX-MSG-STAFF-INBOX-1 — État initial (avant toute modification de code)

Date : 2026-08-18. Branche `main`. `git status --short` au lancement de ce hotfix :
```
 M altimmo-app/eas.json          (préexistant, non lié, non touché)
?? server/docs/HOTFIX_MOB_NET1_REPORT.md   (préexistant, non créé par cette session, non touché)
```
`git rev-parse HEAD` : `c9f68ccb8bfc801200b10ed75036b115a270a07e`. `git diff --check` : `exit 0`.

## 1. Rapports lus en amont

`POST_E2E1_REPORT.md` et `POST_E2E2_REPORT.md` — Bug 2 de ces sprints concernait la **liste côté client** (`ConversationsScreen.jsx` mobile n'appelait pas `/conversations/my-inbox`), déjà corrigé et non re-régressé (vérifié par lecture directe de `getMyInbox`/`conversationService.js`, toujours en place). Le bug rapporté ici est **distinct** : côté **staff web** (`/dashboard/conversations`), pas côté client, pas mobile.

## 2. Endpoints concernés

- Création (client) : `POST /api/conversations/start` → `conversationController.js:startConversation`.
- Liste client (web) : `GET /api/conversations/my-inbox` → `getMyInbox`.
- Liste staff (web, page auditée) : `GET /api/conversations/staff-inbox` → `getStaffInbox`. Appelée par `client/lib/services/conversationService.js:getStaffInbox()`, elle-même appelée par `client/lib/pages/dashboard/StaffInboxPage.jsx` (rendue par `client/app/dashboard/conversations/page.jsx`).

## 3. Modèle Conversation (`server/models/Conversation.js`)

Champs pertinents : `tenant` (ObjectId → PlatformTenant, `default: null`), `participants[]`, `isStaffInbox` (bool, `true` = conversation client→staff, boîte partagée, aucun destinataire fixe), `isArchived`, `relatedProperty`. Pas de champ `assignedTo`/`status` distinct — un client contactant l'équipe sans staff assigné est simplement `isStaffInbox: true` avec `participants: [clientId]` uniquement (jamais le staff comme participant fixe).

## 4. Résolution du tenant à la création (`startConversation` → `resolveConversationTenantId`)

```js
async function resolveConversationTenantId(req, propertyId) {
  if (ALL_STAFF.includes(req.user.role)) return activeTenantId(req);
  if (!propertyId) return null;
  const attribution = await resolveResourceTenant({ resourceType: 'Property', resource: propertyId });
  return attribution.status === 'resolved' ? attribution.tenantId : null;
}
```
Pour un client, le tenant n'est résolu QUE si un `propertyId` est fourni (déduit du bien contacté). **Sans `propertyId` (cas générique « Contacter l'agence »), `conversation.tenant = null`, explicitement.**

Confirmé côté frontend : `client/lib/pages/MessagesPage.jsx:170` (`contacterAgence()`) appelle `startStaffConversation()` **sans aucun argument** → `propertyId` reste `null`. `client/lib/components/messaging/ContactAgencyButton.jsx:58-61` passe `propertyId: propertyId || undefined` — également `undefined` quand le bouton est utilisé hors contexte d'une annonce précise. Le message rapporté (« Salut Altimmo, besoin de vos services ») est générique, sans référence à un bien — cohérent avec ce chemin.

## 5. Requête staff inbox (`getStaffInbox`) — filtre exact

```js
const tenantConversationFilter = (req) => (activeTenantId(req)
  ? { $or: [
      { tenant: activeTenantId(req) },
      { tenant: null, participants: { $in: req.tenantScopeUserIds || [] } },
    ] }
  : {});
```
`req.tenantScopeUserIds` provient de `tenantContextService.resolveTenantScope()` → `organizationService.getScopeUserIds()`, qui interroge **exclusivement `OrgMembership`** (`server/services/organizationService.js:169`, `OrgMembership.find({ orgUnit: {$in: unitIds}, status: 'active' }).distinct('user')`).

## 6. Fait structurel déjà documenté (POST_E2E1_REPORT.md §9, §12)

« Un client ordinaire n'a structurellement AUCUN `PlatformTenant`/`OrgMembership` propre — `OrgMembership` est réservée au staff/exploitants, jamais attribuée à l'inscription normale. » Ce fait, déjà vrai et déjà exploité pour la résolution du tenant à la création, **n'a jamais été recoupé avec le filtre de lecture `tenantConversationFilter`**.

## 7. Divergence identifiée (cause, pas hypothèse — tracée ligne par ligne)

1. Client ordinaire (`role: 'Client'`, aucun `OrgMembership`) clique « Contacter l'agence » sans bien précis → `POST /conversations/start` avec `propertyId` absent.
2. `resolveConversationTenantId` retourne `null` (aucune ressource à attribuer) → `Conversation.tenant = null`, `isStaffInbox: true`, `participants: [clientId]`.
3. `notifyStaff(...)` (service de notification) notifie **tout le staff sans filtre de tenant** (`User.find({ role: { $in: ALL_STAFF } })`, aucune restriction) → la notification arrive bien, pour tous les staff, peu importe le tenant. C'est pourquoi la notification « fonctionne » alors que la liste reste vide — deux mécanismes indépendants, l'un filtré, l'autre pas.
4. Le staff ouvre `/dashboard/conversations` → `GET /conversations/staff-inbox` → `tenantConversationFilter(req)` : comme ce staff a un tenant résolu (`activeTenantId(req)` vrai — cas normal), la branche `{tenant: null, participants: {$in: req.tenantScopeUserIds}}` est la SEULE façon d'admettre la conversation créée à l'étape 2. Mais `req.tenantScopeUserIds` ne contient QUE des utilisateurs avec `OrgMembership` active — **jamais un client ordinaire, par construction (§6)**.
5. Donc `clientId ∉ tenantScopeUserIds` → la conversation ne matche ni `{tenant: activeTenantId}` (elle vaut `null`) ni `{tenant: null, participants: {$in: tenantScopeUserIds}}` (le client n'est jamais dans ce set) → **exclue structurellement de tout résultat `getStaffInbox`, quel que soit le staff, tant qu'aucun `propertyId` n'a été fourni à la création.**

C'est un bug distinct des Bugs 1-4 de POST-E2E-1/2 (qui portaient sur navigation mobile, liste client, code HTTP). Celui-ci est **côté web, côté staff, filtre tenant à la lecture**, jamais corrigé ni testé par les sprints précédents (leur matrice de sécurité §5/§18 de POST_E2E2_REPORT.md ne couvre que l'accès à UNE conversation par ID, jamais le LISTING staff-inbox complet).

## 8. Hypothèses du mandat §8 — vérification factuelle

- A. `participants contient req.user` — **NON**, `getStaffInbox` n'a jamais eu ce filtre (boîte partagée, par design, cf. commentaire ligne 586-588 du contrôleur).
- B. `assignedTo = req.user` — **N/A**, le champ n'existe pas dans le modèle.
- C. `tenant = selectedTenant` — **OUI, cause confirmée**, mais plus précisément : c'est la branche de secours `tenant: null` qui est trop restrictive (gated par `OrgMembership`, jamais vraie pour un client), pas le filtre `tenant = activeTenantId` lui-même qui est correct pour les conversations réellement attribuées.
- D. ancien type/status — N/A, pas de champ legacy de ce type ici.
- E. staffOnly/clientRequest — N/A.
- F. source legacy — N/A.
- G. isArchived/open — vérifié, `isArchived: {$ne: true}` correct, la conversation n'est pas archivée par défaut à la création.
- H. autre champ — aucun autre trouvé après lecture complète du contrôleur/modèle/routes.

## 9. Règle métier absolue — non affectée par la cause identifiée

`relatedProperty`/`Property.owner` ne joue AUCUN rôle dans cette divergence — le propriétaire d'un bien n'est jamais participant, jamais dans `tenantScopeUserIds` via ce mécanisme. La correction à apporter ne touchera ni `participants`, ni l'ajout automatique d'un propriétaire. Confirmé compatible avec la règle absolue du mandat §1.

## 10. Portée de la correction envisagée (à confirmer après cette lecture, non encore appliquée)

Ajuster uniquement la branche `tenant: null` de `tenantConversationFilter` pour ne plus exiger une preuve d'`OrgMembership` sur le client — une conversation `tenant: null` est, par construction de `resolveConversationTenantId`, une ressource **sans attribution possible** (aucun `propertyId` fourni), donc **structurellement non-rattachable à un tenant précis** — même sémantique que `assertResourceTenantOrUnattributed` déjà établie ailleurs dans `tenantResourceAttributionService.js` (« ressource non attribuable → aucune frontière tenant à faire respecter, accès non restreint »), jamais un filtre supprimé globalement. Cette relaxation touche UNIQUEMENT les conversations `tenant: null` — les conversations réellement attribuées à un tenant (bien fourni) restent strictement isolées entre tenants, inchangé.

Effets attendus, à vérifier après correction :
- `getConversations`/`getMyInbox` : déjà bornés par `participants: req.user.id` dans la même requête `$and` — la relaxation ne peut jamais exposer la conversation d'un tiers, seulement celle du demandeur lui-même (déjà légitime).
- `getStaffInbox` : exposera désormais toute conversation `isStaffInbox: true, tenant: null` à tout staff ayant un tenant résolu — c'est précisément le cas cassé à corriger.
- `getUnreadCount` (compteur `staffInboxUnread`) : même relaxation, cohérence du badge de notification avec la liste réellement affichée.

Aucune modification de modèle, aucune migration, aucun changement du mécanisme de notification (`notifyStaff`, déjà non filtré par tenant, hors scope).
