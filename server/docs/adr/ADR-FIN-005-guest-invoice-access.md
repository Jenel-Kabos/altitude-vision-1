# ADR-FIN-005 — Accès invité aux factures

## Statut

Accepted

## Contexte

Une `HotelReservation` peut appartenir à un invité sans compte `User`.

## Problème

Imposer un compte casserait le parcours existant ; une simple référence et un email ne prouvent pas suffisamment l'ownership.

## Options étudiées

1. Compte obligatoire.
2. Jeton opaque, hashé, expirant et scopé.
3. Référence plus vérification secondaire/OTP.

## Décision recommandée

Option 2, avec OTP optionnel pour rotation ou actions sensibles. Le jeton autorise seulement une facture et des scopes explicites `view`, `download`, `pay`.

## Conséquences positives

Faible friction et isolation précise de l'accès.

## Conséquences négatives

Cycle de vie des jetons, rate limiting et récupération à gérer.

## Risques

Fuite du lien, brute force ou jeton non révoqué.

## Stratégie de migration

Nouveau mécanisme réservé aux futures factures hôtelières ; aucun changement du parcours réservation en F0.

## Éléments non décidés

Durée d'expiration, scopes par défaut et exigence OTP pour initier un paiement.
