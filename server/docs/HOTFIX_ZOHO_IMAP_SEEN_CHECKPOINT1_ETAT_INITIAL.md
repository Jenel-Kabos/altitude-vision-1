# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — État initial

## Baseline git

- HEAD au démarrage du mandat : `a04055f62952c782b92aeef2f100824a17a5f645`, arbre de travail propre.
- Aucun commit, aucun push, aucun `git add` n'a été exécuté à aucun moment de ce mandat (conformément à la contrainte permanente de l'utilisateur).

## Root cause hérité (rappel, déjà certifié dans ZOHO-INBOX-HEALTHCHECK-1)

Voir `ZOHO_INBOX_HEALTHCHECK1_ROOT_CAUSE.md` et `_REPORT.md` : le poller de production interroge exclusivement `search({ seen: false })`. Un message marqué `\Seen` par un acteur externe (webmail Zoho, autre client IMAP) avant que le poller ne l'ait vu devient **invisible pour toujours** — aucun checkpoint indépendant du flag `\Seen` n'existe. Preuve directe : UID 113, déjà `\Seen` dans Zoho, absent de `InternalMail`, alors que les deux emails précédents (UID 111/112) étaient correctement importés.

## Inventaire avant modification

- Aucun modèle Mongoose de type checkpoint/curseur/sync n'existait dans `server/models/` (confirmé par listing exhaustif du dossier).
- `server/services/zohoImapService.js` ne référençait ni UID, ni UIDVALIDITY, ni aucune collection de suivi — uniquement `search({ seen: false })` et `messageFlagsAdd(..., ['\\Seen'])` en fin de cycle.
- `server/__tests__/zohoImapService.test.js` comportait 10 tests, tous verts, couvrant : connexion/recherche/fermeture, lock/isPolling, résilience métier (une erreur sur le premier email n'empêche pas l'import du second), erreurs réseau, timeout de logout.

## État Zoho réel au moment de l'audit (lecture seule, aucune mutation)

Confirmé par connexion IMAP réelle, en lecture seule :
- `uidValidity`: `"1"`
- `uidNext`: `114`
- `exists`: `113`
- `client.search({ uid: '113:*' })` → `[113]`
- `client.search({ uid: '999999:*' })` → `[]` (pas d'erreur, comportement Zoho confirmé pour une plage vide)

Ces valeurs confirment que la syntaxe de recherche par plage d'UID (`SequenceString` du type `'<n>:*'`, exposée par `imapflow`) fonctionne réellement contre le serveur Zoho de production, et non seulement en théorie contre la définition TypeScript du module.

## Portée de ce mandat

Remplacer `search({ seen: false })` par un mécanisme de checkpoint UID/UIDVALIDITY persistant, sans changer : l'ordre fetch→parse→dédoublonnage→pièces jointes→résolution destinataire→persist→mark-seen ; le mécanisme anti-deadlock (toutes les commandes FETCH d'un lot se terminent avant tout STORE) ; le verrou `isPolling` ; la taille de lot (`FETCH_BATCH_SIZE = 10`) ; aucune modification frontend ni mobile.
