# ADR-FIN-007 — Migration des systèmes financiers existants

## Statut

Accepted

## Contexte

`Paiement`, `PaiementTransaction`, `Transaction`, `Visite`, `Document` et `HotelReservation` ont des contrats web/mobile actifs.

## Problème

Une généralisation ou migration directe risquerait doublons, divergence et régressions.

## Options étudiées

1. Migration immédiate vers le noyau.
2. Double écriture dès le premier déploiement.
3. Hôtel neuf d'abord, puis adaptateurs et migration progressive contrôlée.

## Décision recommandée

Option 3. `PaiementTransaction` est entouré par un adaptateur, pas remplacé. `Paiement` et `Visite` restent sources de vérité de leurs flux. `Document` historique reste lisible. `HotelReservation` devient le premier sujet du nouveau système sans modifier son moteur.

## Conséquences positives

Compatibilité, rollback simple et validation domaine par domaine.

## Conséquences négatives

Coexistence longue et vues agrégées nécessaires.

## Risques

Divergence si une double écriture est introduite sans outbox/réconciliation.

## Stratégie de migration

Phases : nouveau flux hôtel, observation, adaptateurs lecture, backfill optionnel en sprint dédié, dépréciation annoncée, retrait séparé. Chaque phase exige métriques et réconciliation.

## Éléments non décidés

Calendrier, critères de bascule, backfill, durée de support des API legacy.
