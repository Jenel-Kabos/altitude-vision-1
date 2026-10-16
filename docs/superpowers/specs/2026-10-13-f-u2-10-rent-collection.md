# F-U2.10 — Échéances locatives, prorata, pénalités et recouvrement

Extension de F-U2/F-U2.9. Source des obligations : factures de loyer ÉMISES du
noyau financier (`FinancialDocument`, `metadata.billingKind = RENT`) ; paiements
retenus : allocations actives de paiements confirmés. Aucun moteur parallèle,
aucune écriture dans le modèle historique `Paiement`.

## Calendrier (`rentCalendarService`, Africa/Brazzaville = UTC+1 fixe)

| Étape | Date |
|---|---|
| Période | du 1er (00:00) au 1er du mois suivant (exclusif) : le 31 appartient au mois |
| Facturation | le 30 (février : le 28) — refus avant (`RENT_BILLING_DATE_NOT_REACHED`) |
| Échéance | fin du 5 du mois suivant (`dueDate` = 5 à 23:59:59.999) |
| Retard | à partir du 6 à 00:00 |
| Mise en demeure | le 25 à 00:00 |

Calcul en UTC + offset : indépendant du fuseau du serveur (testé sous UTC+14,
UTC−8, UTC).

## Prorata du premier loyer (jour d'entrée inclus)

| Cas | Règle | Statut |
|---|---|---|
| Entrée le 1er | loyer plein | — |
| Mois de 30 jours | (30 − j + 1) / 30 — 21 avril : 150 000 → 50 000 | VALIDÉ |
| Mois de 31 jours | min(30, 31 − j + 1) / 30 (entrée le 31 = 1/30) | PROPOSÉ → bloqué |
| Février | (jours du mois − j + 1) / jours du mois | PROPOSÉ → bloqué |
| Sortie anticipée, changement de loyer en cours de mois, charges au prorata | — | NON DÉCIDÉ → bloqué |

Clause du bail exigée (`prorataClauseReference`), conservée avec la date
d'entrée, la base, les jours, le montant et la version de règle
(`metadata.proration`). Arrondi entier « moitié vers le haut ».

## Pénalité de 3 % (`RentLatePenaltyAssessment`)

Base : loyer principal impayé à l'expiration du 5 (paiements confirmés avant
le 6 à 00:00 ; imputation loyer/charges proportionnelle — PROPOSÉE). Une
évaluation par échéance (index unique), jamais quotidienne ni composée, jamais
sur une pénalité, les frais Altimmo ou la commission. Jamais une ligne de
facture : aucun effet sur le 1 % (F-U2.9) ni sur la commission de 10 %.
Base juridique non validée → statut `SIMULATED`, refus d'exigibilité
(`RENT_PENALTY_LEGAL_BASIS_NOT_VALIDATED`).

## Signalement par le locataire (`RentPaymentDifficultyReport`)

Portail locataire : `GET /tenant-portal/rent-dues`,
`POST /tenant-portal/rent-dues/:documentId/difficulty-report`. Date de
déclaration fixée par le serveur. Recevable pour la suspension si déclaré
avant le 25 à 00:00 ; sinon exception motivée d'un gestionnaire habilité
(`billing.manage` sur le périmètre). Refus : bail d'un autre locataire (404),
échéance soldée, doublon. N'annule ni dette, ni pénalité, ni n'accorde de report.

## Mise en demeure (`RentCollectionCase`)

Au 25 : loyer soldé → `settled` ; signalement recevable ou report approuvé →
`notice_suspended` (gestionnaire notifié, dette suivie) ; sinon
`notice_draft_prepared` : projet non envoyé (`sent: false`, `sendable: false`,
`legalValidation: NOT_VALIDATED`). `POST /billing/collection-cases/:id/send`
refuse toujours (`FORMAL_NOTICE_LEGAL_VALIDATION_MISSING`).

## Cycle automatique

`runRentCollectionCycle({ now })` : idempotent (upserts sur index uniques,
transitions gardées), rejouable, rattrapage naturel des échéances passées.
**Non inscrit au planificateur** (décision d'activation requise).

## Notifications (in-app/push, aucun e-mail ni SMS)

`rent_invoice_available`, `rent_due_soon`, `rent_overdue`,
`rent_penalty_estimated`, `rent_difficulty_received`, `rent_difficulty_to_review`,
`rent_formal_notice_to_prepare`, `rent_formal_notice_suspended`,
`rent_payment_confirmed`, `rent_debt_settled` — dédupliquées. Destinataires :
locataire lié, propriétaire, émetteur de la facture (gestionnaire habilité du
périmètre). Jamais le personnel Altitude Vision par défaut.

## Décisions nécessaires

1. Job historique `rental-penalties-alerts` (actif) : 3 % du loyer TOTAL dès le
   5ᵉ jour après le 1er du mois, avec e-mail réel — contradictoire avec la règle
   validée. À désactiver ou aligner (changement de comportement en production).
2. Activation du cycle F-U2.10 dans le planificateur.
3. Règle du prorata pour les mois de 31 jours et février (normal, bissextile).
4. Jour de facturation de février bissextile (28 ou 29).
5. Prorata de sortie, changement de loyer en cours de mois, prorata des charges.
6. Imputation d'un paiement entre loyer et charges.
7. Base contractuelle et validité juridique de la pénalité de 3 %.
8. Modèle légal de mise en demeure, émetteur habilité, mandat, canal, délais,
   preuve de remise, modalités de règlement.
9. Facturation par un bailleur personne physique sans organisation (factures
   de suivi uniquement : pas d'échéance émise, donc pas de recouvrement).
10. Allocation tardive d'un paiement confirmé avant le 6 après l'évaluation de
    la pénalité (pénalité figée, correction à définir).
