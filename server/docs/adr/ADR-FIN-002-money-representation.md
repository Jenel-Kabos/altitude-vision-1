# ADR-FIN-002 — Représentation monétaire

## Statut

Accepted

## Contexte

Les montants existants sont des `Number`, souvent en XAF implicite, avec des arrondis dispersés.

## Problème

Les flottants et devises implicites empêchent des totaux, allocations et remboursements fiables.

## Options étudiées

1. `Number` décimal.
2. `Decimal128`.
3. Entier en unités mineures dans la plage safe JavaScript.
4. `Long`/BigInt.

## Décision recommandée

Option 3 : `{ amountMinor: Number.isSafeInteger, currency: ISO 4217 }`. XAF a 0 décimale ; EUR/USD en ont 2. Calcul centralisé, pourcentages en points de base, aucune conversion implicite.

## Conséquences positives

JSON simple, compatibilité web/mobile et calculs déterministes.

## Conséquences négatives

Validation stricte des bornes et conversion explicite aux frontières legacy.

## Risques

Overflow si les limites métier ne sont pas définies ; règle d'arrondi encore à valider.

## Stratégie de migration

Aucun changement des champs existants. Les adaptateurs convertissent vers les nouveaux objets uniquement lors d'une création financière future.

## Éléments non décidés

Bornes métier par devise, règle d'arrondi finale et support éventuel de devises à trois décimales.
