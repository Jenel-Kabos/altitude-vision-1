# ALTIMMO-PRO-FOUNDATION-CONTRACT-1 — Rapport final

## 1. Executive Summary

SPRINT : **ALTIMMO-PRO-FOUNDATION-CONTRACT-1**  
MODE : **CHARACTERIZE FIRST**  
VERDICT : **B — FOUNDATION CONTRACT CERTIFIED, IMPLEMENTATION DEFERRED**

| Élément | Résultat |
|---|---|
| BRANCH | `main` |
| HEAD | `49f12d787b1011d16f9682cedefb81b377823e4d` |
| MANAGEMENT MODE | **PROVEN contractually; not persisted** |
| CANONICAL MODES | `OWNER_MANAGED`, `AGENCY_MANAGED` |
| OWNER_MANAGED | Le propriétaire conserve l'autorité opérationnelle |
| AGENCY_MANAGED | L'agence exerce l'autorité selon un mandat valide |
| MODE HISTORY | Historique embedded append-only dans `RentalManagement` |
| EFFECTIVE DATING | `effectiveAt`; fin d'une période déduite de l'entrée suivante |
| OWNER→AGENCY | Supported contractually, implementation blocked by legacy classification |
| AGENCY→OWNER | Supported contractually, implementation blocked by legacy classification |
| LEGACY STRATEGY | Inventaire dry-run, classification prouvée, revue manuelle des ambigus, fail closed |
| LEGACY AMBIGUOUS | **NON CONFIRMÉ** — aucune base autoritative n'a été interrogée |
| PROPERTY DUPLICATION | **NO** |
| RENTALMANAGEMENT DUPLICATION | **NO** |
| OWNER AS PLATFORMTENANT | **NO** |
| ROLE ≠ ENTITLEMENT | **YES** |
| 10% AGENCY COMMISSION | **AGENCY_MANAGED ONLY** |
| MANAGEMENTFEE | **SETUP FEE — UNCHANGED** |
| 3% PENALTY | **UNCHANGED** ; bénéficiaire et interaction commission non confirmés |
| MODE ≠ MONEY CUSTODY | **YES** |
| OWNER DIRECT COLLECTION SETTLEMENT | **NO** |
| AGENCY SETTLEMENT | **DEFERRED** |
| PRO SUBSCRIPTION | **DEFERRED / SEPARATE DOMAIN** |
| CODE IMPLEMENTED | **NO** |
| RED→GREEN | **N/A** |
| TARGETED TESTS | **85/85** |
| BACKEND | Non exécuté : aucun code backend modifié |
| MONGO | Non exécuté : aucun modèle/index/persistence modifié |
| ARCHITECTURE | PASS — 0 nouvelle violation |
| LINT | Vert — 0 erreur, 102 avertissements existants |
| DIFF CHECK | GREEN |
| FOUNDATION READINESS | **76/100** |
| SECURITY CONFIDENCE | **84/100** |
| FINANCIAL BOUNDARY CONFIDENCE | **80/100** |
| LEGACY CONFIDENCE | **25/100** |
| SETTLEMENT RESTART | **NO** |
| P0 | **1** |
| P1 | **4** |
| P2 | **3** |
| NEXT SPRINT | **ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-MIGRATION-1** |
| COMMIT / PUSH / DEPLOY | **NO / NO / NO** |

Le contrat métier est suffisamment précis pour guider une implémentation, mais le seuil du sprint interdit de coder tant que la classification des documents existants n'est pas prouvée. Ajouter un défaut à l'un des deux modes réécrirait silencieusement leur histoire et pourrait attribuer une commission ou une autorité erronée.

## 2. Git Baseline

