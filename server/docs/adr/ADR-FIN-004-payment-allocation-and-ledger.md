# ADR-FIN-004 — Allocations et journal financier

## Statut

Accepted

## Contexte

Les paiements actuels ne modélisent ni allocation multi-factures ni historique financier immuable.

## Problème

Un statut de facture ou transaction ne suffit pas à calculer solde, surpaiement, reversal ou remboursement.

## Options étudiées

1. Lier directement un paiement à une facture.
2. Introduire conceptuellement une allocation plusieurs-à-plusieurs.
3. Implémenter immédiatement une comptabilité en partie double.

## Décision recommandée

Option 2, accompagnée d'un audit financier append-only initial. Une allocation référence exactement facture, paiement et montant. Une correction crée un reversal ; elle ne modifie pas l'original. La partie double est différée.

## Conséquences positives

Paiements partiels, multi-factures, solde dérivé, traçabilité et idempotence.

## Conséquences négatives

Plus de collections conceptuelles et gestion de concurrence nécessaire.

## Risques

Surallocation en course concurrente et confusion entre audit log et comptabilité générale.

## Stratégie de migration

Utiliser d'abord les allocations pour les nouveaux paiements hôteliers ; adaptateurs legacy ultérieurs sans réécriture historique.

## Éléments non décidés

Transactions Mongo requises, stratégie de verrouillage et évolution éventuelle vers la partie double.
