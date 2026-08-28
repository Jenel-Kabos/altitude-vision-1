# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Contrat existant (preuve, pas invention)

## `assertConversationAccess` — le seul helper d'autorité Messaging déjà existant

`controllers/conversationController.js:68-88` :
```js
async function assertConversationAccess(req, conversation) {
  if (activeTenantId(req)) {
    await assertResourceTenantOrUnattributed({ resourceType: 'Conversation', resource: conversation, tenantId: activeTenantId(req) });
  }
  const isStaff = ALL_STAFF.includes(req.user.role);
  const isParticipant = (conversation.participants || []).some((p) => String(p?._id || p) === String(req.user.id));
  if (!isStaff && !isParticipant) { /* 403 ConversationAccessError */ }
}
```
Utilisé, **verbatim, sans variante**, par **4 fonctions indépendantes** : `getConversationById`, `getConversationMessages`, `markConversationAsRead`, `deleteConversation` — toutes déjà LIVE, déjà exercées en production.

## Question centrale du mandat : "tout staff du tenant peut-il légitimement lire toute conversation ?"

**Oui — prouvé, pas supposé, par les éléments suivants :**

1. **Réutilisation identique à 4 reprises, indépendamment** : `isStaff = ALL_STAFF.includes(role)` (large, tout rôle staff) **sans** filtre `isStaffInbox`, **sans** exigence de participation, dans 4 fonctions distinctes couvrant lecture de détail, lecture de messages, marquage lu, et **suppression**. Un oubli isolé apparaîtrait dans UNE fonction ; une règle intentionnelle est répliquée identiquement partout où le besoin se présente — c'est exactement ce qu'on observe ici.
2. **`isStaffInbox` est un filtre de LISTE, jamais un filtre d'AUTORITÉ** : `getStaffInbox` (la liste) filtre sur `isStaffInbox:true` pour catégoriser une file d'attente partagée dans l'UI — mais son propre helper de détail (`assertConversationAccess`) n'impose jamais cette même restriction pour l'ACCÈS à une conversation précise par ID. Les deux mécanismes (liste catégorisée vs autorité d'accès) sont délibérément découplés dans le code existant, à 4 endroits.
3. **Aucune preuve contraire trouvée** : aucun commentaire, aucun test, aucune documentation historique (`POST_E2E1_REPORT.md`, `HOTFIX_MSG_STAFF_INBOX1_REPORT.md`) n'affirme que l'autorité staff devrait être limitée à la boîte partagée ou aux conversations où le staff est explicitement participant — au contraire, `HOTFIX_MSG_STAFF_INBOX1_REPORT.md` documente explicitement que la relaxation reste bornée UNIQUEMENT par le tenant ("jamais une conversation appartenant réellement à un tenant tiers"), jamais par une notion de participation individuelle du staff.
4. **Cohérence avec un modèle SaaS de support/gestion client courant** : un staff (Admin/Collaborateur) qui doit pouvoir consulter n'importe quelle conversation client de son agence (pour reprendre un dossier, résoudre un litige, superviser) est un modèle métier plausible et déjà exercé par le code de production, pas une supposition de ce mandat.

## Décision : contrat réutilisé tel quel (mandat §64, §65 — pas de STOP)

Le contrat n'est **pas ambigu** : il est prouvé par 4 implémentations indépendantes déjà en production, avec un raisonnement cohérent (isStaffInbox = catégorisation de liste, jamais une restriction d'autorité). Le verdict `BLOCKED — BUSINESS AUTHORITY CONTRACT UNCLEAR` (mandat §65) **ne s'applique pas** ici : il aurait fallu l'absence de preuve, or la preuve existe et est cohérente à travers tout le domaine.

**Conséquence directe** : le scénario "staff même tenant, non-participant, conversation privée" (item d'exemple §46.7 du mandat) n'est **pas** un cas rouge à fermer — c'est un comportement déjà établi et intentionnel à **préserver**, testé explicitement comme tel (voir `_RED_REPRODUCTION.md`). Le seul gap réel démontré par l'assessment précédent concerne les rôles **non-staff** (Client, Proprietaire — traités identiquement, voir ci-dessous), pour lesquels `assertConversationAccess` exige déjà, lui, une participation réelle.

## Proprietaire = même chemin de code que Client (confirmé)

`conversationController.js:451/517` : "Client/Proprietaire → staff uniquement : boîte partagée" — les deux rôles suivent exactement le même `isSenderStaff = false`, jamais de `req.platformTenant`, jamais d'exception. Aucun traitement différencié de Proprietaire n'existe nulle part dans le domaine Messaging.

## Correction retenue

Réutiliser `assertConversationAccess` **tel quel**, sans variante, à l'intérieur de `messageController.js::getMessages`, remplaçant l'actuel `if (req.platformTenant) { assertResourceTenantOrUnattributed(...) }` (qui ne fait qu'une partie du travail que `assertConversationAccess` fait déjà en entier). Extraction vers un service partagé (`services/messagingAuthorizationService.js`) pour éviter un couplage controller→controller (catégorie déjà suivie comme dette architecturale par le checker canonique) — voir `_FLOW.md`/`_ROOT_CAUSE.md`.