- Branche : `main`.
- HEAD : `49f12d787b1011d16f9682cedefb81b377823e4d`.
- Worktree initial non vierge.
- Modifiés préexistants : `client/lib/components/dashboard/DashboardUI.jsx`, `client/lib/pages/dashboard/MyPaymentsPage.jsx`, `server/__tests__/tenantPortalService.test.js`, `server/controllers/rentalManagementController.js`, `server/routes/rentalManagementRoutes.js`, `server/services/tenantPortalService.js`.
- Non suivis préexistants : tests/services/rapports du portail financier propriétaire, dont `rentalOwnerFinancialService.js`, `rentalPaymentProjectionService.js` et les quatre rapports précédents.
- Diff préexistant suivi : 6 fichiers, 74 insertions, 20 suppressions.
- `git diff --check` initial : vert.
- Tous ces changements ont été préservés.

## 3. Previous Audit Decisions

Les quatre rapports obligatoires ont été lus intégralement. Ils établissent : plateforme/auth/Mongo partagés ; application Pro dédiée ultérieure ; RentalManagement à adapter sans duplication ; portail locataire réutilisé ; 10 % réservé à la gestion agence ; aucun settlement en collecte directe propriétaire ; `managementFee` forfait de mise en gestion ; settlement et abonnement Pro absents ; bénéficiaire de la pénalité 3 % non confirmé.

## 4. Scope

Ce sprint définit modes, historique, dates d'effet, transitions, autorités, stratégie legacy et frontière d'entitlement. Il ne crée ni application Pro, ni modèle, ni champ, ni API, ni migration, ni settlement, ni facturation.

## 5. RentalManagement Current Contract

`RentalManagement` est unique par `property`, exige `property` et `owner`, et référence éventuellement PlatformTenant, manager, Locataire et Contrat. Il porte activation, occupation, disponibilité, publication, loyer, charges, dépôt, `managementFee`, dates de mandat, maintenance, préavis, readiness, `workflowHistory` et demandes propriétaire.

Les defaults historiques (`active:true`, `managementActivated:true`) conservent la compatibilité. Les index couvrent Property unique, tenant, owner, active, activation, occupation, disponibilité et publication. Aucun hook ni virtual métier n'est défini. Les routes owner sont limitées à lecture/demandes ; les mutations opérationnelles sont staff/capabilities et tenant-scoped. Verdict agrégat : **YES, après adaptation**. Le mode décrit précisément une propriété de ce dossier, pas de Property ou Contrat.

## 6. Property Boundary

Property reste l'actif canonique et peut exister sans RentalManagement. `internalManagedOnly`, `isPublished` et les statuts de publication prouvent qu'un bien géré peut rester privé. L'enrollment crée ou active un RentalManagement lié au Property existant ; aucune copie de Property et aucun refactor Listing dans ce sprint.

## 7. managementFee

`managementFee` reste un frais forfaitaire de mise en gestion, configuré par le flux agence/Admin. Il n'est ni renommé, ni réinterprété, ni utilisé comme commission récurrente.

## 8. Management Mode Contract

- Nom canonique futur : `managementMode` sur `RentalManagement`.
- Enum exact : `OWNER_MANAGED`, `AGENCY_MANAGED`.
- Aucun troisième mode. L'absence sur legacy signifie **non classifié**, état de migration et non mode métier.
- Champ courant futur nullable pour compatibilité, sans default silencieux.
- Toute nouvelle activation devra passer par un service canonique et fournir explicitement le mode.
- Une donnée non classifiée échoue fermée pour les commandes Pro, la commission et le settlement.

## 9. OWNER_MANAGED

Le propriétaire canonique (`RentalManagement.owner`/`Property.owner`, ou future membership explicitement déléguée) conserve l'autorité opérationnelle : gestion du dossier, bail, encaissement déclaré, maintenance et documents. Le rôle `Proprietaire` seul ne suffit pas ; ownership et entitlement devront tous deux être prouvés.

## 10. AGENCY_MANAGED

Altitude Vision exerce l'autorité opérationnelle selon un mandat valide et dans un tenant résolu. Le propriétaire conserve une lecture contractuellement autorisée, mais ne modifie pas les encaissements agence, commissions ou futurs settlements.

## 11. History Strategy

Solution retenue : tableau embedded futur `managementModeHistory`, distinct de `workflowHistory`. Une entrée minimale contient `mode`, `effectiveAt`, `changedBy`, `source`, `reason`, `recordedAt` et éventuellement `correctionOf`. L'embedded history assure atomicité avec le mode courant, lecture locale et absence de nouveau modèle. Il est append-only ; aucune suppression ou réécriture silencieuse.

