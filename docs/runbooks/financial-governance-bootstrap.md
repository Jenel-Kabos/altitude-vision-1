# Runbook — Bootstrap de la gouvernance financière (F-U1.H / F-U1.I)

> **Statut : NON EXÉCUTÉ.** Ce document prépare une exécution future. Aucune
> base réelle n'a été modifiée, aucun gouverneur ni vérificateur réel n'a été
> créé. Ne jamais copier de valeur de secret ni de numéro de pièce dans ce
> document, un ticket, un chat ou un journal.

## 1. Ce que fait le bootstrap

Deux étapes, chacune exécutable **une seule fois** par périmètre
(`ContractualGrantBootstrap`, index unique) :

| Étape | Fonction | Effet |
|---|---|---|
| A. Racine PLATFORM | `bootstrapPlatformRoot` | Enregistre hors ligne l'identité (empreinte HMAC) de l'opérateur autorisant et d'au moins deux opérateurs ; leur accorde `contractual.grants.govern` + `contractual.kyc.attest` (PLATFORM). L'autorisant ne reçoit **aucune** habilitation. |
| B. Organisation (par tenant) | `bootstrapGrantGovernors` | Accorde `contractual.grants.govern` (TENANT) à au moins deux Admin du tenant, **dont l'identité a déjà été attestée par Altitude Vision via KYC**, sur autorisation d'un opérateur attesté. |

Ni l'une ni l'autre n'accorde de capacité financière opérationnelle : celles-ci
passent ensuite par le double contrôle (proposition + approbation).

## 2. Prérequis (bloquants)

1. **Décisions écrites** : procédure KYC validée (version
   `KYC-FIN-2026-10-DRAFT` ou suivante), liste des pièces acceptées, base
   légale et durée de conservation (droit applicable au Congo-Brazzaville),
   stockage des pièces validé (contrat, localisation, chiffrement, purge).
2. **Identités** : pièces originales des personnes de l'étape A vérifiées
   physiquement par deux personnes, procès-verbal référencé
   (`decisionReference`). Identités toutes distinctes.
3. **Comptes** : opérateurs actifs ; autorisant porteur de
   `platform.operators.manage` ; gouverneurs PLATFORM porteurs de
   `platform.operators.manage` et `platform.users.manage` ; gouverneurs TENANT
   Admin actifs du tenant.
4. **Secrets** (gestionnaire de secrets Render, jamais en clair dans le dépôt) :
   - `HUMAN_IDENTITY_FINGERPRINT_KEY` (≥ 32 caractères, aléatoire, propre à
     l'environnement) et `HUMAN_IDENTITY_FINGERPRINT_KEY_VERSION` (ex. `v1`) ;
   - `FINANCIAL_BENEFICIARY_FINGERPRINT_KEY` (≥ 32 caractères, distincte de la
     précédente).
   Une clé perdue rend les empreintes incomparables ; une clé divulguée exige
   une rotation (nouvelle version + renouvellement des attestations).
5. **Indicateurs fonctionnels**, à n'activer qu'après les décisions du point 1 :
   `KYC_DOCUMENT_STORAGE_ENABLED=true`, `KYC_PROCEDURE_VALIDATED_VERSION=<version>`.
   Depuis F-U1.J, l'ouverture du dépôt exige aussi un analyseur anti-malware
   enregistré au démarrage et une configuration Cloudinary complète
   (environnement produit dédié au KYC recommandé) ; la purge réelle exige
   `KYC_RETENTION_DURATION_DAYS` + `KYC_RETENTION_DECISION_REFERENCE` +
   `KYC_PURGE_ENABLED=true`. Voir `docs/superpowers/specs/2026-10-13-f-u1j-cloudinary-kyc-audit.md`.
6. **Sauvegarde** de la base cible et vérification de restauration.

## 3. Simulation

```bash
cd server
# Étape A — fichier local chiffré, jamais commité ; aucun numéro en argument.
node scripts/bootstrapContractualGrantGovernors.js --scope=PLATFORM --input=/chemin/securise/root.json
# Étape B
node scripts/bootstrapContractualGrantGovernors.js --scope=TENANT --tenantId=<id> \
  --governors=<id1>,<id2> --authorizedBy=<operatorId> --decision="<réf>" --validUntil=<ISO>
```

Contrôler la sortie : base effectivement connectée, identifiants attendus,
aucune donnée d'identité affichée.

## 4. Exécution autorisée

Conditions cumulatives : décision signée, deux personnes présentes (exécutant
+ témoin, distincts des bénéficiaires), fenêtre de maintenance.

```bash
CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED=true node scripts/bootstrapContractualGrantGovernors.js \
  --scope=PLATFORM --input=/chemin/securise/root.json --confirm-database=<nom exact> --apply
```

Puis détruire de façon sûre le fichier d'entrée et **retirer**
`CONTRACTUAL_GRANT_BOOTSTRAP_ENABLED` de l'environnement.

## 5. Contrôles post-exécution

- `ContractualGrantBootstrap` : un document pour le périmètre, avec
  `authorizedBy`, `decisionReference`, `governors`, `grants`.
- `ContractualFinanceGrant` : uniquement `grants.govern` (+ `kyc.attest` en
  PLATFORM), statut `active`, `identityBasis` renseigné, validité bornée ;
  aucune habilitation pour l'autorisant.
- `HumanIdentityAttestation` (étape A) : `source: BOOTSTRAP_OFFLINE`, aucun
  numéro en clair.
- Une seconde exécution doit échouer (`GRANT_BOOTSTRAP_NOT_NEEDED` ou
  `GRANT_BOOTSTRAP_ALREADY_EXECUTED`).

## 6. Suspension d'urgence

- Habilitation : `POST /api/v1/contractual-finance/grants/:id/suspend` (tout
  gouverneur du périmètre) ou `revoke` — effet immédiat, sans double contrôle.
- Identité : `POST /api/v1/financial-kyc/review/cases/:id/attestation/suspend`
  (ou `revoke`) — toutes les habilitations dont l'`identityBasis` cite cette
  attestation deviennent inutilisables à l'appel suivant.
- Opérateur : suspension `PlatformOperator` (procédure existante) — coupe
  immédiatement toute habilitation PLATFORM.
- Membre : suspension de l'`OrgMembership` — coupe immédiatement les
  habilitations TENANT.

## 7. Limites connues

- La racine de confiance (étape A) repose sur une vérification physique hors
  ligne documentée ; l'attestation de l'autorisant porte `verifiedBy` =
  autorisant, la garantie réelle étant le procès-verbal et le témoin.
- Une personne sans attestation ni téléphone renseigné ne peut pas être
  rapprochée d'un autre compte : toute habilitation qui la concerne reste en
  `pending_independence`.
