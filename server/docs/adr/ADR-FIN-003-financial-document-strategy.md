# ADR-FIN-003 — Stratégie des documents financiers

## Statut

Accepted

## Contexte

`Document` mélange devis, facture, contrat, état des lieux et pièce d'identité. Il possède déjà lignes et numérotation.

## Problème

L'étendre pour l'hôtel impose immutabilité, devises, taxes, avoirs et paiements à une collection administrative hétérogène.

## Options étudiées

1. Étendre `Document` comme socle universel.
2. Conserver `Document` et créer ultérieurement un document financier distinct.

## Décision recommandée

Option 2. `Document` reste historique/administratif. Un futur document financier dédié portera les invariants de facture, proforma et avoir. Aucun modèle n'est créé en F0.

## Conséquences positives

Immutabilité et fiscalité conçues proprement ; aucune migration destructive.

## Conséquences négatives

Deux systèmes documentaires coexistent et nécessitent une vue agrégée.

## Risques

Confusion UI/API et duplication de PDF si la frontière n'est pas respectée.

## Stratégie de migration

Factures `Document` existantes en lecture seule via adaptateur ; nouveaux documents financiers seulement pour les flux activés après déploiement.

## Éléments non décidés

Nom final, types exacts de document et durée de coexistence.
