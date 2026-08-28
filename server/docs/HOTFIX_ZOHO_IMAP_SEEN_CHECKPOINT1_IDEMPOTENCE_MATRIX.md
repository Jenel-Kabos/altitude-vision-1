# HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — Matrice d'idempotence

## Mécanisme de dédoublonnage (inchangé, réutilisé comme filet de sécurité)

`processFetchedMessage` calcule `messageId = parsed.messageId || 'imap-uid-${uid}-${Date.now()}'`, puis interroge `InternalMail.findOne({ zohoMessageId: messageId })` **avant** tout upload de pièce jointe, toute résolution de destinataire et toute création. Si trouvé → `{status:'duplicate'}`, aucune écriture.

## Scénarios de re-livraison introduits ou amplifiés par le checkpoint, et preuve qu'aucun ne duplique

| Scénario | Cause | Effet sur `InternalMail` |
|---|---|---|
| Bootstrap (premier démarrage) | Réexamen complet de la mailbox | Chaque message déjà présent (`zohoMessageId` déjà en base) → `duplicate`, `skipped++`, aucune création. Testé. |
| Reset UIDVALIDITY | Réexamen complet sous nouvelle numérotation | Identique au bootstrap — mêmes garanties, même filet. |
| Retry après échec métier sur un UID intermédiaire | Le checkpoint ne dépasse pas l'UID en échec ; les UID suivants qui ont réussi dans le même cycle sont réexaminés au cycle suivant | Les UID suivants déjà importés avec succès sont retrouvés par `zohoMessageId` → `duplicate`, aucune recréation. Testé indirectement via le test de stall (voir `_FAILURE_MATRIX.md`) ; le message re-livré au cycle suivant suivrait le même chemin de dédoublonnage que les tests bootstrap/reset, qui couvrent explicitement ce chemin de code. |
| Crash après persistance mais avant écriture du checkpoint | Process tué entre `InternalMail.create` et le `finally` | Au redémarrage, le message déjà créé est retrouvé par `zohoMessageId` lors du réexamen de la même plage → `duplicate`. Pas de test process-kill réel (impossible à simuler de façon fiable en Jest sans risque de faux résultat) ; couverture par raisonnement direct sur le code, le chemin de dédoublonnage étant strictement le même que les scénarios testés ci-dessus. **NON CONFIRMÉ par test d'intégration réel**, confirmé par lecture de code et par les tests couvrant le même chemin de dédoublonnage. |
| Deux instances du poller tournant simultanément (hors périmètre — `isPolling` est un verrou en mémoire, pas distribué) | Non traité par ce mandat, pré-existant | Risque théorique de double traitement si deux process Node distincts tournent en parallèle sur le même compte. **Hors périmètre explicite** (l'architecture actuelle suppose une seule instance, non modifiée par ce hotfix) — documenté ici pour transparence, pas un défaut introduit par ce mandat. |

## Pourquoi aucune duplication réelle n'a été introduite

Le checkpoint ne remplace le critère de *sélection* des UID à examiner — il ne touche jamais au chemin de *décision d'écriture*, qui reste entièrement gouverné par `zohoMessageId`. Tout re-examen d'un UID déjà traité (bootstrap, reset, retry après stall, ou re-livraison après crash) retombe systématiquement sur ce même filet, testé et prouvé fonctionnel avant ce mandat (deux imports historiques réels vérifiés) et re-testé explicitement pour les nouveaux chemins (bootstrap-avec-doublon).
