# ADR-FIN-001 — Frontières du noyau financier

## Statut

Accepted

## Contexte

Hôtel, immobilier, gestion locative et visites possèdent des règles et stockages financiers distincts.

## Problème

Un noyau trop métier dupliquerait ou déplacerait des règles existantes ; un noyau trop abstrait deviendrait impossible à sécuriser.

## Options étudiées

1. Généraliser `PaiementTransaction`.
2. Un noyau générique appelé par des adaptateurs métier.
3. Des systèmes financiers totalement séparés.

## Décision recommandée

Option 2. Le noyau gère monnaie, documents financiers, paiements, allocations, remboursements, crédits, états, idempotence et audit. Les adaptateurs construisent les snapshots et gardent taxes métier, tarification, échéances, commissions et ownership de domaine.

Relations de sujet via `domain + entityType + entityId` validées par un registre serveur fermé ; aucun type polymorphe libre fourni par le client.

## Conséquences positives

Cohérence financière, testabilité, migration progressive et isolation des domaines.

## Conséquences négatives

Couche d'adaptation supplémentaire et période de coexistence.

## Risques

Contournement des adaptateurs ou duplication de logique dans les contrôleurs.

## Stratégie de migration

Commencer uniquement par l'hôtel neuf, puis ajouter des adaptateurs legacy en lecture avant toute écriture parallèle.

## Éléments non décidés

Noms finaux des modèles, registre des domaines et granularité des capacités staff.