`workflowHistory` est trop générique (`from/to/action`) et déjà utilisé pour occupation, publication, maintenance et demandes. Le réutiliser comme source financière rendrait l'invariant fragile. Un modèle séparé et l'event sourcing seraient disproportionnés à ce stade.

## 12. Effective Dating

Le champ temporel canonique de chaque entrée est `effectiveAt`. `recordedAt` est l'heure d'enregistrement/audit, pas l'heure métier. L'intervalle d'un mode va de son `effectiveAt` au `effectiveAt` de l'entrée suivante ; aucun `endedAt` redondant. Le mode à T est la dernière entrée effective à ou avant T.

Pour une implémentation minimale, les transitions runtime sont immédiates (`effectiveAt = now`). Le backdating est réservé à une migration/revue explicitement autorisée. Les transitions programmées futures sont différées afin d'éviter deux notions concurrentes de mode courant.

## 13. Transition Contract

La transition est une commande métier, jamais un PATCH libre. Elle valide acteur, ownership/tenant, mandat, état attendu, date, raison, entitlement le cas échéant et préconditions financières. Une self-transition retourne un conflit sans écrire d'historique.

## 14. Owner→Agency

Le propriétaire peut demander le transfert ; seule une autorité agence/staff résolue peut l'accepter après preuve du mandat. À `effectiveAt`, les écritures opérationnelles passent à l'agence. Property, dossier, Locataire, Contrat, paiements, reçus, maintenance et documents conservent leurs identifiants. Aucune commission n'est appliquée aux encaissements antérieurs.

## 15. Agency→Owner

Le propriétaire peut demander la reprise ; une autorité agence/Admin dans le scope clôt le mandat et effectue la transition. Le propriétaire récupère les écritures opérationnelles à `effectiveAt`. Les commissions et futurs settlements antérieurs restent historiques ; aucun nouvel encaissement owner-managed ne devient commissionnable par simple héritage.

## 16. Non-Retroactivity

Le changement de mode ne met jamais à jour Paiement, RentalPaymentReceipt, quittance ou historique financier existant. Les futurs calculs devront utiliser le contexte snapshoté sur l'encaissement, non le seul mode courant.

## 17. Owner Authority

En OWNER_MANAGED : lecture du portefeuille/bien/dossier/locataire/bail/paiements/reçus/documents ; écritures de gestion, bail, encaissement déclaré et maintenance, sous ownership + entitlement. En AGENCY_MANAGED : lecture autorisée ; demandes possibles ; aucune mutation d'encaissement agence, de commission, payout ou autorité staff.

## 18. Agency Authority

En AGENCY_MANAGED, staff autorisé et tenant-scoped possède les écritures opérationnelles, financières et administratives prévues par capabilities. En OWNER_MANAGED, staff n'acquiert pas automatiquement l'autorité opérationnelle ; lecture/support seulement si une permission et une relation explicites existent.

## 19. Admin Authority

Admin conserve ses pouvoirs légitimes dans son tenant/scope. Admin n'est pas automatiquement cross-tenant et ne contourne ni ownership ni mode pour une opération financière.

## 20. PlatformOperator

Les contrats global/scoped existants restent inchangés. Un opérateur global avec capability explicite peut administrer/corriger ; un opérateur scoped reste borné. Aucun changement de modèle ou middleware.

## 21. Tenant Isolation

PlatformTenant demeure une organisation SaaS. Le propriétaire n'est jamais transformé automatiquement en tenant, et `ownerId == tenantId` est interdit. Les ressources agence utilisent la résolution tenant existante ; l'autogestion utilise ownership/membership canonique. Les données legacy non attribuables échouent fermées sur opérations sensibles.

## 22. Role vs Entitlement

`Proprietaire` est un rôle métier, pas une preuve d'abonnement. Le rôle autorise la catégorie d'acteur ; l'entitlement autorise la capacité commerciale ; l'ownership autorise la ressource. Les trois contrôles sont cumulatifs.

