# F-U2.9 — Tarification de la gestion autonome Altimmo

Extension de F-U2 (`2026-10-13-f-u2-unified-billing.md`). Mêmes documents
financiers, numérotation, émetteur vérifié, ledger et transactions.

## Grille validée (non modifiable sans nouvelle décision)

| Formule | Biens | Abonnement mensuel | Frais variables |
|---|---|---|---|
| GRATUIT | 1 | 0 FCFA | 1 % |
| STANDARD | 2–10 | 5 000 FCFA | 1 % |
| ENTREPRISE | 11–20 | 10 000 FCFA | 1 % |
| GRAND_PORTEFEUILLE | 21+ | sur devis accepté | 1 % |

Source unique : `server/constants/billingConstants.js` (`ALTIMMO_AUTONOMOUS_PRICING`,
version `ALTIMMO-AUTONOME-2026-10`), miroir client `client/lib/constants/altimmoPricing.js`.
Les tarifs `SubscriptionTariff` par formule doivent reproduire exactement la grille
(`TARIFF_DIFFERS_FROM_VALIDATED_POLICY` sinon), sont rédigés et activés par deux
personnes distinctes en contexte PLATFORM, versionnés, jamais modifiables par un
Admin d'organisation.

Gestion déléguée : commission de 10 % inchangée (F-U1/F-U2). Jamais cumulée
avec le 1 % : un encaissement confirmé alors qu'un mandat délégué est actif sur
le bien est exclu des frais autonomes.

## Base du 1 %

Allocation active d'un `FinancialPayment` confirmé (`succeeded`,
`partially_refunded`, `refunded` avec `confirmedAt`) sur une facture de loyer
(`metadata.billingKind = RENT`) d'un bien du titulaire. Part loyer seulement
(charges exclues, répartition entière déterministe). Période = mois WAT de
`confirmedAt`. Exclus : loyer attendu, facturé, déclaré, en attente, échoué,
frais de transaction. Paiement partiel → 1 % du montant encaissé.
Arrondi : `percentageOfMinor` (moitié vers le haut, entier FCFA).

Unicité durable : `AutonomousVariableFeeAccrual` index unique `{allocation, kind}`,
écriture par upsert `$setOnInsert` (résiste aux appels simultanés).

Contrepassation / remboursement : frais non facturés → `cancelled` ; frais déjà
facturés → ligne `REVERSAL` en `reversal_pending_decision` (aucun avoir, aucun
remboursement automatique, facture émise inchangée).

## Comptage des biens (politique PROPOSÉE)

| Catégorie | Règle proposée |
|---|---|
| MANAGED_OCCUPIED (gestion active + bail/occupation) | compté |
| DELEGATED (mandat délégué actif) | exclu (régime 10 %) |
| MANAGED_VACANT | non décidé |
| LISTING_ONLY (annonce sans gestion) | non décidé |
| CLOSED (vendu, retiré, archivé, gestion désactivée) | non décidé |

La facture est bloquée (`AUTONOMOUS_CLASSIFICATION_AMBIGUOUS`) uniquement si les
biens non décidés pourraient changer la formule, si la formule a changé pendant
le mois (prorata non décidé), ou si plusieurs comptes semblent appartenir au même
propriétaire (identité attestée partagée). Les frais de 1 % restent constatés.
Chaque classement est historisé (`PortfolioClassificationSnapshot`, append-only).

## Facture mensuelle

Clé `autonomous:<type>:<abonnementId>:<AAAA-MM>` — une par titulaire et par mois,
exclusive de la facture d'abonnement historique du même mois. Mois clos requis.
Lignes : abonnement fixe (même 0 FCFA) + une ligne `fee` par encaissement
(`sourceType: PaymentAllocation`). Émetteur : Altitude Vision (PLATFORM).
Génération `billing.manage`, émission `billing.issue`, contexte PLATFORM uniquement.

## Grand portefeuille

`PortfolioQuote` préparé par la plateforme (`billing.issue`), accepté ou refusé
par le titulaire (le propriétaire lui-même, ou un Admin de l'organisation en
contexte TENANT) — jamais par l'opérateur. Sans devis accepté :
`GRAND_PORTEFEUILLE_QUOTE_REQUIRED`.

## Décisions encore nécessaires (non implémentées, refus explicites)

1. Date de facturation des frais variables (actuellement : mois de confirmation, facture après clôture).
2. Échéance de paiement (`paymentTermDays` null → pas d'échéance).
3. Prorata lors d'un changement de formule en cours de mois.
4. Suspension pour impayés.
5. Encaissements tardifs (confirmés après facturation du mois : rattachés au mois de confirmation).
6. Ajustement en cas de remboursement d'un loyer déjà facturé.
7. Comptage : biens vacants, annonces seules, biens clôturés ; charges dans la base du 1 %.
8. Facturation pendant l'essai.
