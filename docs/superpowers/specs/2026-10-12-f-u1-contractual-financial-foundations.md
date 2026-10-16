# F-U1 — Fondations contractuelles et financières unifiées

Statut : **implémentation locale ; surfaces HTTP v1 limitées (F-U1.G → F-U1.I)**.
Aucun commit, push, déploiement, migration ni mouvement d'argent réel.

## 1. Réutilisation du noyau existant

| Besoin | Réutilisé | Ajouté par F-U1 |
|---|---|---|
| Argent reçu | `FinancialPayment` | — |
| Affectation facture | `PaymentAllocation`, `FinancialDocument` | — |
| Journal d'audit | `FinancialLedgerEntry` (append-only) | nouveaux `eventType` `mandate.*`, `refund.governed.*` |
| Remboursement | `FinancialRefund` | sous-document `governance` + statuts additifs |
| Montants entiers, % en points de base | `moneyService` | — |
| Transactions Mongo | `runFinancialOperation` | — |
| Autorité PATH A / PATH B | `resolveTenantMembership`, `resolveActiveOperator`, `DEFAULT_CAPABILITIES` | `contractualFinanceAuthorizationService` |
| Interventions | `RentalMaintenanceTicket` | — |

Nouveaux modèles (aucun équivalent n'existait) : `ManagementMandate`,
`ManagementMandateVersion` (immuable), `FinancialBeneficiary`,
`FinancialLimitCounter`, `MandateExpense`, `ExpenseAuthorization` (immuable),
`MandateCollection`, `OwnerFinancialObligation`, `FinancialRefundPolicy`,
`FinancialRefundApproval` (immuable), `FinancialIssuerIdentity`.

Les champs historiques `RentalManagement.managementFee / mandateStartAt /
mandateEndAt` ne sont ni lus ni écrits : aucune migration.

## 2. Décisions de conception

- **Mandataire explicite** : `mandataryType ∈ {PLATFORM, TENANT}`. Un
  `tenant: null` n'est jamais interprété comme un droit plateforme. Un mandat
  PLATFORM n'est accessible qu'en vue plateforme (opérateur
  `platform.finance.manage`), un mandat TENANT qu'avec ce tenant sélectionné.
- **Non-rétroactivité** : toute opération recopie `mandateVersion`,
  `termsHash` et le snapshot utile (plafonds, frais). Un avenant crée une
  version nouvelle, effective à une date non passée ; la version applicable à
  un encaissement est celle en vigueur à la date de confirmation du paiement.
- **Commission** : 1000 points de base (10 %) imposés par validation ; toute
  autre valeur ou réduction d'assiette par les dépenses est refusée.
- **Double plafond** : deux `$inc` conditionnels sur `FinancialLimitCounter`
  (intervention, mois WAT du bien) dans une transaction. Dépassement →
  `pending_owner_authorization`, jamais une réservation partielle.
- **OWNER_DIRECT** : `declared` n'a aucun effet financier ; seule une
  constatation `reconciled` (confirmation in-app du propriétaire sur
  déclaration d'un tiers, ou vérification par un agent distinct du déclarant,
  avec preuve) crée la commission due.
- **Remboursements** : politique `unconfigured` tant qu'aucun seuil n'est
  validé → double validation systématique. Signaux bloquants (fraude,
  anomalie majeure) → `blocked`. Exécution : toujours `501`.
- **Fournisseurs** : `CARD_PSP` déclarait `refund/initiate=true` sur des stubs ;
  corrigé (`capabilities` à false, intention dans `plannedCapabilities`).

## 3. Autorisation contractuelle (F-U1.G)

Couche `contractual.*` séparée, validée dans son principe.
`financialAuthorizationService` et `INVARIANTS.md §12` ne sont pas modifiés.

### 3.1 Capacités dérivées (non sensibles)

| Capacité | IAM tenant (capacités nommées) | Admin `*` | Opérateur plateforme |
|---|---|---|---|
| `contractual.read` | `rental.read`, `payments.read`, `payment.status` | oui | `platform.finance.read` ou `.manage` |
| `contractual.mandate.manage` | — (aucun équivalent IAM) | oui | `platform.finance.manage` |
| `contractual.expense.request` / `.justify` | `maintenance.manage` | oui | `platform.rentals.manage` |
| `contractual.collection.record` | `payments.manage` | oui | `platform.finance.manage` |
| `contractual.beneficiary.register` | `payments.manage` | oui | `platform.finance.manage` |
| `contractual.refund.prepare` | `payments.manage` | oui | `platform.finance.manage` |

Résultat : Admin = toutes les capacités courantes ; GestionnaireImmobilier =
lecture + dépenses ; Secretaire = lecture + encaissement + bénéficiaire +
préparation de remboursement ; autres rôles, `Collaborateur` (`legacy.full`)
et `User.role` global = rien.

### 3.2 Capacités sensibles — habilitation nominative (F-U1.H)

Jamais dérivées (ni `User.role`, ni Admin `*`, ni `legacy.full`, ni
`platform.finance.manage`, ni simple appartenance). Seule une habilitation
`ContractualFinanceGrant` **active**, dans sa fenêtre de validité, dont le
bénéficiaire est **éligible au moment de l'usage**, ouvre la capacité.

| Capacité | Rôles tenant éligibles | Base opérateur (PLATFORM) |
|---|---|---|
| `contractual.financial.approve` | Admin | `platform.finance.manage` |
| `contractual.refund_policy.manage` | Admin (+ activateur distinct) | `platform.finance.manage` |
| `contractual.issuer_identity.manage` | Admin (+ vérificateur distinct) | `platform.finance.manage` |
| `contractual.written_authorization.verify` | Admin, GestionnaireImmobilier | `platform.finance.manage` |
| `contractual.collection.reconcile` | Admin, Secretaire | `platform.finance.manage` |
| `contractual.beneficiary.verify` | Admin, Secretaire | `platform.finance.manage` |
| `contractual.representation.verify` | Admin | `platform.finance.manage` |
| `contractual.grants.govern` | Admin | `platform.operators.manage` |

**Gouvernance à deux niveaux, jamais croisés.**
- TENANT : un Admin actif du tenant, porteur de `grants.govern` TENANT, en
  contexte TENANT (PATH A seulement), propose ; un second gouverneur distinct
  approuve. Portée = ce tenant. Un tenant ne crée jamais d'habilitation
  PLATFORM ; un opérateur qui sélectionne un tenant ne le gouverne pas.
- PLATFORM : un opérateur actif `platform.operators.manage`, porteur de
  `grants.govern` PLATFORM, en vue plateforme ; second opérateur distinct.
  Les habilitations PLATFORM ne confèrent jamais `grants.govern` sur un tenant.

**Cycle** : `proposed` → `active` (ou `pending_independence`) ⇄ `suspended` ;
`refused` / `cancelled` ; `revoked` / `expired`. Transitions CAS, historisées,
idempotentes (clé de proposition), une seule habilitation vivante par
(bénéficiaire, périmètre, capacité). Révocation, suspension d'urgence et
renonciation : immédiates et unilatérales ; levée de suspension par une
personne distincte de son auteur.

**Indépendance** : bénéficiaire, proposant et approbateur distincts (compte,
téléphone, identité attestée `HumanIdentityAttestation`). Sans attestation
vérifiée pour chacun, l'habilitation reste `pending_independence` (inutilisable)
— deux téléphones différents ne prouvent rien.

**Bootstrap** (`scripts/bootstrapContractualGrantGovernors.js`, hors API) :
désactivé par défaut (`CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED`), dry-run par
défaut, `--confirm-database`, autorisé par un opérateur
`platform.operators.manage` distinct, ≥ 2 gouverneurs, une seule exécution par
périmètre, n'accorde que `grants.govern`. **Non exécuté.**

### 3.3 Autorité du propriétaire (fondée sur la ressource)

`ownerAuthorityService` : identité authentifiée ; `Property.owner` toujours égal
au mandant (sinon `OWNER_LINK_BROKEN`) ; mandat actif pour toute décision ;
représentant (`OwnerRepresentation`) limité à des mandats et pouvoirs explicites
(`VIEW`, `EXPENSE_DECISION`, `REFUND_CONSENT`, `COLLECTION_CONFIRMATION`), sur
une durée bornée, sans sous-délégation, jamais membre du mandataire. Aucune
capacité staff ou plateforme n'ouvre ce chemin.

### 3.4 Séparation des fonctions

`humanIdentityService` compare les personnes par compte **et** par téléphone
normalisé. Initiateur ≠ approbateurs ; approbateurs distincts entre eux ;
soumissionnaire / demandeur / propriétaire ≠ authentificateur d'un écrit ;
déclarant / propriétaire / confirmant ≠ vérificateur d'un rapprochement ;
octroyant ≠ bénéficiaire ; rédacteur ≠ activateur d'une politique.

### 3.5 OWNER_DIRECT

`declared` → `owner_confirmed` (corroboration, sans effet) → `reconciled`
uniquement avec : une pièce émise par un tiers (`BANK_STATEMENT`,
`MOBILE_MONEY_STATEMENT`, `PROVIDER_TRANSACTION_CONFIRMATION`), la référence de
transaction, un montant vérifié identique, une date vérifiée, par une personne
titulaire de `collection.reconcile`. La commission est alors **due**
(créance), jamais acquise sur simple déclaration.

### 3.6 Routes HTTP v1 (`/api/v1/contractual-finance`)

Exposées (F-U1.G) : mandats, dépenses, décision propriétaire, OWNER_DIRECT
(déclaration, confirmation), obligations, bénéficiaires, représentants.

Exposées (F-U1.H) : gouvernance des habilitations (`/grants` : liste,
proposition, approbation, réévaluation d'indépendance, refus, suspension,
levée, révocation) ; soumission et authentification d'écrits ; procurations
écrites (enregistrement, vérification) ; vérification de bénéficiaire ;
rapprochement OWNER_DIRECT ; constatation d'encaissement agence ; préparation
et lecture de remboursement ; brouillon de politique **sans seuil** ;
identité légale (saisie, vérification documentaire).

Non routées : bootstrap, attestation d'identité (procédure KYC à décider),
approbation / consentement / mise en exécution / blocage des remboursements,
activation de politique (aucun seuil validé), toute exécution de reversement
ou de remboursement.

### 3.7 KYC à deux niveaux (F-U1.I)

- Niveau 1 : la personne concernée (y compris sans organisation) ou un membre
  porteur de `contractual.kyc.prepare` (TENANT : Admin, Secretaire) prépare et
  soumet le dossier `FinancialIdentityKycCase`.
- Niveau 2 : seul un opérateur porteur de `contractual.kyc.attest` (PLATFORM,
  base `platform.users.manage`, jamais octroyable à une organisation), en vue
  plateforme, attesté lui-même, sans lien avec la personne ni l'organisation
  préparatrice, examine et décide. L'approbation crée une
  `HumanIdentityAttestation` (`source: KYC_CASE`) et **aucune habilitation**.
- Les habilitations activées enregistrent leur `identityBasis` : suspension,
  révocation ou expiration d'une attestation les coupe immédiatement.
- Garde-fous : dépôt de pièces fermé tant que `KYC_DOCUMENT_STORAGE_ENABLED`
  n'est pas posé ; attestation finale fermée tant que
  `KYC_PROCEDURE_VALIDATED_VERSION` ne désigne pas la procédure validée.
- Routes : `/api/v1/financial-kyc` ; interfaces : `/mon-compte/verification-identite`,
  `/dashboard/kyc`, `/dashboard/kyc-verifications`.
- Bootstrap : voir `docs/runbooks/financial-governance-bootstrap.md`.

## 4. Décisions métier encore nécessaires

1. Seuils de remboursement par activité (montants) et activation des politiques.
2. Accord propriétaire requis ou non par activité (`ownerConsentRequired`).
3. Tarifs réels MTN / Airtel / banque et leur répartition par mandat.
4. Délai d'exécution d'un reversement après clôture de période.
5. Imputation des dépenses en reversement « par encaissement »
   (actuellement : obligation dédiée par dépense).
6. Cadence de facturation de la commission OWNER_DIRECT (actuellement :
   regroupement mensuel provisoire).
7. Conservation des coordonnées complètes des bénéficiaires (coffre / jeton
   prestataire) — prérequis à tout reversement réel.
8. Vérification sur pièces des données légales d'Altitude Vision
   (RCCM, NIU, adresse) avant usage sur un document opposable.
9. Passerelle depuis les paiements locatifs historiques (`Paiement`) vers
   `FinancialPayment` : non faite, aucune donnée migrée.
10. Procédure KYC d'attestation d'identité (qui atteste, sur quelles pièces) —
    condition pour activer une habilitation via HTTP.
11. Exécution du bootstrap des premiers gouverneurs (décision et identités).