## 23. Pro Entitlement Boundary

Recommandation : **CONTRACT ONLY** maintenant. Le futur backend devra appeler une abstraction du type `assertProEntitlement({ user, capability, resource })`, capable de résoudre sujet individuel ou organisation, statut, feature et quota. Aucun modèle subscription/plan n'est justifié avant les décisions commerciales. L'UI pourra masquer, jamais autoriser.

## 24. Property Enrollment

Flux futur : Property existant détenu par l'acteur → preuve entitlement/ownership → création ou activation du RentalManagement unique → commande `NONE → OWNER_MANAGED`. La publication n'est ni requise ni automatique.

## 25. Agency Enrollment

Flux futur : Property existant → demande/mandat accepté → résolution tenant/owner → création ou activation du RentalManagement unique → `NONE → AGENCY_MANAGED`. Une annonce ou un rôle staff ne suffit pas à inscrire automatiquement le bien.

## 26. Contrat

Le Contrat canonique, ses avenants, caution et cycle de vie sont réutilisés dans les deux modes. Ses routes staff actuelles ne doivent pas être exposées telles quelles à Pro ; de futurs cas d'usage owner-authority délégueront aux services partagés.

## 27. Locataire

Locataire reste canonique. Son lien User optionnel et approuvé est sain. L'accès owner devra être prouvé par RentalManagement/Contrat/Property ; aucun dossier `OwnerManagedLocataire` distinct.

## 28. Payments

Paiement reste l'échéance/état agrégé. Tout nouvel encaissement devra plus tard snapshotter le contexte applicable à sa date. Le mode courant ne doit pas reclassifier les paiements historiques.

## 29. Receipt

RentalPaymentReceipt reste la preuve granulaire avec idempotence, index unique partiel, paiements partiels et annulation contrôlée. Il devra être enrichi dans un sprint financier par source de collecte/custody et contexte de mode snapshoté, sans casser ses garanties.

## 30. Money Custody Boundary

`managementMode` répond « qui gère », pas « qui détient les fonds ». Une future primitive distincte devra qualifier au minimum `OWNER_COLLECTED`, `AGENCY_COLLECTED` ou `PLATFORM_COLLECTED`, avec bénéficiaire/compte de destination et date. Elle n'est pas créée ici.

## 31. Commission Boundary

Le taux futur est distinct de `managementFee`, porté/versionné par mandat, avec default métier 10 % seulement après décision d'implémentation. Le calcul s'applique aux fonds réellement encaissés relevant de l'agence et snapshotte taux/date ; OWNER_MANAGED est inéligible.

## 32. Penalty Boundary

La pénalité 3 % existante reste inchangée. Fréquence, grâce, bénéficiaire et interaction avec commission restent **NON CONFIRMÉS** hors de ce sprint.

## 33. Settlement Boundary

Aucun settlement n'est implémenté. OWNER_MANAGED avec collecte directe ne produit aucun payout agence. Un futur settlement AGENCY_MANAGED exige mode à T, custody agence, taux snapshoté, non-rétroactivité, idempotence et autorité financière.

## 34. Maintenance

OWNER_MANAGED donne l'autorité opérationnelle au propriétaire sur son bien. AGENCY_MANAGED la donne au staff mandaté ; le propriétaire conserve lecture/demande. Le module existant n'est pas réécrit.

## 35. Documents

Les documents restent canoniques et privés. Les futures catégories d'autorité sont owner-created, agency-created, tenant-visible, shared et financially immutable. Une transition ne supprime ni ne réattribue silencieusement un document.

## 36. Notifications

Événements futurs : `owner_management_activated`, `agency_management_activated`, `management_transferred_to_agency`, `management_returned_to_owner`. Ils cibleront owner, staff et éventuellement tenant selon relation ; aucun nouveau système n'est construit ici.

## 37. Legacy Data

Le schéma actuel n'a aucun `managementMode`; tous les documents persistés sont donc legacy à l'introduction du contrat. Le dépôt ne fournit pas un snapshot autoritatif des données de production. Aucun accès DB n'a été utilisé pour éviter d'inventer ou de confondre fixtures et réalité.

