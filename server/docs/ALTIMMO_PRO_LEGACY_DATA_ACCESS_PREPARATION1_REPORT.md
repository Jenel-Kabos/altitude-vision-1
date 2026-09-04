# ALTIMMO-PRO-LEGACY-DATA-ACCESS-PREPARATION-1 — Rapport final

## 1. Executive Summary

SPRINT : **ALTIMMO-PRO-LEGACY-DATA-ACCESS-PREPARATION-1**  
MODE : **READ-ONLY DESIGN / DATA GOVERNANCE**  
VERDICT : **A — SAFE DATA ACCESS PLAN CERTIFIED — READY FOR REPRESENTATIVE SNAPSHOT**

| Élément | Résultat |
|---|---|
| BRANCH | `main` |
| HEAD | `49f12d787b1011d16f9682cedefb81b377823e4d` |
| CURRENT DATA SOURCE | REMOTE ATLAS configuré, valeur masquée |
| CURRENT SOURCE AUTHORIZED FOR ANALYSIS | **UNKNOWN / NO implicit authorization** |
| ATLAS CONNECTION PERFORMED | **NO** |
| PRODUCTION WRITE | **NO** |
| PRODUCTION COUNT | **NON CONFIRMÉ** |
| RECOMMENDED DATA STRATEGY | **Option C — snapshot production ciblé, minimisé/anonymisé, importé localement** |
| REQUIRED COLLECTIONS | RentalManagement, Property, User/Proprietaire minimisés, tenant/org attribution, Contrat, Paiement, Receipt, Document metadata, ActionLog |
| PII STRATEGY | Drop secrets/binaires/URLs/free text ; redact/hash identité ; conserver relations et dates |
| REFERENTIAL INTEGRITY | ObjectId techniques conservés dans la copie isolée ; projections cohérentes par sous-graphe |
| SNAPSHOT PROVENANCE | Source, operator, export time, snapshot ID, schema/HEAD, method, import time, checksums |
| READ-ONLY GUARANTEE | Source account Mongo read-only + classifier local avec compte read-only distinct |
| REVIEWERS REQUIRED | **YES** |
| REVIEWER AUTHORITY | Owner testimony + Gestionnaire/Admin scoped ; double validation pour impact financier/conflit |
| UNKNOWN EFFECTIVE DATE SUPPORTED | **YES** |
| SAFE DATA SOURCE READY | **NO** — plan prêt, snapshot absent |
| REPRESENTATIVE DATA READY | **NO** |
| ANALYSIS AUTHORIZED | **NO** |
| CLASSIFICATION RESTART | **NO** jusqu'aux hard gates |
| MANAGEMENTMODE / BACKFILL / SETTLEMENT | **BLOCKED / BLOCKED / BLOCKED** |
| 10% COMMISSION / 3% PENALTY | **UNCHANGED / UNCHANGED** |
| ALTIMMO PRO APP | **NOT CREATED** |
| DATA ACCESS SAFETY | **91/100** |
| REPRESENTATIVENESS PLAN | **88/100** |
| PII MINIMIZATION | **92/100** |
| REFERENTIAL INTEGRITY PLAN | **90/100** |
| REVIEW GOVERNANCE | **82/100** |
| CLASSIFICATION RESTART READINESS | **45/100** |
| ARCHITECTURE | PASS — 0 nouvelle violation |
| LINT | 0 erreur ; 102 avertissements préexistants |
| DIFF CHECK | GREEN |
| SECRET LEAK | **NO** |
| P0 / P1 / P2 | **3 / 4 / 3** |

ACTIONS REQUIRED FROM PROJECT OWNER :

1. approuver l'option C et désigner l'opérateur DB habilité ;
2. faire produire le snapshot selon ce contrat et confirmer son usage read-only par Codex ;
3. désigner les reviewers métier avec leur périmètre tenant/property ;
4. fournir l'emplacement local isolé et le manifeste de provenance.

