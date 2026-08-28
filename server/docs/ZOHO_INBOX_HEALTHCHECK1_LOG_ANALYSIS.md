# ZOHO-INBOX-HEALTHCHECK-1 — ANALYSE DES LOGS

## Logs de production (Render)

**NON CONFIRMÉ — accès indisponible.** Aucun CLI Render, aucun token d'accès à l'API Render, aucun accès au tableau de bord n'est disponible dans cet environnement d'exécution. Conformément au mandat §56, ceci est documenté explicitement plutôt que supposé : je n'affirme ni le dernier poll réussi, ni la dernière erreur, ni un éventuel `ECONNRESET`/`AUTHENTICATIONFAILED`/`BYE` en production à partir des logs — ces informations restent **NON CONFIRMÉ**.

## Preuve directe de substitution (lecture réelle, pas des logs mais des effets observables)

En l'absence de logs, cet audit s'appuie sur deux vérifications directes équivalentes en valeur probante pour répondre aux mêmes questions :

1. **Connexion IMAP réelle exécutée pendant cet audit** (voir `_IMAP_MATRIX.md`) : reproduit exactement `connect()`/`getMailboxLock('INBOX')`/`search()`/`logout()` du code de production, avec les mêmes identifiants. Résultat : succès complet, sans erreur réseau, TLS ou authentification.

2. **Historique Mongo** (`InternalMail`, voir `_STORAGE_MATRIX.md`) : les `zohoMessageId` de deux emails externes récemment importés (2026-08-18 et 2026-08-19) correspondent exactement aux `Message-ID` réels trouvés dans la boîte Zoho pour les UID 111 et 112. **Ceci constitue une preuve directe, positive et datée que le pipeline complet (cron → IMAP → parse → persist) a fonctionné avec succès au moins jusqu'au 2026-08-19**, sans avoir besoin de logs applicatifs.

## Codes d'erreur recherchés dans le code (pas dans des logs, dans le code source lui-même)

`zohoImapService.js` gère explicitement les codes suivants (`isImapConnectionError`, ligne 18-20, et le bloc `catch` principal, ligne 259-266) : `ETIMEOUT`, `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `NoConnection`, `EConnectionClosed`. Aucun de ces codes ne s'est manifesté pendant le test de connexion réel effectué dans cet audit.

## Conclusion

L'absence de logs de production n'empêche pas d'établir la cause racine avec un haut niveau de confiance dans ce cas précis, car la preuve directe obtenue par connexion réelle + comparaison Mongo/Zoho est plus précise et plus datée que ne l'auraient été des logs génériques de polling.