## 38. Legacy Classification Matrix

| Existing pattern | Count | Proposed classification | Confidence | Action |
|---|---:|---|---|---|
| `managementActivated:false` / fiche seule | NON CONFIRMÉ | Not managed; no mode until enrollment | Haute sur règle, inconnue sur volume | Exclure, ne pas backfiller |
| Activated + mandat vérifié + tenant + staff manager | NON CONFIRMÉ | Candidate deterministic AGENCY_MANAGED | Moyenne | Dry-run puis preuve du mandat |
| Activated + provenance owner self-service prouvée | NON CONFIRMÉ | Candidate deterministic OWNER_MANAGED | Faible : provenance canonique absente aujourd'hui | Revue/preuve externe |
| Activated + activeLease/currentTenant seulement | NON CONFIRMÉ | AMBIGUOUS | Haute | Fail closed + revue manuelle |
| `tenant:null` ou `manager:null` | NON CONFIRMÉ | AMBIGUOUS, pas OWNER par défaut | Haute | Revue manuelle |
| Owner absent/incohérent malgré schema required | NON CONFIRMÉ | INVALID | Haute | Réparation contrôlée avant classement |

Les counts de code/fixtures ne sont pas substitués aux counts réels. Le nombre total et le nombre ambigu restent **NON CONFIRMÉS**.

## 39. Migration Strategy

Prochain sprint : outil read-only par défaut, idempotent, avec dry-run, statistiques et preuves par document ; catégories deterministic agency/owner, ambiguous, invalid, excluded listing-only. Aucun write par défaut. Les ambigus passent en revue manuelle. Ensuite seulement, backfill explicite avec journal, reprise et vérification. Jusqu'alors : mode absent, Pro/commission/settlement refusés.

## 40. Concurrency

L'implémentation future utilisera un CAS atomique sur le même document : filtre `_id + expected managementMode/current effectiveAt`, `$set` du courant et `$push` de l'entrée historique. Une seule opération Mongo suffit pour mode+historique embedded ; pas de transaction inter-collection au foundation. Un échec CAS retourne 409. La propriété unique empêche deux RentalManagement courants pour un bien.

## 41. API Contract

Préférer des commandes explicites, par exemple `POST /:id/management-mode/transitions`, avec `to`, `reason` et état attendu, jamais `PATCH managementMode`. La réponse ajoute courant/effectiveAt/history selon audience sans casser les payloads existants. Les routes owner et staff restent séparées ; aucune route Admin ne devient Pro par réutilisation UI.

## 42. Security Matrix

| Actor | OWNER_MANAGED Read | OWNER_MANAGED Write | AGENCY_MANAGED Read | AGENCY_MANAGED Write | Change Mode |
|---|---:|---:|---:|---:|---:|
| Owner | Oui, own | Oui, own + entitlement | Oui, own selon contrat | Non ; demandes seulement | Demande ; activation owner initiale future |
| Tenant | Ses données seulement | Portail limité | Ses données seulement | Portail limité | Non |
| Staff | Si relation explicite | Non par défaut | Oui, tenant/capability | Oui, tenant/capability | Accepte transfert agence / retour selon mandat |
| Admin | Scope autorisé | Scope autorisé | Scope autorisé | Scope autorisé | Oui dans scope, audit obligatoire |
| PlatformOperator scoped | Scope explicite | Capability + scope | Scope explicite | Capability + scope | Capability + scope |
| PlatformOperator global | Oui si global actif | Capability explicite | Oui si global actif | Capability explicite | Capability explicite, audit |

## 43. Management Mode Matrix