NEXT STEP : après réception et validation du snapshot, lancer **ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-CLASSIFICATION-2**.  
COMMIT / PUSH / DEPLOY : **NO / NO / NO**.

## 2. Git Baseline

- Branche `main`, HEAD `49f12d787b1011d16f9682cedefb81b377823e4d`.
- Worktree initial non vierge : six fichiers suivis modifiés (74 insertions, 20 suppressions) et rapports/services/tests non suivis des sprints précédents.
- Tous les fichiers préexistants sont préservés.
- `git diff --check` initial : vert.
- Seul ce rapport est créé par ce sprint.

## 3. Previous Verdict

Les quatre rapports obligatoires ont été lus intégralement. Verdict précédent : **E — DATA ACCESS REQUIRED**. Aucun count, classifier, schéma, migration ou settlement n'avait été produit, car l'unique URI configurée est distante et non autorisée explicitement en lecture.

## 4. Scope

Ce sprint choisit une stratégie de données représentatives, définit le sous-graphe minimal, la minimisation PII, les garanties techniques read-only, la chaîne de traçabilité et la gouvernance de revue. Il n'accède à aucune donnée réelle et ne construit aucun outil ou produit.

## 5. Current Data Configuration

`server/.env` définit une variable Mongo distante de type Atlas ; sa valeur n'a pas été affichée. Aucun environnement local/test dédié n'est configuré. `.env` est ignoré par `.gitignore`; les fichiers suivis sont des exemples. Les références `MONGO_URI`/`MONGODB_URI` sont dispersées dans config, tests, scripts et documentation, sans justifier un accès effectif.

## 6. Credential Safety

Aucun secret réel n'a été reproduit. L'audit a vérifié présence, type local/distant et suivi Git uniquement. Password hashes, reset/JWT/OAuth/API/SMTP/Cloudinary/provider/session secrets sont exclus du futur snapshot. Un secret versionné opérationnel n'a pas été démontré dans ce périmètre.

## 7. Why Current Atlas URI Was Not Used

Une URI disponible n'est pas une autorisation. Le rôle Mongo, l'environnement, la portée réseau et la représentativité ne peuvent être testés sans connexion, explicitement interdite. Aucun `mongosh`, mongoose, `mongoexport` ou `mongodump` n'a été lancé contre Atlas.

## 8. Required Data Graph

```text
RentalManagement
 ├─ property → Property ─ owner → User ─ profile → Proprietaire
 │                    └─ tenant attribution → PlatformTenant/OrgUnit/OrgMembership
 ├─ owner/manager/history actors → User (minimal)
 ├─ activeLease / Property → Contrat ─ locataire → Locataire (minimal)
 │                              └─ Paiement ─ RentalPaymentReceipt
 ├─ property/entity → Document metadata
 └─ property/rental/action targets → ActionLog
```

Maintenance et Notification servent éventuellement à valider la cohérence temporelle, mais ne prouvent pas le mode ; elles sont exclues du snapshot de base et ajoutables seulement par décision documentée.

## 9. Collection Inventory

