# ADR-FIN-006 — Politique de numérotation

## Statut

Accepted

## Contexte

`Document` et `HotelReservation` utilisent déjà des séquences atomiques, sans politique légale de facture configurable.

## Problème

La portée, l'année, les préfixes, les trous, annulations et duplicatas doivent être décidés avant émission.

## Options étudiées

1. Séquence globale plateforme.
2. Séquence par établissement, type et année.
3. Numéro externe fourni manuellement.

## Décision recommandée

Option 2 conceptuellement : séquence atomique au moment de l'émission, configuration `entityScope + documentType + year + prefix`. Aucun numéro légal au brouillon.

## Conséquences positives

Isolation par établissement, auditabilité et règles configurables.

## Conséquences négatives

Configuration et concurrence plus complexes.

## Risques

Politique incompatible avec une obligation locale inconnue ou numéros réservés lors d'un échec.

## Stratégie de migration

Ne pas renuméroter les documents historiques. Démarrer une série explicitement datée pour le nouveau système après validation juridique/comptable.

## Éléments non décidés

Portée légale, réinitialisation annuelle, tolérance aux trous, formats facture/avoir/reçu/proforma.
