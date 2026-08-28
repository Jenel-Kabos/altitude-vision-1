# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Conception du checkpoint

## Modèle : `server/models/ImapSyncCheckpoint.js`

Une ligne unique par `(account, mailbox)`, index unique composite.

| Champ | Type | Rôle |
|---|---|---|
| `account` | String | Compte Zoho interrogé (`ZOHO_FROM_EMAIL`, jamais un secret) |
| `mailbox` | String, default `'INBOX'` | Dossier IMAP concerné — le poller ne lit aujourd'hui que `INBOX` |
| `uidValidity` | String | UIDVALIDITY du serveur au moment du dernier checkpoint. Stocké en `String` (pas `Number`) : la RFC 3501 ne garantit qu'un entier 32 bits non signé, jamais utilisé arithmétiquement, donc aucune raison de risquer une perte de précision |
| `lastProcessedUid` | Number, default `0` | Dernier UID confirmé traité de façon **contiguë** depuis le début du cycle courant |

Pourquoi `(account, mailbox)` et non un singleton global : le poller n'interroge qu'un seul compte/dossier aujourd'hui, mais la clé composite évite un verrou implicite sur "il n'existe qu'un seul mailbox possible" — un choix low-cost qui n'ajoute aucune complexité opérationnelle (une seule ligne existera en pratique).

## Fonction pure : `resolveSyncOrigin(checkpointDoc, currentUidValidity)`

Isolée du reste de `pollZohoInbox` et exportée pour être testée indépendamment de toute connexion IMAP :

```js
const resolveSyncOrigin = (checkpointDoc, currentUidValidity) => {
    if (!checkpointDoc) {
        return { searchCriteria: { all: true }, baseUid: 0, isReset: true, resetReason: 'no_checkpoint' };
    }
    if (String(checkpointDoc.uidValidity) !== String(currentUidValidity)) {
        return { searchCriteria: { all: true }, baseUid: 0, isReset: true, resetReason: 'uidvalidity_changed' };
    }
    const baseUid = checkpointDoc.lastProcessedUid || 0;
    return { searchCriteria: { uid: `${baseUid + 1}:*` }, baseUid, isReset: false, resetReason: null };
};
```

Trois branches, aucune supposition implicite :
1. **Bootstrap** (`no_checkpoint`) — premier démarrage, aucune trace d'un cycle précédent.
2. **Reset** (`uidvalidity_changed`) — le serveur a renuméroté la mailbox (recréation, migration), les anciens UID ne signifient plus rien.
3. **Incrémental** — cas nominal, recherche stricte `UID > lastProcessedUid`.

## Pourquoi UID plutôt que date ou flag

- Un UID est un identifiant IMAP monotone et non réutilisé **au sein d'une même UIDVALIDITY** (garantie RFC 3501) — contrairement à `\Seen`, il n'est jamais modifié par un tiers.
- Une recherche par date (`SINCE`) resterait vulnérable à un décalage d'horloge ou à un message reçu hors ordre ; une recherche par UID est exacte et déterministe.
- Le flag `\Seen` reste posé (comportement inchangé) mais n'est plus jamais lu comme critère de sélection — il redevient un simple indicateur de lecture pour un client IMAP humain.

## Avancement contigu du checkpoint (contrat central)

`checkpointAdvanceUid` ne progresse que tant qu'aucune erreur métier n'a été rencontrée dans le cycle courant (`checkpointStalled`). Dès la première erreur métier sur un UID, le checkpoint se fige à la dernière valeur atteinte — même si des UID plus élevés, traités ensuite dans le même cycle, réussissent. Ce choix garantit qu'aucun message en échec n'est jamais "sauté" définitivement : au prochain cycle, la recherche repartira de `lastProcessedUid+1`, ce qui inclut à nouveau l'UID en échec ET les UID qui avaient réussi après lui dans le cycle précédent — ces derniers seront alors filtrés sans coût par la déduplication `zohoMessageId` existante (voir `_IDEMPOTENCE_MATRIX.md`).