| Concern | OWNER_MANAGED | AGENCY_MANAGED |
|---|---|---|
| Operational manager | Propriétaire/délégué owner | Agence selon mandat |
| Property owner | Inchangé | Inchangé |
| Rent collector | Non déductible du mode | Non déductible du mode |
| Agency commission | 0 / N/A | Éligible au futur 10 % sur encaissé agence |
| Settlement | Aucun en collecte owner directe | Futur si agence détient les fonds |
| Tenant access | Portail propre | Portail propre |
| Owner read access | Oui | Oui selon contrat |
| Owner write access | Opérationnel, own | Demandes/limité |
| Staff read access | Relation/support explicite | Tenant/capability |
| Staff write access | Non par défaut | Tenant/capability |
| Maintenance authority | Owner | Agence mandatée |
| Documents authority | Owner + règles visibilité | Agence + règles visibilité |
| Financial authority | Constater collecte autorisée | Encaissement agence autorisé |
| Pro entitlement | Requis pour capacités Pro | Non substitut au mandat agence |

## 44. Transition Matrix

| From | To | Allowed? | Authority | Effective date | History | Financial impact |
|---|---|---:|---|---|---|---|
| NONE | OWNER | Oui, après enrollment | Owner + entitlement/ownership | Immédiate | Première entrée | Aucun settlement agence |
| NONE | AGENCY | Oui, après mandat | Staff/Admin scoped + mandat | Immédiate | Première entrée | Éligibilité future, jamais rétroactive |
| OWNER | AGENCY | Oui | Demande owner + acceptation agence | Immédiate | Append | Nouveaux effets seulement |
| AGENCY | OWNER | Oui | Clôture mandat par autorité scoped | Immédiate | Append | Stop nouveaux effets agence |
| OWNER | OWNER | Non | N/A | N/A | Aucun append | 409, aucun effet |
| AGENCY | AGENCY | Non | N/A | N/A | Aucun append | 409, aucun effet |

## 45. Financial Invariants

- F1. Expected rent ≠ collected rent.
- F2. Tenant payment ≠ owner settlement.
- F3. Collected rent ≠ owner net.
- F4. Owner net ≠ amount already paid out.
- F5. `managementFee` ≠ recurring commission.
- F6. Commission 10 % uniquement AGENCY_MANAGED, selon futur contrat settlement.
- F7. OWNER_MANAGED direct collection n'a aucun settlement agence.
- F8. Abonnement Pro ≠ paiement de loyer.
- F9. Management mode ≠ money custody.
- F10. La finance historique n'est jamais recalculée après transition.

## 46. RED Evidence

N/A. Le seuil E « classification legacy suffisamment définie » est **NO**. Écrire des tests RED puis un champ aurait contourné la règle CHARACTERIZE FIRST. Aucun test nouveau n'a été créé.

## 47. Implementation

Aucune implémentation métier. Le contrat recommande exactement les primitives futures, sans ajouter champ, enum, index, service, route, modèle ou migration.

## 48. GREEN Evidence

Les tests existants ciblés sont verts : 9 suites, 85 tests. Ils caractérisent activation, onboarding, portail financier propriétaire, portail locataire, pénalités et maintenance. Ils ne prétendent pas prouver un managementMode absent.

## 49. Targeted Gates

Commande : `npm test -- --runInBand --runTestsByPath ...` sur neuf suites ciblées. Premier lancement sandbox : échec infrastructure `listen EPERM 0.0.0.0`. Relance autorisée hors sandbox : **9/9 suites, 85/85 tests verts**. Ce premier échec n'est pas une régression applicative.

## 50. Full Gates

Suite backend complète : non exécutée, car aucun code backend n'a été modifié. Suite Mongo ciblée/complète : non exécutée, car aucun modèle, index, transaction ou persistence n'a été modifié. Aucun résultat n'est inventé.

## 51. Architecture Gate

`npm run architecture:check` : PASS. 482 fichiers, 1 600 arêtes internes, 0 nouvelle violation, 0 cycle connu, 0 import statique non résolu. Dette connue inchangée : 2 service→controller, 1 controller→controller, 12 route→model sur 11 routes, 199 controller→model.

`npm run lint` : vert avec 0 erreur et 102 avertissements existants.

## 52. Regression Analysis

Aucun fichier fonctionnel n'a été touché par ce sprint. Les changements préexistants restent identiques. Aucun comportement de pénalité, paiement, portail, tenant, Admin ou PlatformOperator n'a été modifié. Régression nouvelle : aucune démontrée.

