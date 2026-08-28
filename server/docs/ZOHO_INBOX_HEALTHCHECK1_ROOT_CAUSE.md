ROOT CAUSE: Message already marked `\Seen` in the Zoho mailbox before the IMAP poller's `search({ seen: false })` could find it — the pipeline has no independent checkpoint (UID-based or otherwise) beyond the `\Seen` flag, so any external actor marking a message as read causes silent, permanent, untraceable exclusion from ingestion.

## Matrice de flux (mandat §58)

| Stage | Evidence | Status |
|---|---|---|
| Zoho received | UID 113, `internalDate: 2026-08-26T03:50:21Z`, lu en direct dans la boîte réelle | **PASS** — le message existe bien dans Zoho, dans INBOX |
| IMAP authenticated | Connexion réelle réussie pendant cet audit (TLS + auth) | **PASS** |
| Mailbox opened | `INBOX` ouverte avec succès, `UIDVALIDITY`/`UIDNEXT`/`EXISTS` lus | **PASS** |
| Message found (par le poller) | `search({seen:false})` renvoie **0** résultat actuellement — le message est déjà `\Seen` | **FAIL — c'est ici que le message disparaît** |
| Message fetched | Jamais atteint (le message n'est jamais dans le résultat de `search`) | **N/A (bloqué en amont)** |
| Message parsed | Jamais atteint | **N/A** |
| Message persisted | Confirmé absent de `InternalMail` (recherche par `Message-ID` exact) | **FAIL (conséquence directe)** |
| Message returned by API | Ne peut pas l'être, n'existe pas en base | **N/A (conséquence)** |
| Message rendered UI | Ne peut pas l'être | **N/A (conséquence)** |

## Chaîne de preuve (pas une supposition)

1. Le message UID 113 existe dans Zoho, dans `INBOX`, adressé à `contact@altitudevision.agency`.
2. Il est actuellement marqué `\Seen`.
3. `search({seen:false})` — la requête EXACTE utilisée par le code de production — renvoie 0 résultat : ce message ne peut donc jamais être vu par le poller tant qu'il reste dans cet état.
4. Il n'existe **pas** dans `InternalMail` (recherche par `Message-ID` exact, zéro résultat).
5. Les deux causes alternatives plausibles de non-persistance ont été explicitement écartées par preuve :
   - **Doublon** : impossible, le message n'existe pas du tout en base.
   - **Rejet permanent pour absence de destinataire** : écarté — la résolution du destinataire (repli sur l'Admin actif unique) aurait réussi si le message avait été traité (voir `_STORAGE_MATRIX.md`).
6. Les emails immédiatement précédents (UID 111, 112) SONT correctement stockés en base avec un `zohoMessageId` correspondant exactement à leur `Message-ID` réel — **preuve positive que le pipeline complet fonctionne normalement** pour tout message que le poller parvient à voir comme non lu.

## Explication la plus probable (honnête sur son niveau de confiance)

Le mécanisme le plus probable est qu'un acteur externe au pipeline Altitude Vision (l'interface web Zoho Mail elle-même en cas de consultation/prévisualisation du message par un humain pour vérifier sa réception, ou un autre client mail connecté au même compte) a marqué le message `\Seen` avant que le cron `*/5 * * * *` n'ait l'occasion de l'interroger pendant qu'il était encore non lu. **Ceci reste NON CONFIRMÉ avec certitude absolue** (aucun accès aux journaux d'audit Zoho ni aux logs applicatifs de production ne permet d'identifier précisément QUI/QUOI a marqué le message) — mais c'est la seule explication cohérente avec l'ensemble des preuves directes rassemblées : le code de notre propre pipeline ne marque JAMAIS un message `\Seen` sans soit l'avoir importé, soit l'avoir identifié comme doublon, soit avoir épuisé la résolution destinataire — aucun de ces trois chemins de code n'explique l'état observé (absent de la base, aucun doublon possible, destinataire résoluble).

## Root cause structurelle (au-delà de cet incident précis)

Indépendamment de la cause exacte de ce marquage, l'audit révèle une **fragilité de conception réelle et généralisable** : le pipeline n'a **aucun mécanisme de checkpoint indépendant** (pas de suivi de dernier UID traité, pas de comparaison `UIDVALIDITY`). Il repose à 100 % sur le flag `\Seen` comme unique preuve qu'un message a déjà été vu par notre système. **Tout acteur externe à notre code qui marque un message comme lu — intentionnellement ou non — provoque une perte silencieuse et définitive de ce message pour Altitude Vision**, sans erreur, sans log d'échec, sans retry possible (le message ne réapparaîtra jamais comme `UNSEEN`).

## Verdict le plus proche (§60)

**D. UID/CHECKPOINT BUG** (au sens large — absence de tout checkpoint indépendant du flag `\Seen`, pas un bug au sens d'une erreur de code dans un mécanisme existant, mais une absence de garde-fou). Aucun élément ne corrobore B (auth — testée et fonctionnelle), C (cron arrêté — historique d'imports récents jusqu'au 19/08 le contredit), E/F/G/H (parser/Mongo/API/frontend — jamais atteints pour ce message, donc non testables ni suspectables ici).

## RECOMMENDED HOTFIX (non exécuté — hors périmètre de ce mandat, mandat §61 "STOP")

`HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1` — portée suggérée, à valider avant tout travail :
- Remplacer ou compléter `search({ seen: false })` par une recherche basée sur un curseur UID persistant (dernier UID traité avec succès, stocké en base ou en variable d'environnement/collection dédiée), avec une recherche `UID <lastUid+1>:*` en complément de (ou à la place de) `UNSEEN`.
- Alternative plus minimale : rechercher également `search({ seen: true, since: <date récente> })` en complément, pour rattraper les messages marqués lus externement dans une fenêtre récente, avec une déduplication déjà existante (`zohoMessageId`) empêchant toute réimportation des messages déjà traités.
- Ne modifier ni la logique de dédoublonnage, ni la résolution destinataire, ni l'ordre fetch→persist→mark-seen (déjà corrects et testés).

**Cette correction n'a pas été appliquée** — conformément au mandat, ce sprint s'arrête à la preuve de la cause racine.
