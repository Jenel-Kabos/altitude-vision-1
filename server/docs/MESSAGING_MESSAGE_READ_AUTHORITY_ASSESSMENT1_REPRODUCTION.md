# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Reproduction (test temporaire, supprimé)

## Méthode

Fichier temporaire `__tests__/_tmp_messageReadAuthority.mongo.integration.test.js`, créé, exécuté, **supprimé avant la fin de cet audit** (confirmé par `git status`, voir `_GATE_MATRIX.md`). Vrai Mongo (`MongoMemoryReplSet`), vraie requête HTTP via `supertest`, aucune donnée réelle (sentinelles synthétiques `SECRET-MESSAGE-B-TO-C`, `SECRET-STAFF-B-MESSAGE`).

## Scénario 1 — Client sans aucun lien

Fixtures : `clientA`, `clientB`, `clientC` (tous rôle `Client`, aucune adhésion tenant). Conversation privée 1-à-1 `{participants:[clientB, clientC], isStaffInbox:false}`, un message `{sender:clientB, receiver:clientC, content:'SECRET-MESSAGE-B-TO-C', isRead:false}`.

Appel : `GET /api/messages/:privateConvId` avec le JWT de `clientA` (aucun lien avec cette conversation).

**Résultat observé :**
```
CLIENT A STATUS 200
MESSAGES RETURNED [{"content":"SECRET-MESSAGE-B-TO-C","sender":{"_id":"...","name":"Client B","email":"...","isActive":true},"receiver":{"_id":"...","name":"Client C","email":"...","isActive":true}}]
MESSAGE ISREAD AFTER CLIENT A READ (should stay false if protected) true
```

→ **Lecture complète confirmée** : contenu du message, identité (nom + email) de l'expéditeur ET du destinataire, tous deux inconnus de `clientA`. **Effet de bord confirmé** : le message passe de `isRead:false` à `isRead:true` du simple fait de l'appel de `clientA` — une mutation d'état déclenchée par un acteur totalement étranger à la conversation.

## Scénario 2 — Staff même tenant, non-participant, conversation privée (pas staff-inbox)

Fixtures : Tenant A (`createTenantFixture`), `staffA` et `staffB` (Collaborateur, tous deux membres actifs du tenant A), `otherClient` (Client). Conversation `{tenant:A, participants:[staffB, otherClient], isStaffInbox:false}` — une conversation 1-à-1 **privée** entre `staffB` et un client, PAS la boîte partagée. Message `{sender:staffB, receiver:otherClient, content:'SECRET-STAFF-B-MESSAGE', tenant:A}`.

Appel : `GET /api/messages/:staffBConvId` avec le JWT de `staffA` + en-tête `X-Platform-Tenant-Id: A` (tenant correctement résolu et correspondant — le garde HF-FINAL-01 est satisfait).

**Résultat observé :**
```
STAFF A (same tenant, non-participant) STATUS 200
STAFF A MESSAGES RETURNED ["SECRET-STAFF-B-MESSAGE"]
```

→ Confirme que la protection tenant (HF-FINAL-01), bien que correcte pour ce qu'elle vérifie, **ne suffit pas** : un staff du bon tenant peut lire une conversation privée d'un autre staff, alors même que le contrat déjà établi ailleurs (`getStaffInbox`) limite explicitement l'autorité "boîte partagée" du staff aux conversations `isStaffInbox:true`, jamais aux 1-à-1 privées d'un collègue.

## Nettoyage confirmé

```
rm __tests__/_tmp_messageReadAuthority.mongo.integration.test.js
```
Confirmé absent par `git status --short` avant la fin de cet audit (voir `_GATE_MATRIX.md`).
