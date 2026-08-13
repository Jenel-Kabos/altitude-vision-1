# TENANT-DATA-REGULARIZATION-EXEC-1 — Dry-run Phase 1

Date : 2026-08-13  
Statut : **APPLY BLOCKED — CRM INDEX MIGRATION REQUIRED**  
Verdict : **PARTIALLY READY — MANIFEST REQUIRES REVIEW**

## Identité du batch

- Database : `altitudevision`
- Tenant cible : Altitude Vision, ObjectId `6a7d…3837c`
- Actor prévu : PlatformOperator actif `68f8…74f8c`
- BatchId : `tdr-exec-1-20260813-033616z`
- Manifest hash SHA-256 : `01a3fbe64b566d52ebf4219b7c97d976fc5704ae1383b4d2b678b58622ef882f`
- Dry-run : `writes=0`

## Baseline vs current

| Classification | Baseline | Current | Diff | Action |
|---|---:|---:|---:|---|
| A | 67 | 67 | 0 | candidate seulement |
| B | 50 | 50 | 0 | exclue |
| C | 0 | 0 | 0 | exclue |
| D | 43 | 43 | 0 | exclue |
| E | 0 | 0 | 0 | exclue |
| F | 216 | 216 | 0 | exclue |
| Total | 376 | 376 | 0 | |

Aucune ressource n'a changé de catégorie.

## Candidats

| Resource type | Candidate A | Ready | Skipped | Diverged |
|---|---:|---:|---:|---:|
| Property | 2 | 2 | 0 | 0 |
| RentalManagement | 1 | 1 | 0 | 0 |
| Visite | 2 | 2 | 0 | 0 |
| Conversation | 9 | 9 | 0 | 0 |
| Message | 50 | 50 | 0 | 0 |
| Document | 1 | 1 | 0 | 0 |
| Hotel | 1 | 1 | 0 | 0 |
| Accommodation | 1 | 1 | 0 | 0 |
| **TOTAL** | **67** | **67** | **0** | **0** |

**TOTAL READY FOR APPLY: 67**

## Ordre et dépendances

Ordre topologique figé : Property → RentalManagement/Visite ; Conversation → Message ; Hotel/Property → Accommodation ; Document selon ses preuves indépendantes. Le manifeste concret est ordonné ressource par ressource, pas seulement par type.

Dépendances internes au batch : Visite=2, Message=17, Accommodation=2. Les autres candidats ont une preuve A indépendante ou un parent déjà attribuable par membership canonique. Avant chaque future mutation, le parent déclaré doit déjà porter le tenant cible ; sinon `PARENT_DIVERGED`.

## Exclusions et invariants

- B=50, C=0, D=43, E=0, F=216 : aucune entrée dans le manifeste.
- 17 Contrat `bien:null` : inchangés et exclus.
- 6 comptes utilisateurs fantômes et 1 référence Property cassée : aucune réparation.
- Property : seuls les 2 champs `tenant` candidats pourraient changer ; publication, statut, owner, prix, images et portfolio restent inchangés.
- Document : seul `tenant` ; aucun champ Cloudinary/URL/asset.
- Finance : aucun candidat A réel, aucun montant/journal financier métier modifié.
- Conversation/Message : ordre parent/enfant et fingerprint relationnel obligatoires.

## Tests et gates

- Tests ciblés audit A–F + exécution : 30/30 passés (23 audit + 7 apply/concurrence/crash/idempotence/rollback).
- Backend Unit complet : 110 suites, 1265/1265 tests passés.
- ESLint serveur : 0 erreur, 129 avertissements préexistants.
- `git diff --check` : exit 0.
- Backend Mongo complet : **non vert**. Quatre tests CRM de suites antérieures ont échoué avec `E11000` sur l'index `one_crm_customer_per_tenant_source` lorsque `sourceRefs.entityType/entityId` sont nuls (`tenantCert3Pre`: 1 ; `platformAdminCert1.domains`: 3). La suite a ensuite été interrompue ; aucun PASS global n'est revendiqué.
- Web/Mobile : non exécutés, non impactés.

Cette anomalie de gate global explique le verdict `PARTIALLY READY — MANIFEST REQUIRES REVIEW`, même si le manifeste lui-même contient 67/67 entrées prêtes et sans divergence.

## Idempotence, crash recovery et rollback

Chaque attribution utilise une transaction Mongo et un update conditionnel sur `_id + tenant attendu`. `ActionLog` porte une clé unique batch/type/id/opération. Un rejeu retourne `ALREADY_APPLIED`; un crash après checkpoint reprend les entrées restantes. Les fingerprints couvrent identité, tenant et relations déterminantes sans secret.

Le rollback, testé uniquement sur Mongo jetable, parcourt le batch en ordre inverse, restaure uniquement le tenant précédent et refuse toute divergence des preuves. Aucun rollback réel n'a été tenté.

## Preuve d'absence d'écriture réelle

L'audit réel et le dry-run ont tous deux annoncé `writes=0`; la baseline après audit reste `alreadyScoped=0`. Aucun appel `--apply` n'a été exécuté. Les seules écritures ont ciblé des MongoMemoryReplSet jetables.

Confirmations : **NO REAL WRITE PERFORMED** · **NO CLOUDINARY CALL** · **NO COMMIT/PUSH/DEPLOY**.

## Prochaine étape

Ne pas appliquer. Exécuter dans un sprint distinct la migration contrôlée de l'index CRM réel, puis obtenir un Backend Mongo global entièrement vert et une nouvelle autorisation humaine explicite portant sur ce batch exact.

## Revalidation CRM-INDEX-GATE-1 — 2026-08-13T06:55:36.047Z

- CRM minimal : 9/9 passés ; CRM ciblé/automation/merge/tenant : 76/76 passés.
- Backend Unit : 110 suites, 1265/1265 passés.
- Backend Mongo global : **FULL RUN FAIL**, 76 suites passées sur 80, 844 tests passés sur 848, 4 échecs, durée 9176.201 s. Aucun des quatre échecs CRM initiaux ne subsiste. Deux échecs déterministes du global repassent isolément (2 suites, 32/32) ; deux autres sont des timeouts. Aucun PASS global n'est revendiqué.
- Tests tenant audit/exécution : 2 suites, 30/30 passés.
- Re-audit réel read-only : `writes=0`, A=67, B=50, C=0, D=43, E=0, F=216.
- Dry-run réel revalidé : `writes=0`, READY=67, exclus=309.
- Nouveau hash : `01a3fbe64b566d52ebf4219b7c97d976fc5704ae1383b4d2b678b58622ef882f` — **identique**.
- L'index CRM réel existe sans filtre partiel : une migration d'index séparée est requise. Aucun apply tenant ni changement d'index réel n'a été exécuté.
