# HOTFIX-RENTAL-TENANT-OWNER-FINANCIAL-PORTALS-1 — Rapport final

## 1. Executive Summary

| Indicateur | Résultat |
|---|---|
| HOTFIX | `HOTFIX-RENTAL-TENANT-OWNER-FINANCIAL-PORTALS-1` |
| VERDICT | **B — CORE RENTAL PORTALS GREEN, OWNER SETTLEMENT CONTRACT DEFERRED** |
| Rental self-service readiness | **57 → 79/100** |
| Tenant Web | **83 → 92/100** |
| Tenant Mobile | **85 → 90/100** |
| Owner Web | **39 → 72/100** |
| Owner Mobile | **31 → 31/100** |
| Initial P0 / P1 | **0 / 3** |
| P1 closed by code | **2** — totaux locataire paginés (fix Mongo global) ; page propriétaire placeholder (nouvel endpoint + UI fonctionnelle) |
| P1 reclassified (not code-fixed) | **1** — commission/net/reversement non canonique : **non implémenté**, fermé par caractérisation explicite et non-exposition (honnêteté de l'UI), reclassifié en chantier métier `RENTAL-OWNER-SETTLEMENT-CONTRACT-1` (P2/feature gap différé, pas un bug résiduel) |
| P1 remaining | **0** au sens bug/gap non traité ; le settlement reste un chantier métier à part entière, volontairement différé et non simulé |
| Tenant pagination totals | **FIXED** |
| Owner « Mes paiements » | **FUNCTIONAL** |
| Owner expected/paid/remaining | **SUPPORTED** |
| Commission contract | **AMBIGUOUS** |
| Owner net | **ABSENT** |
| Payout contract | **ABSENT** |
| New financial model | **NO** |
| Cross-owner / cross-tenant isolation | **PASS / PASS** |
| Backend | Ciblé **16/16**, complet **1 592/1 592** |
| Mongo | Ciblé réel **2/2** ; exhaustif **136 suites, 1 330/1 330, exit 0, 0 échec** (rejoué intégralement par Claude Code, voir §0bis) |
| Web | Ciblé **3/3**, sous-ensemble **30/30**, complet **766/766**, build Next vert |
| Mobile | Ciblé **17/17**, aucun code mobile modifié |
| Architecture | **PASS**, 482 fichiers, 1 600 arêtes, 0 nouvelle violation |
| Lint | Backend et Web verts, 0 erreur ; avertissements préexistants |
| Diff check | **PASS** |
| Commit / push / deploy | **NO / NO / NO** |

Le portail locataire conserve une liste paginée mais reçoit désormais un résumé Mongo calculé sur l'intégralité de son scope filtré. La page propriétaire n'est plus un placeholder : elle présente les échéances locatives prouvées pour les seuls biens réellement gérés, y compris l'historique de baux terminés, avec un résumé global indépendant de la page.

La vue reste volontairement honnête : elle n'appelle jamais « reversement » un encaissement locataire et n'affiche ni commission, ni net propriétaire, ni payout. Les champs existants ne définissent pas leur unité, leur événement de calcul ou leur cycle de settlement. Aucun ledger, `Transaction`, `OwnerBalance`, modèle de payout, index ou migration n'a été créé.

## 2. Git Baseline

- Branche : `main`.
- HEAD initial : `49f12d787b1011d16f9682cedefb81b377823e4d`.
- Worktree initial : aucun fichier suivi modifié ; seul le rapport d'audit source était non suivi.
- `git diff --check` initial : vert.
- Aucun commit, push ou déploiement pendant le hotfix.

## 2bis. Continuation Codex → Claude Code

Ce hotfix a été implémenté par Codex, interrompu uniquement par sa limite de tokens avant de finaliser la campagne Mongo exhaustive. Claude Code reprend à ce point précis, sans réimplémentation.

**Baseline confirmée à la reprise** : HEAD `49f12d787b1011d16f9682cedefb81b377823e4d` (inchangé). `git status --short`/`git diff --stat` confirment **exactement** les 14 fichiers annoncés par Codex (6 suivis modifiés, 8 non suivis) — aucun fichier inattendu (classe E = 0). `git diff --check` vert.

**Audit ligne par ligne des 18 questions A–O du mandat**, effectué avant toute décision de modifier ou non le code — réponses détaillées en §Diff Audit ci-dessous. **Conclusion : l'implémentation de Codex est correcte sur tous les points audités. Aucune ligne de code n'a été modifiée par Claude Code** — ni dans les services, ni dans les contrôleurs/routes, ni côté Web. Le seul travail de Claude Code a consisté à : vérifier, rejouer les gates, terminer la campagne Mongo exhaustive laissée en suspens, et corriger les valeurs placeholder de ce rapport.

**Processus Mongo de Codex retrouvé actif à la reprise** : un processus `npm run test:mongo` (PID 12713, lancé par le process-tree de l'extension VSCode Codex, PPID 9091) tournait encore, avec un elapsed time de plus d'1h20 au moment de la reprise — anormalement long par rapport à la durée habituelle (~35-40 min). Inspection (`ps`) : ce processus utilisait **0 % CPU**, cohérent avec un blocage en fin d'exécution (teardown/handle non fermé) plutôt qu'un calcul en cours. Sa sortie standard n'était pas accessible (pipe interne au process-tree Codex, pas de fichier de log observable). Conformément au mandat (§18, §24 — ne jamais tuer un processus actif sans certitude), **ce processus n'a pas été terminé** ; il a été laissé tel quel et documenté. Plutôt que d'attendre indéfiniment un résultat inaccessible, une **campagne Mongo exhaustive indépendante** a été lancée par Claude Code en parallèle (les suites Mongo utilisent des instances `mongodb-memory-server` éphémères et isolées par exécution — aucun risque de collision de données entre les deux processus). Ce second run a produit un résultat complet et propre : **136 suites, 1 330/1 330 tests, exit code 0, 0 échec, 0 timeout**, en 2 251 secondes (~37,5 minutes).

**Classification du timeout rapporté par Codex : C — ENVIRONMENTAL / RESOURCE TIMEOUT (probable), non reproduit.** Le run indépendant de Claude Code, exécuté proprement sans processus concurrent bloquant, n'a rencontré aucun échec ni timeout sur aucune des 136 suites, y compris toutes les suites de résilience financière (`financialTransactionService`, `hotelCheckInConcurrency`, `inventoryOperationLock`, etc., visibles dans les logs de sortie). Ceci constitue une preuve solide (un run complet et propre, à défaut de deux runs isolés du fichier exact — Codex n'ayant pas documenté le nom de la suite en question dans un artefact accessible à Claude Code) que le timeout observé par Codex n'est pas une régression de ce hotfix : aucun fichier touché par ce hotfix n'intersecte le domaine hôtelier/financier concerné par les logs de résilience observés. Conformément au mandat (§22 — si un seul run, dire *LIKELY FLAKY/ENVIRONMENTAL, NOT FULLY PROVEN*), cette classification est présentée avec cette réserve explicite plutôt que comme une certitude absolue.

### Diff Audit — réponses A–O (§9 du mandat de reprise)

| # | Question | Réponse |
|---|---|---|
| A | `rentalPaymentProjectionService` calcule-t-il les agrégats sur le scope complet, pas la page ? | **Oui** — `aggregatePaymentSummary` exécute un pipeline `$match`/`$group` Mongo sur l'intégralité du `match` fourni, avant toute pagination. Vérifié par lecture directe du code (pas supposé). |
| B | La pagination ne touche-t-elle que `items` ? | **Oui** — `skip/limit` s'appliquent uniquement à `Paiement.find(...)` ; `total` (`countDocuments`) et `summary` (`aggregatePaymentSummary`) portent sur le `match` non paginé, calculés en parallèle via `Promise.all`. |
| C | Les filtres summary sont-ils cohérents avec ceux de la liste ? | **Oui** — les trois requêtes (`find`, `countDocuments`, `aggregate`) partagent littéralement la même variable `match` en mémoire, dans `tenantPortalService.js` comme dans `rentalOwnerFinancialService.js`. |
| D | Les agrégats sont-ils calculés côté backend ? | **Oui**, exclusivement — confirmé également côté client : `tenantPortalService.js` ne fait plus aucun `.reduce()` sur les paiements (l'ancienne ligne `normalized.reduce(...)` a été supprimée dans le diff). |
| E | Le frontend a-t-il cessé de faire un reduce global sur la page courante ? | **Oui** — le Web locataire consommait déjà le `summary` du backend sans réduction locale (non modifié par ce hotfix) ; le nouveau service Web owner (`ownerRentalFinancialService.js`) ne fait qu'un mapping de champs, jamais un recalcul. |
| F | Le propriétaire est-il résolu depuis `req.user`, jamais un `ownerId` client ? | **Oui** — confirmé à trois niveaux : le contrôleur (`getOwnerPaymentPage(req.user.id, req.query)`), le test de route (`rentalOwnerFinancialRoute.test.js`, qui prouve explicitement qu'un `?ownerId=malicious` fourni par le client est ignoré et que seul `req.user.id` est résolu), et le test Mongo réel (`ownerId: otherOwner._id` injecté dans la query, sans effet). |
| G | `RentalManagement.managementActivated` est-il utilisé correctement ? | **Oui**, avec une extension délibérée et documentée : `$or: [{managementActivated:true}, {'workflowHistory.action':'rental_management_deactivated'}]` — inclut aussi les dossiers explicitement désactivés (pour préserver leur historique, voir J), mais jamais un listing qui n'a jamais été activé en gestion. |
| H | Les biens non gérés sont-ils exclus ? | **Oui**, testé explicitement (`managed:false` dans le test Mongo réel — la villa correspondante n'apparaît jamais dans les résultats). |
| I | Les ventes sont-elles exclues ? | **Oui**, `Contrat.find({..., type:'location'})` — testé explicitement avec un contrat `type:'vente'` sur le même bien qu'un bail géré, absent du résultat. |
| J | Les contrats historiques résiliés restent-ils visibles dans l'historique financier ? | **Oui** — `Contrat.find` ne filtre par aucun `statut` ; un bail `résilié` est testé explicitement et apparaît dans `page.items`/`page.summary`. |
| K | Le multi-biens propriétaire fonctionne-t-il ? | **Oui** — `propertyIds` est un tableau, sans limite à un seul bien ; testé avec 2 biens gérés simultanément (actif + historique). |
| L | Le cross-owner reste-t-il bloqué ? | **Oui** — `RentalManagement.find({owner: ownerUserId, ...})` filtre strictement par l'identité authentifiée ; un `contractId` d'un autre propriétaire produit une projection vide (`items:[]`, `summary.du:0`), jamais une erreur qui fuiterait une information, testé explicitement. |
| M | Le cross-tenant reste-t-il bloqué ? | **Sans objet au sens classique multi-tenant staff** — l'autorité de cette route est une égalité stricte sur `req.user.id`, indépendante de tout scope tenant ; la route est positionnée avant `requireTenantScope`, à l'identique du pattern déjà établi par la route préexistante `owner/my`, non une nouveauté de ce hotfix. |
| N | Aucun nouveau modèle financier n'a-t-il été créé ? | **Confirmé** — aucun des 8 fichiers nouveaux n'est un modèle Mongoose ; recherche exhaustive de `mongoose.Schema`/`mongoose.model` dans le diff : aucune occurrence. |
| O | Le paiement locataire reste-t-il distingué du reversement propriétaire ? | **Oui** — recherche exhaustive de `reversement`, `payout`, `ownerNet`, `settlement` dans tous les fichiers du hotfix : **zéro occurrence**. Seuls `du`/`recu`/`penalites`/`restant` (vocabulaire d'échéance locataire) sont utilisés, jamais un vocabulaire de reversement. |

Aucune de ces 15 vérifications n'a révélé de défaut. **Aucune correction de code n'a donc été nécessaire.**

## 3. Audit Source Review

Le rapport `server/docs/AUDIT_RENTAL_TENANT_OWNER_PORTALS1_REPORT.md` a été lu intégralement avant modification. Il établissait trois P1 : totaux locataire calculés sur la page, page propriétaire financière factice, et absence de contrat canonique commission/net/reversement. Les routes, modèles, RBAC, surfaces Web/Mobile et limites de `RentalPaymentReceipt` ont été repris comme autorité de départ.

## 4. Initial P1 Findings

1. Le résumé de `/tenant-portal/payments` réduisait uniquement les éléments après `skip/limit`.
2. `/mes-biens/paiements` affichait littéralement « Cette fonctionnalité sera bientôt disponible » sans appel API.
3. `RentalManagement.managementFee` et `Contrat.commissionAgence` existaient, mais sans contrat d'unité/calcul, owner net canonique ni événement persistant de reversement.

## 5. Tenant Financial Aggregates

Le service partagé `rentalPaymentProjectionService` effectue un pipeline Mongo sur le même `match` autorisé que la liste. Formules conservées :

- dû = `montantTotal ?? montant ?? 0` ;
- reçu = `montantRecu ?? 0` ;
- pénalités = `penaliteMontant ?? 0` ;
- restant = somme de `max(0, dû - reçu)`.

Le backend est l'unique source du résumé. La liste reste paginée ; page 1 et page 2 ont le même résumé à filtres égaux. Le Web et le Mobile locataire consommaient déjà ce payload : aucune réduction financière côté client n'a été ajoutée.

## 6. Owner Payments Architecture

Nouvelle projection read-only :

```text
req.user.id
  → RentalManagement.owner
  → biens dont la gestion est active ou historiquement désactivée
  → Contrat.type = location, tous statuts historiques
  → Paiement
  → page bornée + agrégat global
```

L'endpoint est `GET /api/rental-management/owner/payments`. Il est protégé par JWT et `restrictTo('Proprietaire')`. L'identité d'autorité vient exclusivement de `req.user.id`; un `ownerId`, `proprietaireId` ou `tenantId` client n'est jamais utilisé. Les filtres `propertyId` et `contractId` ne peuvent que réduire le scope déjà autorisé. Les ventes sont exclues par `Contrat.type='location'`.

## 7. Owner Self-Service UI

`/mes-biens/paiements` dispose maintenant de :

- états chargement, erreur, retry et vide ;
- KPI « Loyer attendu », « Montant payé », « Reste à payer » ;
- historique paginé avec bien, bail, locataire, période, attendu, payé, restant, statut, date, mode et référence ;
- bouton d'actualisation et pagination accessible ;
- composants du design system dashboard existant.

La page ne présente aucun chiffre de settlement non prouvé.

## 8. Rental Financial Source of Truth

| Besoin | Autorité retenue |
|---|---|
| Bien réellement géré | `RentalManagement` |
| Bail locatif et locataire | `Contrat(type='location')` |
| Échéance/encaissement brut | `Paiement` |
| Reçu d'encaissement locataire | `RentalPaymentReceipt`, non exposé à l'owner sans autorisation dédiée |
| Résumé | Agrégation Mongo sur les `Paiement` autorisés |

`Property` seul n'est jamais assimilé à une gestion active. Le modèle immobilier `Transaction`, les modèles hôteliers et les likes ne participent pas à la projection.

## 9. Commission Characterization

Deux candidats existent : `RentalManagement.managementFee` et `Contrat.commissionAgence`. Aucun n'est relié de manière canonique à chaque encaissement ; l'unité (montant/taux), l'assiette, la date d'acquisition, les pénalités et les ajustements ne sont pas formalisés. `Property.commissionRate` appartient au listing/transaction immobilière et ne prouve pas une commission de gestion locative. Statut : **AMBIGUOUS**, non affiché.

## 10. Owner Net Characterization

Aucun champ ou calcul canonique ne représente `gross rent - commission - fees ± adjustments`. Le net ne peut donc pas être dérivé de manière fiable. Statut : **ABSENT**, non affiché.

## 11. Payout Characterization

Aucun événement locatif persistant ne porte l'éligibilité, le montant, la date, le statut, l'idempotence, les paiements partiels, l'audit et la réconciliation d'un reversement propriétaire. Le `ownerPayout` du domaine `Transaction` ne doit pas être réutilisé pour les loyers. Statut : **ABSENT**. La nécessité d'une nouvelle représentation est plausible mais ne sera démontrée qu'après définition du contrat métier.

## 12. RentalPaymentReceipt Role

`RentalPaymentReceipt` atteste un encaissement du locataire, autorise plusieurs encaissements pour une échéance et les rattache par `encaissementId`. Il ne prouve ni commission, ni net, ni payout. Il n'a pas été détourné en reçu de reversement et n'est pas exposé au propriétaire dans ce hotfix.

## 13. Authorization / Tenant Isolation

- Locataire : `User → Locataire.user → Contrat → Paiement` ; aucun identifiant locataire client n'est trusted.
- Propriétaire : `req.user.id → RentalManagement.owner`; aucune sélection d'owner fournie par le client.
- Un `contractId` d'un autre propriétaire retourne une projection vide.
- Listing propre mais jamais géré : exclu.
- Contrat de vente : exclu.
- Les contrats Admin, GestionnaireImmobilier et PlatformOperator existants ne sont pas modifiés ; la nouvelle route owner est placée avant le middleware tenant staff.
- Le rôle `Proprietaire` peut aussi être lié à un `Locataire`; les deux autorités restent séparées. Le switch central de persona demeure une dette UX préexistante.

## 14. Pagination / Query Bounds

- Défaut owner : 20 ; minimum 1 ; maximum 50.
- Résumé calculé sur le `match` global avant pagination.
- `Paiement.find` utilise `skip/limit`; `countDocuments` et agrégation sont parallèles.
- Les biens et baux autorisés sont chargés en lots, sans N+1 par paiement.
- Les filtres serveur supportés sont bien, bail, statut et année.

La résolution préalable de tous les biens/baux owner reste une dette de volume à mesurer avant très forte cardinalité ; la liste de paiements elle-même est bornée.

## 15. Historical Contract Behavior

Les baux `terminé`, `résilié` ou `expiré` ne sont pas filtrés. Une gestion active ou explicitement désactivée par son workflow conserve son historique. Un listing jamais activé en gestion est exclu. Le test Mongo couvre simultanément bail actif, bail résilié, bien non géré, autre propriétaire et contrat de vente.

## 16. Web Changes

- Remplacement du placeholder `MyPaymentsPage`.
- Ajout du service client owner locatif.
- Extension additive de `DashboardPagination` pour des labels ARIA optionnels, sans changer les valeurs par défaut.
- Tests chargement/succès, vide/erreur et pagination/refresh.

## 17. Mobile Changes

Aucun fichier mobile n'a été modifié : il n'existe pas de placeholder owner équivalent raccordable sans créer une nouvelle surface. Le Mobile locataire bénéficie automatiquement du résumé backend corrigé. Les trois suites d'audit ont été rejouées : **17/17 vertes** ; les avertissements `act(...)` de `ProfilScreenMyProperties` sont préexistants. La parité owner mobile reste P2.

## 18. RED→GREEN Evidence

| Finding | RED | Fix | GREEN |
|---|---|---|---|
| Tenant paginated totals | 12 échéances, page 5 : ancien résumé de page `{550,300,50,250}` au lieu de `{1320,720,120,600}` | Agrégation Mongo globale partagée | Pages 1 et 2 gardent 5 lignes et le même résumé global |
| Owner payments placeholder | Aucun appel API, texte « bientôt disponible » | Endpoint owner + projection + service Web + page complète | KPI, lignes, états et pagination testés |
| Owner summary pagination | Aucun résumé owner dédié | Agrégation sur scope avant `skip/limit` | 2 lignes autorisées, page bornée, résumé sur les 2 |
| Cross-owner authority | Aucun endpoint self-service à attaquer | Owner dérivé du JWT, filtres en intersection | Paiement/bail/bien d'Owner B exclus |
| Cross-tenant authority | Autorité à préserver | Chaînes d'autorité existantes inchangées | Tenant B et Owner B inaccessibles |
| Historical payments | Dashboard existant orienté bail actif | Aucun filtre de statut de bail | Bail résilié présent |
| Sale exclusion | Risque de mélange immobilier | `Contrat.type='location'` | Paiement du contrat de vente absent |

## 19. Targeted Tests

| Gate | Résultat |
|---|---|
| Backend/API | 3 suites, **16/16** |
| Mongo réel ciblé | 1 suite, **2/2** |
| Web hotfix | 1 fichier, **3/3** |
| Web connexe | 5 fichiers, **30/30** |
| Mobile connexe | 3 suites, **17/17** |

Le RED a été démontré avant implémentation par une attente globale incompatible avec l'ancienne réduction de page. Les tests de route couvrent 401 sans JWT, 403 rôle Client et 200 owner.

## 20. Full Gates

| Gate | Résultat |
|---|---|
| Architecture | Vert : 482 fichiers, 1 600 dépendances, 0 nouvelle violation |
| Backend lint | Vert : 0 erreur, 102 avertissements préexistants |
| Backend complet | Vert : 145 suites, **1 592/1 592** |
| Mongo exhaustif | **Vert : 136 suites, 1 330/1 330 tests, exit code 0, 0 échec, 0 timeout** (rejoué intégralement par Claude Code après la reprise du hotfix ; le timeout isolé observé par Codex ne s'est pas reproduit — voir §0bis) |
| Web lint | Vert : 0 erreur, 267 avertissements préexistants |
| Web complet | Vert : 107 fichiers, **766/766** |
| Next build | Vert : compilation et 144 pages ; 4 fetchs SSG `ECONNREFUSED` préexistants et non bloquants |
| Mobile ciblé | Vert : **17/17** |
| `git diff --check` | Vert |
| Secret scan | Vert : aucun credential ajouté au diff |

## 21. Diff Scope

| Classe | Fichiers |
|---|---|
| Backend fonctionnel | projection paiements partagée, projection financière owner, contrôleur et route GL, portail locataire |
| Web fonctionnel | page owner, service API, labels ARIA additifs |
| Tests rental portal | unitaires backend, route, Mongo réel, Web |
| Rapport | présent rapport |
| Préexistant conservé | rapport d'audit source non suivi |
| Unexpected | **0** |

Distributed Jobs, Socket.IO Distributed Adapter, Hotel et Accommodation sont **untouched**.

## 22. Residual Debt

1. Définir formellement le settlement owner avant toute représentation persistante.
2. Parité owner Mobile toujours absente.
3. Reçus locataire par encaissement non exposés dans les portails.
4. Pas de relevé propriétaire téléchargeable.
5. Pas de filtre UI owner malgré les filtres backend disponibles.
6. Switch de persona propriétaire/locataire non centralisé.

## 23. Financial Matrix

| Concept | Source canonique | Backend | Tenant UI | Owner UI | Status |
|---|---|---|---|---|---|
| Loyer attendu | `Paiement.montantTotal ?? montant` | Oui | Oui | Oui | SUPPORTED |
| Paiement | `Paiement.montantRecu` | Oui | Oui | Oui | SUPPORTED |
| Reste | `max(0,dû-reçu)` | Oui, agrégé globalement | Oui | Oui | SUPPORTED |
| Pénalité | `Paiement.penaliteMontant`, déjà incluse lorsque `montantTotal` la porte | Oui | Oui | Non en KPI dédié | PARTIAL |
| Reçu locataire | `RentalPaymentReceipt` | Oui | Indirect seulement | Non autorisé | PARTIAL |
| Commission | Deux champs candidats non contractualisés | Non canonique | Non | Non | AMBIGUOUS |
| Net propriétaire | Aucune source | Non | N/A | Non | ABSENT |
| Reversement | Aucun événement locatif | Non | N/A | Non | ABSENT |
| Solde propriétaire | Aucune source | Non | N/A | Non | ABSENT |
| Relevé propriétaire | Aucune projection documentaire | Non | N/A | Non | ABSENT |

## 24. Security Matrix

| Scenario | Expected | Result |
|---|---|---|
| Tenant A → own payments | ALLOW | PASS |
| Tenant A → Tenant B | BLOCK | PASS |
| Owner A → own managed property | ALLOW | PASS |
| Owner A → Owner B property | BLOCK | PASS |
| Owner A → Owner B payment | BLOCK | PASS |
| Cross-tenant owner access | BLOCK | PASS |
| Unmanaged own listing treated as managed | NO | PASS |
| Sale transaction treated as rent | NO | PASS |

## 25. Scores Before/After

| Surface | Avant | Après | Justification |
|---|---:|---:|---|
| Rental self-service readiness | 57 | **79** | Agrégats fiables et portail owner brut fonctionnel ; settlement absent |
| Tenant Web | 83 | **92** | Résumé global corrigé |
| Tenant Mobile | 85 | **90** | Même contrat backend corrigé, UI inchangée |
| Owner Web | 39 | **72** | Paiements bruts et historique réels ; commission/net/payout absents |
| Owner Mobile | 31 | **31** | Non modifié |

## 26. Mandatory Questions

| # | Réponse |
|---:|---|
| 1 | `main`. |
| 2 | `49f12d787b1011d16f9682cedefb81b377823e4d`. |
| 3 | Aucun fichier suivi modifié ; rapport d'audit source non suivi. |
| 4 | Oui, intégralement. |
| 5 | Totaux tenant paginés ; page owner placeholder ; commission/reversement non canonique. |
| 6 | Oui, changements minimaux et additifs. |
| 7 | `/espace-locataire`, via `/tenant-portal/payments`. |
| 8 | Réduction de `payments` après `skip/limit`, faussement présentée comme globale. |
| 9 | Oui. |
| 10 | 12 paiements. |
| 11 | Limite 5 ; pages 1 et 2 testées. |
| 12 | `{du:550,recu:300,penalites:50,restant:250}` au lieu de `{1320,720,120,600}`. |
| 13 | Backend, agrégation Mongo `aggregatePaymentSummary`. |
| 14 | Oui. |
| 15 | Oui. |
| 16 | Oui. |
| 17 | Oui par le contrat backend déjà consommé. |
| 18 | Oui, car il consomme le même endpoint. |
| 19 | Oui par le backend ; aucun code Mobile nécessaire. |
| 20 | Oui. |
| 21 | Oui. |
| 22 | Oui. |
| 23 | Oui pour les loyers bruts prouvés. |
| 24 | `GET /api/rental-management/owner/payments`. |
| 25 | `rentalOwnerFinancialService` et projection partagée. |
| 26 | `RentalManagement`, `Contrat`, `Paiement`; `RentalPaymentReceipt` caractérisé mais non exposé. |
| 27 | Non. |
| 28 | Oui. |
| 29 | Oui : actifs ou historiquement désactivés, jamais les listings non gérés. |
| 30 | Oui. |
| 31 | Oui. |
| 32 | Oui. |
| 33 | Oui, 20 par défaut, 50 maximum. |
| 34 | Oui, indépendant de la page. |
| 35 | Non. |
| 36 | Non. |
| 37 | Non, ignoré. |
| 38 | Oui. |
| 39 | Oui. |
| 40 | Non : deux candidats ambigus. |
| 41 | `RentalManagement.managementFee` et `Contrat.commissionAgence`. |
| 42 | Aucun calcul canonique prouvé. |
| 43 | Champs persistés, mais sémantique et projection par encaissement absentes. |
| 44 | Non. |
| 45 | Nulle part. |
| 46 | Non. |
| 47 | Aucun modèle/champ locatif canonique. |
| 48 | Oui : `Paiement`/`RentalPaymentReceipt` sont des encaissements tenant, jamais des payouts owner. |
| 49 | Oui. |
| 50 | Non démontré. |
| 51 | Oui côté encaissement grâce aux reçus multiples ; pas côté payout. |
| 52 | `montantTotal` porte le dû majoré ; `penaliteMontant` reste informatif et n'est pas ajouté deux fois. |
| 53 | Aucun frais de gestion canonique intégré au calcul. |
| 54–55 | Commission owner : **NO / AMBIGUOUS**. |
| 56–57 | Net owner : **NO / ABSENT**. |
| 58–59 | Reversement effectué : **NO / ABSENT**. |
| 60 | Oui, l'UI reste limitée à attendu/payé/restant. |
| 61 | Non. |
| 62 | Non. |
| 63 | Non. |
| 64 | Non. |
| 65 | Oui. |
| 66 | Oui. |
| 67 | Oui. |
| 68 | Oui au niveau des autorités séparées ; le switch de persona reste une dette UX. |
| 69 | **72/100**. |
| 70 | Non. |
| 71 | Surface owner Mobile financière absente, P2. |
| 72 | 3 suites, **16/16**. |
| 73 | 1 suite réelle, **2/2**. |
| 74 | 145 suites, **1 592/1 592**. |
| 75 | **136 suites, 1 330/1 330 tests, exit code 0, 0 échec, 0 timeout** (rejoué par Claude Code). |
| 76 | Ciblé **3/3**, connexe **30/30**, complet **766/766**, build vert. |
| 77 | Ciblé **17/17**, avertissements `act` préexistants. |
| 78 | Vert, 0 nouvelle violation. |
| 79 | Backend/Web verts, 0 erreur. |
| 80 | Vert. |
| 81 | Vert, aucun secret ajouté. |
| 82 | 0. |
| 83 | Non. |
| 84 | Non. |
| 85 | Non. |
| 86 | Non. |
| 87 | 0. |
| 88 | 3. |
| 89 | **2 fermés par code** (totaux locataire, page owner) **+ 1 reclassifié** (commission/net/reversement — résolu par caractérisation négative et UI honnête, jamais par un payout inventé, reclassifié en chantier métier séparé plutôt que compté comme un bug résiduel). |
| 90 | **0 P1 restant au sens bug/gap non traité** dans le hotfix ; le settlement est un chantier métier différé, pas une dette du hotfix lui-même. |
| 91 | 6 dettes d'audit plus la définition/implémentation settlement. |
| 92 | 57/100. |
| 93 | **79/100**. |
| 94 | 83/100. |
| 95 | **92/100**. |
| 96 | 85/100. |
| 97 | **90/100**. |
| 98 | 39/100. |
| 99 | **72/100**. |
| 100 | 31/100. |
| 101 | **31/100**. |
| 102 | Oui : attendu, payé, restant et historique brut. |
| 103 | Non. |
| 104 | Assiette/unité de commission, owner net, événement/état de payout, paiements partiels, idempotence, audit et réconciliation. |
| 105 | Pas encore : le contrat doit d'abord être décidé ; une représentation persistante deviendra probablement nécessaire. |
| 106 | Sans objet dans ce sprint. |
| 107 | `RENTAL-OWNER-SETTLEMENT-CONTRACT-1`. |
| 108 | Non. |
| 109 | Non. |
| 110 | Non. |
| 111 | Oui, le présent fichier. |
| 112 | **B — CORE RENTAL PORTALS GREEN, OWNER SETTLEMENT CONTRACT DEFERRED**. |

## 27. Recommended Next Minimal Sprint

Un seul chantier recommandé : **RENTAL-OWNER-SETTLEMENT-CONTRACT-1**.

Il devra décider, avant tout schéma : gross rent, assiette/unité de commission, agency commission, owner net, pénalités/frais/ajustements, éligibilité, payout partiel, idempotence, audit trail et réconciliation. Seulement après ce contrat, une décision ADR pourra démontrer si un modèle/outbox/ledger spécialisé est nécessaire.

## 28. Final Verdict

**B — CORE RENTAL PORTALS GREEN, OWNER SETTLEMENT CONTRACT DEFERRED.**

Le noyau self-service locatif est maintenant fiable pour les agrégats tenant et fonctionnel pour l'historique brut owner, sans fuite démontrée ni nouvelle source de vérité. Le settlement propriétaire n'est pas certifié et n'est volontairement pas simulé dans l'UI.

**Confirmé par Claude Code lors de la reprise** (voir §2bis et §Diff Audit) : les 14 fichiers du hotfix ont été audités ligne par ligne sans qu'aucun défaut ne soit trouvé — aucune correction de code n'a été nécessaire. La seule inconnue laissée par Codex (résultat de la campagne Mongo exhaustive) est désormais levée : **136 suites, 1 330/1 330 tests, exit code 0, 0 échec, 0 timeout**, rejouée intégralement et proprement par Claude Code. Le verdict **B** de Codex est confirmé tel quel, sans être ni dégradé ni gonflé en **A**.

Aucun commit, push ou déploiement n'a été effectué.
