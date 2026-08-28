# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Matrice UIDVALIDITY

## Rappel RFC 3501

`UIDVALIDITY` est une valeur associée à une mailbox. Tant qu'elle reste identique, les UID sont stables et comparables dans le temps. Si le serveur la change (recréation de la mailbox, migration interne, réindexation), **tous les anciens UID deviennent invalides** — un ancien `lastProcessedUid` ne veut plus rien dire et ne doit jamais être réutilisé tel quel.

## Options considérées (mandat §"doit gérer le changement d'UIDVALIDITY sans silent-skip-all ni duplicate-everything")

| Option | Comportement | Décision |
|---|---|---|
| **A — Reset contrôlé (choisie)** | UIDVALIDITY différente → réexamen complet (`{all:true}`) sous la nouvelle valeur, `baseUid` remis à 0 | **Retenue** |
| B — Ignorer le changement, garder l'ancien `lastProcessedUid` | Comparerait un ancien UID à une nouvelle numérotation → risque de sauter des messages ou d'en re-traiter au hasard | Rejetée — c'est exactement le "silent-skip-all" que le mandat interdit explicitement |
| C — Arrêter le polling et alerter un humain | Sûr mais viole la contrainte de "zéro silence" côté ingestion — un changement d'UIDVALIDITY chez Zoho (rare mais possible) bloquerait indéfiniment la boîte sans action humaine | Rejetée — disproportionné pour un événement que la dédoublication `zohoMessageId` neutralise déjà sans risque |

## Pourquoi l'option A ne produit ni perte ni duplication massive

- **Pas de perte** : un réexamen complet retrouve tous les messages actuellement dans la mailbox, quelle que soit leur ancienne numérotation.
- **Pas de duplication massive** : le filet `zohoMessageId` (identique à la stratégie de bootstrap, voir `_BOOTSTRAP_STRATEGY.md`) filtre tout message déjà importé lors d'un cycle précédent — un changement d'UIDVALIDITY ne duplique donc que dans le cas (déjà exclu par conception) où `zohoMessageId` serait absent ou mal résolu, ce qui n'est pas spécifique à ce hotfix et est couvert par le fallback `imap-uid-${uid}-${Date.now()}` existant, inchangé.

## Test de validation

`server/__tests__/zohoImapService.test.js` — test "UIDVALIDITY changée : reset contrôlé, réexamen complet sous la nouvelle valeur" : checkpoint existant avec `uidValidity: '1000'`, client simulé avec `uidValidity: '2000'` → vérifie `client.search` appelé avec `{ all: true }`, un `logger.warn` explicite `reason: 'uidvalidity_changed'` est émis (observabilité, mandat §"logging requis"), et le nouveau checkpoint est bien persisté avec `uidValidity: '2000'`.

## Cas non observé en production à ce jour

`UIDVALIDITY` actuel confirmé stable à `"1"` lors de l'audit ZOHO-INBOX-HEALTHCHECK-1 comme lors de ce mandat — **aucun changement d'UIDVALIDITY n'a été observé en conditions réelles**. Cette matrice documente le comportement défensif prévu pour un événement non encore survenu, testé uniquement en environnement mocké (Jest), jamais provoqué contre la mailbox réelle (aucune mutation de production n'a eu lieu, conformément au mandat).