| Collection | Needed | Why | Required Fields | PII | Treatment |
|---|---:|---|---|---|---|
| rentalmanagements | Oui | Objet classifié, workflow/dates | IDs, tenant/property/owner/manager, activation, mandate dates, history action/source/actor/at, timestamps | commentaires | Drop comments/reasons/free text |
| properties | Oui | Owner/tenant et cohérence actif | `_id`, tenant, owner, status, publication/asset flags, timestamps | adresse/images/description | Drop |
| users | Oui minimal | Acteurs/roles | `_id`, role, status, createdAt | identité/auth/secrets | Drop tout sauf minimum |
| proprietaires | Oui minimal | Lien métier User | `_id`, user, timestamps | identité, biens libres | Drop |
| platformtenants | Oui minimal | Isolation | `_id`, rootOrgUnit, status | nom/settings | Pseudonymize/drop |
| orgunits/orgmemberships | Oui minimal | Attribution/membership | IDs, parent/ancestors, user, role/status, dates | metadata libre | Drop metadata |
| contrats | Oui | Bail et temporalité | IDs, bien/proprietaire/locataire, type/statut, dates/cycle, timestamps | docs/notes/acheteur | Drop |
| locataires | Optionnel minimal | Valider référence du bail | `_id`, user` | identité/revenus/documents | Drop |
| paiements | Oui | Jalons financiers | `_id`, contrat, période, montant/statut/date, timestamps | référence/notes/preuve | Drop |
| rentalpaymentreceipts | Oui | Recorder et temporalité | IDs, paiement/contrat/auteur, montant/date/statut/encaissementId, timestamps | référence/preuve/notes | Drop |
| documents | Oui metadata | Mandat éventuel et linkage | IDs, tenant/type/status/createdBy/property/entity, dates, catégorie | content/assets/client/refNom | Drop/redact |
| actionlogs | Oui ciblé | Onboarding/actions/audit | tenant, action/module, auteur.id/role, cible.id/type, typeAction, date, metadata structurée utile | descriptions/email/IP/UA | Drop |
| rentalmaintenancetickets | Non par défaut | Pas de preuve de mode | — | photos/descriptions | Exclure |
| notifications | Non | Effet secondaire | — | destinataires/body | Exclure |

## 10. Data Minimization

Le snapshot est un **targeted subgraph**. Chaque projection est allowlistée ; tout champ absent de l'allowlist est supprimé. Les relations ObjectId et dates nécessaires sont préservées, les payloads métier non pertinents exclus. Un manifest liste collections, projection version et critères d'extraction.

## 11. PII Inventory

| Model | Field | Needed? | Sensitivity | Treatment |
|---|---:|---:|---|---|
| User/Proprietaire/Locataire | name/email/phone/address | Non | Haute | Drop ou pseudonyme non réversible |
| User | password/reset/tokens/IP | Non | Critique | Exclude absolument |
| Property | address/coordinates/images/description | Non | Haute | Drop |
| Contrat | notes/documents/acheteur | Non | Haute | Drop |
| Paiement/Receipt | reference, proof, notes | Non | Haute | Drop |
| Document | content, URLs/assets, client/refNom | Non | Critique | Drop ; metadata seulement |
| ActionLog | email/IP/userAgent/descriptions | Non | Haute | Drop ; codes/IDs seulement |
| Tous | ObjectId techniques | Oui interne | Linkable | Conserver dans DB isolée, ne pas publier |
| Tous | dates métier | Oui | Moyenne | Conserver exactement |
| Paiement/Receipt | montants/statuts | Oui comme jalons | Financière | Conserver dans environnement restreint |

## 12. Secret Exclusion

Exclusion absolue : URI, credentials, password hashes, JWT/session/reset tokens, clés OAuth/API/SMTP/Cloudinary/providers, secrets d'application, cookies et fichiers `.env`. User est projeté par allowlist, jamais copié intégralement.

## 13. Referential Integrity

Exporter d'abord les RentalManagement, calculer les ensembles d'IDs référencés, puis extraire uniquement leurs ressources transitives. Vérifier chaque relation avant import et produire des counts d'orphelins. Le mapping, s'il est requis, doit être déterministe et commun à toutes les collections.

## 14. ObjectId Strategy

Conserver les ObjectId techniques **à l'intérieur de la DB locale isolée** : ils ne sont pas seuls une identité civile et garantissent fidélité/populate. Ils restent linkables, donc ne sont ni publiés dans Git ni exposés dans les rapports. Pour un transfert hors périmètre contrôlé, appliquer une pseudonymisation déterministe de tous les champs/références avec une clé éphémère gardée hors snapshot.

## 15. Temporal Data

Conserver sans décalage : `createdAt`, `updatedAt`, dates de mandat/bail/paiement/receipt/document/audit et `workflowHistory.at`. La date du snapshot est une metadata de provenance, jamais une date métier.

## 16. Financial Evidence

Conserver montants, périodes, statuts, relations, dates et actor ID utiles à la chronologie. Supprimer coordonnées bancaires, références libres, preuves/URLs et notes. Ces données corroborent mais ne prouvent pas custody ou management mode.

## 17. Document Strategy

Exporter seulement metadata structurée et relations. Aucun binaire, contenu libre, signature, pièce d'identité ou URL. Si un mandat doit être contrôlé, un reviewer autorisé consulte la source dans son système sécurisé et référence son identifiant/statut dans la décision ; le fichier ne rejoint pas la DB d'audit.

## 18. Cloudinary Boundary

Aucun accès, download, upload ou delete Cloudinary. URLs, `publicId`, asset metadata de livraison et credentials sont retirés. La présence d'un asset peut être réduite à un booléen si nécessaire.

## 19. Free Text

Descriptions, comments, reasons, notes, content, bodies et noms libres sont exclus par défaut. Une exception exige justification, environnement sécurisé et redaction ; elle ne doit pas être versionnée.

## 20. Data Strategy Options

- A Atlas direct RO : représentatif mais forte exposition live et faible reproductibilité.
- B snapshot local brut : reproductible, mais PII excessive.
- C snapshot ciblé minimisé/anonymisé : équilibre optimal.
- D staging synchronisé : représentativité et fraîcheur non garanties.
- E export ciblé seul : bonne minimisation, mais doit encore fournir isolation, anonymisation et import cohérent.

## 21. Decision Matrix

| Requirement | Atlas Direct RO | Local Snapshot | Anonymized Snapshot | Staging | Targeted Export |
|---|---:|---:|---:|---:|---:|
| Representative | 10 | 10 | 9 | 5 | 9 |
| Technically read-only | 9 avec rôle dédié | 6 | 9 avec compte local RO | 6 | 8 |
| PII minimized | 2 | 2 | 10 | 3 | 9 |
| Referential integrity | 10 | 10 | 9 | 6 | 8 |
| Reproducible | 4 | 10 | 10 | 4 | 9 |
| Safe for Codex analysis | 3 | 5 | 10 | 5 | 8 |
| Easy cleanup | 5 | 8 | 9 | 4 | 9 |
| Recommended | Non | Non | **Oui** | Non | Comme mécanisme de C, pas stratégie autonome |

| Option | Representativeness | Write Risk | PII Risk | Referential Integrity | Reproducibility | Operational Cost | Recommended |
|---|---:|---:|---:|---:|---:|---:|---:|
| A Atlas direct RO | Haute | Faible si rôle réel | Haute | Haute | Faible | Moyen | Non |
| B snapshot brut | Haute | Locale seulement | Haute | Haute | Haute | Moyen | Non |
| C snapshot ciblé anonymisé | Haute | Très faible | Faible | Haute | Haute | Moyen-haut | **Oui** |
| D staging synchronisé | Inconnue | Moyenne | Moyenne | Moyenne | Faible | Haut | Non |
| E export ciblé | Haute | Faible | Faible | Moyenne-haute | Haute | Moyen | Sous-composant de C |

## 22. Recommended Strategy

RECOMMENDED DATA STRATEGY : **Option C — snapshot production ciblé, minimisé/anonymisé, local et isolé**.  
WHY : représentativité, reproductibilité, faible risque de write live, minimisation PII et analyse hors réseau production.  
RISK : transformation incomplète pouvant casser une relation ou retirer une preuve ; réduit par manifest, checksum et contrôles d'intégrité.  
USER ACTION REQUIRED : approbation, opérateur habilité, snapshot, reviewers et autorisation explicite.  
NEXT TECHNICAL STEP : `ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-CLASSIFICATION-2` après hard gates.

## 23. Snapshot Scope

Targeted subgraph de tous les RentalManagement legacy et uniquement leurs relations listées section 9. Ce n'est ni un full database dump ni un échantillon. Les collections optionnelles sont ajoutées seulement si le premier contrôle montre une preuve nécessaire.

## 24. Snapshot Provenance

Manifest obligatoire : `snapshotId`, source environment/database logique, exportedBy (identité canonique de l'opérateur), exportedAt UTC, source read role, extraction/projection version, anonymization method/version, source schema commit/HEAD, importedAt, target DB name et checksums. Aucune credential dans le manifest.

## 25. Snapshot Isolation

DB dédiée recommandée : `altitudevision_legacy_audit_<snapshotId>`, sur une instance locale non accessible aux serveurs normaux. Pas de DB dev quotidienne, dossier partagé, Git ou sync cloud non maîtrisée. Seuls opérateur et analystes autorisés y accèdent.

## 26. Snapshot Immutability

Après import validé, geler l'artefact source et n'accorder au classifier qu'un rôle Mongo `read` sur cette DB. Toute nouvelle extraction reçoit un nouvel ID ; jamais de mutation silencieuse du snapshot existant.

## 27. Checksum

SHA-256 recommandé sur chaque fichier exporté et sur un manifest canonique. Les checksums sont recalculés après transfert et avant classification ; ils ne sont pas calculés ici, car aucune donnée n'existe.

## 28. Retention/Cleanup

Conserver jusqu'à certification classification/review/backfill plan, puis supprimer dans les 30 jours ; plafond 90 jours sans renouvellement écrit. Cleanup par opérateur : drop DB audit, suppression exports/maps temporaires, révocation/rotation du compte temporaire, trace de destruction. Aucun backup supplémentaire par défaut.

## 29. Read-Only Guarantee

Deux barrières techniques : compte Atlas d'export dédié avec rôle `read` limité à la source nécessaire ; compte Mongo local du classifier avec rôle `read` limité à la DB audit. Le credential d'import local est séparé, détenu par l'opérateur et jamais fourni au classifier. Le prompt seul n'est pas accepté comme protection.

## 30. Atlas Alternative

Atlas direct n'est pas recommandé. S'il devenait nécessaire : autorisation écrite, compte temporaire dédié read-only/least privilege, database scope minimal, IP allowlist temporaire, audit logging, expiration/rotation et aucun rôle write/admin. Aucun test de connexion dans ce sprint.

## 31. Export Responsibility

Création par DBA ou opérateur infrastructure explicitement habilité par le project owner. Un PlatformOperator applicatif ne reçoit pas automatiquement l'autorité Atlas. Codex ne peut pas s'auto-autoriser.

Procédure humaine :

1. créer/valider un compte source `<READ_ONLY_URI>` limité en lecture ;
2. extraire le sous-graphe avec projections allowlistées dans un répertoire chiffré temporaire ;
3. appliquer minimisation/anonymisation et générer manifest + SHA-256 ;
4. transférer localement par canal contrôlé et vérifier checksums ;
5. importer dans `altitudevision_legacy_audit_<snapshotId>` avec credential d'import séparé ;
6. créer un compte local classifier read-only ;
7. vérifier collections, counts, orphelins, relations, timestamps et schema HEAD ;
8. après usage, appliquer la politique de cleanup.

Les outils peuvent inclure `mongodump`/`mongoexport` avec `<READ_ONLY_URI>`, suivis d'une transformation contrôlée ; aucune commande réelle n'est exécutée ici.

## 32. Human Review Governance

Séparer classification technique et attestation métier. Le classifier produit deterministic ou REVIEW_REQUIRED. Les cas ambigus passent à un reviewer autorisé, qui approuve OWNER_MANAGED, AGENCY_MANAGED ou INSUFFICIENT_EVIDENCE avec date connue/inconnue et références.

## 33. Reviewer Authority

Trois conditions cumulatives : autorité tenant, relation property/owner et fonction métier. Un reviewer ne traite jamais hors scope. Le project owner désigne des User IDs/fonctions ; aucun nom n'est inventé.

## 34. Owner Review

Le propriétaire peut attester OWNER_MANAGED pour son bien et fournir sa connaissance d'une délégation. Son témoignage seul est acceptable comme preuve à examiner pour un mode courant sans effet rétroactif, mais pas pour effacer un mandat agence ou déclencher des conséquences financières historiques en cas de conflit.

## 35. Agency Review

Un GestionnaireImmobilier/responsable agence scoped peut attester AGENCY_MANAGED en référant mandat/registre et période. Une déclaration staff non documentée reste insuffisante. Il ne peut attester hors tenant.

## 36. Admin Review

Admin scoped approuve la décision et sa traçabilité, sans autorité cross-tenant automatique. Pour une décision historique pouvant influencer commission/settlement, recommandation de double validation : responsable agence + Admin distinct, et prise en compte de l'attestation owner. Elle n'autorise aucun recalcul automatique.

## 37. Conflict Handling

Owner=OWNER et agency=AGENCY, périodes chevauchantes ou preuves cross-scope donnent `DISPUTED/REVIEW_REQUIRED`. Aucune priorité automatique. Résolution documentée ou `INSUFFICIENT_EVIDENCE`; settlement reste bloqué.

## 38. Decision States

Décisions : `OWNER_MANAGED`, `AGENCY_MANAGED`, `INSUFFICIENT_EVIDENCE`. États workflow : `PENDING_REVIEW`, `APPROVED`, `DISPUTED`. `DATE_UNKNOWN`/`effectiveFromKnown:false` est un attribut séparé, jamais un managementMode.

## 39. Effective Date

`effectiveFrom` désigne la date métier prouvée ; `reviewedAt` l'heure de décision. Elles ne sont jamais substituées. Une source/référence et la méthode de preuve accompagnent la date.

## 40. Unknown Date

Si le mode est attestable mais pas sa date, conserver décision + `effectiveFromKnown:false` et code `DATE_UNKNOWN`. Ce dossier peut éventuellement supporter un mode courant, jamais une histoire ni un settlement rétroactif.

## 41. Evidence References

Références techniques : IDs de mandat/Contrat/ActionLog, type, statut, dates et checksum éventuel. Les fichiers sources restent dans leur coffre/système sécurisé, non dans Git ou le dataset de décisions.

## 42. Review Dataset

Format machine-readable :

```json
{
  "snapshotId": "<SNAPSHOT_ID>",
  "rentalManagementId": "<TECHNICAL_ID>",
  "decision": "AGENCY_MANAGED",
  "effectiveFrom": "<ISO_DATE_OR_NULL>",
  "effectiveFromKnown": true,
  "reviewedBy": "<USER_ID>",
  "reviewedAt": "<ISO_DATE>",
  "reasonCode": "<CODE>",
  "evidenceRefs": ["<TYPE:ID>"],
  "reviewScope": { "tenantId": "<ID>", "propertyId": "<ID>" }
}
```

Le vrai dataset n'est **pas Git-safe par défaut** : IDs, relations et décisions sont sensibles. Stockage recommandé : répertoire chiffré restreint ou coffre/object storage privé avec versioning/audit. Seuls schéma JSON et exemples fictifs peuvent être versionnés.

## 43. Auditability

Conserver classificationSource (`AUTOMATED_AUTHORITATIVE`, `AUTOMATED_CORROBORATED`, `HUMAN_REVIEW`), reviewer User ID, timestamps, reasons, evidence refs, snapshot/checksum et versions de règle. Toute correction est une nouvelle décision liée à la précédente, jamais une édition invisible.

## 44. Chain of Custody

`SOURCE → EXPORTED BY → EXPORTED AT → SNAPSHOT ID → PROJECTION/ANONYMIZATION VERSION → CHECKSUM → IMPORTED AT → LOCAL DB → AUDITED AGAINST HEAD`. Chaque étape est inscrite dans le manifest, sans secret.

## 45. Classification Restart Contract

Hard gates cumulatifs : `SAFE_DATA_SOURCE=YES`, `REPRESENTATIVE_DATA=YES`, `ANALYSIS_AUTHORIZED=YES`, provenance/checksums valides, collections/relations/timestamps vérifiés, classifier credential local read-only, reviewers désignés et scope documenté. Alors seulement Classification-2 peut démarrer.

## 46. ManagementMode Gate

**BLOCKED.** Il reste à produire counts, classifications, review decisions et stratégie de dates sur snapshot. Aucun champ/history/transition avant certification.

## 47. Settlement Gate

**BLOCKED.** Une classification de mode ne prouve pas custody ; aucun 10 %, ownerNet, payout ou recalcul historique.

## 48. Data Readiness Scores

| Axe | Score | Justification |
|---|---:|---|
| Data access safety | 91/100 | Double rôle read-only, isolation et no direct Atlas |
| Representativeness plan | 88/100 | Snapshot prod complet sur sous-graphe, pas fixtures |
| PII minimization | 92/100 | Allowlist, no binaries/secrets/free text |
| Referential integrity plan | 90/100 | ObjectId/dates conservés, orphan checks/checksums |
| Review governance | 82/100 | Roles/scopes/double review définis ; personnes non désignées |
| Classification restart readiness | 45/100 | Plan complet, source/authorization/reviewers absents |

## 49. P0/P1/P2

- P0 (3) : approbation stratégie ; snapshot représentatif autorisé ; reviewers désignés.
- P1 (4) : extraction/minimisation ; validation manifest/intégrité ; DB locale+compte RO ; dataset de décisions sécurisé.
- P2 (3) : automatiser cleanup ; monitorer provenance ; formaliser conservation organisationnelle.

## 50. Actions Required From Project Owner

1. approuver **Option C** ;
2. désigner le DBA/opérateur et autoriser explicitement l'analyse du snapshot ;
3. désigner Gestionnaire/Admin/owners reviewers et leurs scopes ;
4. fournir chemin local isolé, snapshot ID et manifest après validation.

## 51. Next Technical Step

Attendre les quatre actions. Une fois les hard gates confirmés : lancer exactement **ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-CLASSIFICATION-2**. Aucun sprint settlement entre-temps.

## 52. Mandatory Answers

1. Branch : `main`. 2. HEAD : `49f12d787b1011d16f9682cedefb81b377823e4d`. 3. Worktree initial : non vierge. 4. Préexistants : six fichiers suivis + services/tests/rapports non suivis. 5. Diff-check initial : vert. 6. Rapports lus : oui. 7. Verdict précédent : E DATA ACCESS REQUIRED. 8. Pourquoi : pas de source autorisée ni counts/provenance. 9. URI distante : oui, présence/type seulement. 10. URI affichée : non. 11. Credentials affichés : non. 12. Connexion Atlas : non. 13. mongosh : non. 14. mongoexport : non. 15. mongodump : non. 16. Mongo write : non. 17. Production access : non. 18. Counts : NON CONFIRMÉ.

19. Collections : section 9. 20. Pourquoi : sous-graphe mode, autorité, temporalité et audit. 21. RentalManagement : oui. 22. Property : oui. 23. Proprietaire : minimal. 24. User : minimal. 25. Contrat : oui. 26. Locataire : optionnel minimal. 27. Paiement : oui. 28. Receipt : oui. 29. Document : metadata. 30. Maintenance : non par défaut. 31. Notifications : non. 32. Audit logs : oui ciblés. 33. Minimum dataset : défini. 34. PII inventory : défini. 35. Secrets exclus : oui. 36. Password hashes : non, aucune relation requise. 37. Tokens : non. 38. Binaries : non. 39. Cloudinary access : non. 40. Cloudinary write : non. 41. Free text : non par défaut.

42. ObjectId : conservés dans isolation. 43. Intégrité : expansion subgraph + orphan checks. 44. Dates : conservées. 45. Finance : montants/statuts/dates/relations minimisés. 46. Full DB : non. 47. Targeted subgraph : oui. 48. Atlas direct : évalué. 49. Snapshot local : évalué. 50. Anonymized snapshot : évalué. 51. Staging : évalué. 52. Targeted export : évalué. 53. Recommandation : option C. 54. Pourquoi : meilleur équilibre sécurité/fidélité/reproductibilité. 55. Read-only : rôles Mongo source/local séparés. 56. Prompt-only : non. 57. Dedicated account : oui. 58. Provenance : définie. 59. Snapshot ID : contrat défini, valeur future. 60. Checksum : SHA-256 recommandé. 61. DB isolée : oui. 62. DB dev quotidienne : non. 63. Backend prod sur DB audit : non. 64. Web/mobile : non. 65. Retention : 30 jours après certification, max 90 sans renouvellement. 66. Cleanup : défini. 67. Export operator : DBA/opérateur habilité. 68. Auto-autorisation Codex : non.

69. Reviewers : oui. 70. Fonctions : owner, Gestionnaire/responsable agence, Admin scoped. 71. Noms inventés : non. 72. Owner reviewer : témoignage own scope, limites financières. 73. Staff : oui scoped avec références. 74. Admin : oui scoped/approbation. 75. Authority scope : tenant+property+business. 76. Cross-tenant : interdit. 77. Decision states : owner, agency, insufficient + workflow. 78. DATE_UNKNOWN : oui séparé. 79. reviewedAt ≠ effectiveFrom : oui. 80. Evidence refs : oui. 81. Conflict : disputed/review required. 82. Dual review : recommandée pour impact financier historique. 83. Dataset : défini. 84. PII : minimisé mais sensible/linkable. 85. Git-safe : non par défaut.

86. Classification exécutée : non. 87. Classifier : non. 88. Backfill : non. 89. managementMode : non. 90. History : non. 91. Settlement : non. 92. 10 % appliqué : non. 93. Penalty : inchangée. 94. Subscription : non. 95. App Pro : non. 96. Second backend : non. 97. PlatformTenant : inchangé. 98. Safe source ready : non. 99. Representative ready : non. 100. Analysis authorized : non. 101. Reviewers designated : non. 102. Restart classification : non. 103. Blockers : snapshot, authorization, manifest et reviewers.

104. Data safety : 91. 105. Representativeness : 88. 106. PII : 92. 107. Referential integrity : 90. 108. Governance : 82. 109. Restart : 45. 110. P0 : 3. 111. P1 : 4. 112. P2 : 3. 113. Fichier sprint : ce rapport uniquement. 114. Code : non. 115. Model : non. 116. Script : non. 117. Test : non. 118. Frontend : non. 119. Mobile : non. 120. Architecture : PASS, 0 nouvelle violation. 121. Lint : 0 erreur, 102 warnings préexistants. 122. Diff-check final : vert. 123. Secret leak : non. 124. Actions owner : section 50. 125. Next exact step : fournir/autoriser snapshot et reviewers. 126. Next sprint : `ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-CLASSIFICATION-2`. 127. Rapport : oui. 128. Commit : non. 129. Push : non. 130. Deploy : non. 131. Verdict : A.

## 53. Final Verdict

**A — SAFE DATA ACCESS PLAN CERTIFIED — READY FOR REPRESENTATIVE SNAPSHOT.**

La stratégie recommandée est une extraction ciblée de production par opérateur habilité et compte source read-only, minimisée/anonymisée, vérifiée par manifest/checksums, puis importée dans une DB locale isolée accessible au classifier via un compte local read-only. Elle préserve ObjectId, dates et relations tout en excluant secrets, binaires et PII inutile.

Le plan est prêt ; la source ne l'est pas. Classification-2 ne peut commencer qu'après fourniture du snapshot, autorisation explicite d'analyse et désignation des reviewers. Aucun accès Atlas, write Mongo, migration, managementMode, settlement, code, commit, push ou déploiement n'a été effectué.