## 53. Readiness Scores

| Axe | Score | Justification |
|---|---:|---|
| Foundation readiness | 76/100 | Contrat complet, persistence absente et legacy bloquant |
| Security confidence | 84/100 | Matrice et fail-closed définis, enforcement futur |
| Financial-boundary confidence | 80/100 | Mode/custody/commission séparés, bénéficiaire pénalité ouvert |
| Legacy migration confidence | 25/100 | Politique sûre, volumes et cas réels non confirmés |
| Pro app foundation confidence | 68/100 | Direction stable, API/entitlement non implémentés |

## 54. Remaining P0/P1/P2

- P0 (1) : inventorier et classifier les RentalManagement legacy avant toute activation de mode.
- P1 (4) : implémenter mode/history/CAS ; owner-authority API ; entitlement backend minimal ; snapshot mode+custody des encaissements avant settlement.
- P2 (3) : transitions programmées ; correction administrative append-only avancée ; extraction de contrats clients partagés.

## 55. Settlement Restart Gate

**NO.** Le code ne peut pas encore déterminer le mode applicable ni sa date pour les données existantes, et Paiement/Receipt ne snapshotte pas la source/custody de collecte. Blockers : classification/backfill legacy certifiés, history effective-dated persistée, contexte de collecte snapshoté et autorité financière implémentée. Le contrat est prêt ; le système ne l'est pas.

## 56. Next Minimal Sprint

**ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-MIGRATION-1.** Objectif unique : inventaire réel read-only, règles de preuve, dry-run idempotent, revue des ambigus et plan de backfill non destructif. Ni app Pro ni settlement.

## 57. Mandatory Answers

1. Branch : `main`. 2. HEAD : `49f12d787b1011d16f9682cedefb81b377823e4d`. 3. Worktree initial : non vierge, changements certifiés préexistants. 4. Diff-check initial : vert. 5. Rapports lus : oui, quatre intégralement. 6. RentalManagement compris : oui. 7. Frontière Property/RentalManagement préservée : oui. 8. `managementFee` setup fee : confirmé. 9. Réinterprété : non. 10. `managementMode` nécessaire : oui. 11. Nom : `managementMode`. 12. Emplacement : futur champ de RentalManagement. 13. Enum : `OWNER_MANAGED`, `AGENCY_MANAGED`. 14. OWNER défini : oui. 15. AGENCY défini : oui. 16. Autres modes : non.

17. Historique nécessaire : oui. 18. Embedded ou séparé : embedded `managementModeHistory`. 19. Pourquoi : cohérence atomique, lecture locale, pas de modèle supplémentaire. 20. Date d'effet : oui. 21. Champ : `effectiveAt`. 22. Mode actuel dérivable : oui après persistence, sinon non pour legacy. 23. Mode à T : oui par dernière entrée effective. 24. NONE→OWNER : oui. 25. NONE→AGENCY : oui. 26. OWNER→AGENCY : oui. 27. AGENCY→OWNER : oui. 28. Self-transition : non. 29. Activation OWNER : owner prouvé + entitlement, ou autorité administrative scoped. 30. Activation AGENCY : staff/Admin scoped avec mandat. 31. OWNER→AGENCY : demande owner + acceptation agence autorisée. 32. AGENCY→OWNER : autorité scoped clôturant mandat, demande owner possible.

33. Owner read OWNER : oui, own. 34. Owner write OWNER : oui, own + entitlement. 35. Owner read AGENCY : oui selon contrat. 36. Owner write AGENCY : limité aux demandes. 37. Staff OWNER : pas d'écriture automatique. 38. Staff AGENCY : selon tenant/capabilities. 39. Admin préservé : oui dans scope. 40. PlatformOperator préservé : oui. 41. Isolation cross-tenant : préservée. 42. Owner transformé en PlatformTenant : non. 43. Role séparé entitlement : oui. 44. Proprietaire implique Pro : non. 45. Modèle entitlement maintenant : non, contract only. 46. Enforcement backend : défini. 47. Publication requise : non. 48. Property dupliqué : non. 49. RentalManagement dupliqué : non.

