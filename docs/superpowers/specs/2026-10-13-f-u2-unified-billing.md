# F-U2 — Facturation financière unifiée

> Implémentation locale. Aucun commit, déploiement, migration ni mouvement
> d'argent. Une certification locale n'autorise pas la production.

## Flux

Obligation métier → **brouillon `FinancialDocument`** (l'obligation elle-même,
clé `businessOperationKey` unique) → lignes → émission (émetteur légal vérifié,
snapshot figé, numérotation par émetteur) → `FinancialPayment` confirmé →
`PaymentAllocation` (existant) → ledger. Commissions : depuis les
constatations d'encaissement F-U1 (`MandateCollection`). Reversements et
rapprochements avancés : lots suivants.

| Source | Clé d'unicité | Émetteur | Payeur |
|---|---|---|---|
| Loyer (bail × mois) | `rent:<bail>:<AAAA-MM>` + verrou bien × mois | mandataire (encaissement agence) ou organisation gestionnaire ; bailleur personne physique → brouillon seulement | locataire |
| Commission 10 % | `commission:<mandat>:<empreinte des constatations>` ; chaque constatation facturée une fois (verrou) | mandataire | propriétaire |
| Abonnement autonome | `subscription:<type>:<id>:<AAAA-MM>` | Altitude Vision (PLATFORM) | organisation / propriétaire |
| Avoir | `credit-note:<facture>:<clé>` | émetteur de la facture | — |

## Règles appliquées sans valeur inventée

- Loyer et charges : champs du bail ; aucune pénalité (la pénalité historique
  de `Paiement` n'est pas reprise) ; mois partiel → clause de prorata citée
  obligatoire ; échéance → jour de l'échéancier historique, sinon refus.
- Commission : 10 % figés à la constatation (version du mandat du paiement),
  jamais à l'émission du loyer ; OWNER_DIRECT seulement après rapprochement ;
  frais de transaction exclus de l'assiette et de la facture.
- Abonnement : tarif `SubscriptionTariff` (décision référencée, activé par une
  personne distincte) ; sans tarif, refus ; essai, organisation suspendue, mois
  non couvert entièrement (changement de formule, annulation) : non facturés
  (règle de prorata non définie).
- Avoirs : habilitation sensible `contractual.financial.approve`, approbateur
  distinct de l'émetteur, plafond = solde non réglé (au-delà : remboursement,
  autre circuit) ; avoir total → facture `credited`.
- Hôtel : moteur existant inchangé ; contrôle d'émetteur vérifié activable
  (`HOTEL_INVOICE_REQUIRE_VERIFIED_ISSUER`, désactivé par défaut).

## Capacités ajoutées (dérivées, non sensibles)

`contractual.billing.manage` (IAM `payments.manage`, Admin, `platform.finance.manage`)
et `contractual.billing.issue` (Admin, `platform.finance.manage`).

## Décisions nécessaires

1. Prix et délais de paiement des formules d'abonnement ; règle de prorata.
2. Validité juridique des mentions, de la numérotation par émetteur et du
   modèle « mandataire émettant au nom du bailleur » (OHADA / droit congolais).
3. Taxes applicables (aucun taux appliqué).
4. Activation du contrôle d'émetteur hôtelier et vérification des identités
   légales des organisations.
5. Incohérence publique : `LocationGestionPage.jsx` affiche une offre à 7 %
   alors que la règle validée est 10 %.
6. Migration contrôlée des échéanciers `Paiement` historiques (aucune reprise
   automatique : adaptateur de lecture uniquement).
