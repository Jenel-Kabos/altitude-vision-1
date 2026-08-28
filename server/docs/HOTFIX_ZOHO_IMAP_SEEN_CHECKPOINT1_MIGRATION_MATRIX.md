# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Matrice de migration

## Étape unique, automatique, sans script de migration séparé

Il n'existe **aucune** ligne `ImapSyncCheckpoint` en production avant ce hotfix (collection inexistante). Le premier cycle de polling exécuté après déploiement déclenchera donc automatiquement le chemin **bootstrap** (`no_checkpoint` → `resolveSyncOrigin` retourne `{all:true}`), documenté et testé dans `_BOOTSTRAP_STRATEGY.md`. Aucun script de migration de données n'est nécessaire ni fourni — Mongoose crée la collection/l'index à la première écriture (`upsert:true`).

## Effet du déploiement sur le premier cycle post-déploiement

1. `ImapSyncCheckpoint.findOne(...)` renvoie `null` (aucun document).
2. Réexamen complet de `INBOX` (113 messages au moment de l'audit — coût confirmé négligeable, voir `_BOOTSTRAP_STRATEGY.md`).
3. Tout message déjà présent dans `InternalMail` (imports historiques antérieurs à ce hotfix) est reconnu comme doublon par `zohoMessageId` et ignoré.
4. **Le message UID 113 du healthcheck d'origine — actuellement `\Seen` et absent de `InternalMail` — sera cette fois importé**, car le critère de sélection ne dépend plus du flag `\Seen`. C'est la preuve directe, en conditions réelles, que le root cause est corrigé (voir `_REPORT.md` pour la validation).
5. Un document `ImapSyncCheckpoint` est créé en fin de cycle avec `lastProcessedUid` = plus haut UID traité avec succès.
6. Tous les cycles suivants utilisent le chemin incrémental normal.

## Rollback

Aucune migration destructive n'est effectuée : la nouvelle collection `ImapSyncCheckpoint` est additive et n'affecte aucune collection existante (`InternalMail`, `User`). Un rollback du code (retour à `search({seen:false})`) laisserait simplement la collection `ImapSyncCheckpoint` inutilisée, sans effet de bord — aucune procédure de rollback de données n'est nécessaire.

## Ce qui n'est PAS migré

Les messages déjà `\Seen` en Zoho avant ce hotfix et déjà absents de `InternalMail` (dont UID 113) ne nécessitent aucune migration manuelle : ils seront rattrapés automatiquement par le réexamen complet du bootstrap décrit ci-dessus, sans action humaine ni script correctif séparé.