50. Contrat réutilisé : oui. 51. Locataire : oui. 52. Paiement : oui avec futur snapshot. 53. Receipt : oui avec futur snapshot. 54. Maintenance : oui. 55. Documents : oui. 56. Notification : oui. 57. Tenant portal : oui. 58. OWNER→AGENCY préserve historique : oui contractuellement. 59. AGENCY→OWNER : oui. 60. Commission historique : oui, sans recalcul. 61. Paiements historiques : oui. 62. 10 % sur OWNER : non. 63. 10 % limité AGENCY : oui contractuellement. 64. 3 % modifié : non. 65. Settlement implémenté : non. 66. Settlement OWNER direct : non. 67. Settlement AGENCY futur : oui si custody agence.

68. Mode suffit pour savoir qui encaisse : non. 69. Manque futur : source de collecte/custody, bénéficiaire et contexte snapshoté. 70. Mode ≠ custody : confirmé. 71. Subscription Pro séparée du loyer : oui. 72. Subscription implémentée : non. 73. Legacy RentalManagement : oui, par absence du champ dans le schéma courant. 74. Combien : NON CONFIRMÉ. 75. Classification déterministe : seulement pour patterns avec preuves complémentaires. 76. Ambigus : oui nécessairement possibles. 77. Combien : NON CONFIRMÉ. 78. Politique : dry-run + preuve + revue manuelle. 79. Fail closed : oui. 80. Migration nécessaire : oui avant activation générale. 81. Migration exécutée : non. 82. Nouveau modèle : non recommandé. 83. Pourquoi si oui : sans objet. 84. Nouvel index : différé jusqu'aux requêtes prouvées. 85. Concurrence : oui. 86. CAS/transaction : CAS mono-document suffisant au foundation.

87. Tests RED : non. 88. RED prouve quoi : N/A, seuil legacy bloqué. 89. GREEN : tests existants 85/85. 90. Real Mongo : non requis sans implémentation. 91. Targeted backend : 85/85. 92. Full backend : non exécuté, aucune modification backend. 93. Targeted Mongo : non exécuté. 94. Full Mongo : non exécuté. 95. Architecture checker : PASS. 96. Lint : 0 erreur, 102 warnings. 97. Diff-check final : vert. 98. Régression : aucune démontrée. 99. Échec préexistant : aucun gate applicatif final ; un EPERM sandbox initial. 100. Preuve : même commande verte hors sandbox. 101. Frontend modifié par ce sprint : non. 102. Mobile : non. 103. App Pro créée : non. 104. Second backend : non. 105. Sémantique PlatformTenant modifiée : non.

106. Settlement restart : NO. 107. Foundation readiness : 76/100. 108. Security : 84/100. 109. Financial boundary : 80/100. 110. Legacy migration : 25/100. 111. Pro app foundation : 68/100. 112. P0 restant : 1. 113. P1 : 4. 114. P2 : 3. 115. Next sprint : `ALTIMMO-PRO-LEGACY-MANAGEMENT-MODE-MIGRATION-1`. 116. Code modifié : non. 117. Fichiers modifiés par ce sprint : ce rapport uniquement. 118. Rapport créé : oui. 119. Commit : non. 120. Push : non. 121. Deploy : non. 122. Verdict : B.

## 58. Final Verdict

**B — FOUNDATION CONTRACT CERTIFIED, IMPLEMENTATION DEFERRED.**

Les deux modes, leur historique, leur date d'effet, leurs transitions et leurs autorités sont définis sans inventer de règle financière. RentalManagement est le bon agrégat et aucune duplication n'est requise. Toutefois, le nombre et la nature des dossiers legacy réels ne sont pas confirmés ; leur attribuer un mode par défaut violerait la non-rétroactivité et pourrait créer une autorité ou commission indue.

La prochaine étape obligatoire est donc la classification legacy certifiée. Jusqu'à son achèvement, management mode, entitlement, settlement et clients Pro restent non implémentés. Aucun commit, push ou déploiement n'a été effectué.
