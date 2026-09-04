# RENTAL-OWNER-SETTLEMENT-CONTRACT-1 — Rapport

## 1. Executive Summary

**SPRINT :** `RENTAL-OWNER-SETTLEMENT-CONTRACT-1`

**VERDICT : E — BUSINESS DECISION REQUIRED, NO SETTLEMENT CODE IMPLEMENTED.**

| | |
|---|---|
| OWNER SETTLEMENT READINESS | **22/100** |
| PREVIOUS RENTAL SELF-SERVICE | CERTIFIED B (inchangé, non retouché) |
| FINANCIAL CONTRACT | **AMBIGUOUS** — plus précisément : **ABSENT** pour commission/net/payout, pas seulement ambigu |
| GROSS RENT | **SUPPORTED** (`Paiement.montantTotal`/`montant`, déjà certifié) |
| COMMISSION | **ABSENT** — aucun mécanisme n'applique jamais un taux/montant à un encaissement locatif |
| COMMISSION BASE | **NON CONFIRMÉ** — sans objet tant qu'aucune commission n'est calculée |
| OWNER NET | **ABSENT** |
| SETTLEMENT ELIGIBILITY | **AMBIGUOUS** — aucune règle métier ne définit ce moment |
| PAYOUT | **ABSENT** |
| PARTIAL PAYOUT | **NON CONFIRMÉ** |
| IDEMPOTENCE | **NOT IMPLEMENTED** (pour le payout — existe déjà, réel et testé, côté encaissement locataire via `RentalPaymentReceipt.idempotencyKey`) |
| CONCURRENCY | **NOT IMPLEMENTED** (pour le payout — existe déjà côté encaissement via `runFinancialOperation` + CAS Mongo) |
| RECONCILIATION | **ABSENT** |
| NEW MODEL | **NO** — aucun modèle créé dans ce sprint |
| IF YES | Sans objet |
| CROSS-OWNER | **PASS** (hérité, non retouché — vérifié non régressé) |
| CROSS-TENANT | **PASS** (hérité, non retouché — vérifié non régressé) |
| TARGETED TESTS | Sans objet — aucun code ajouté |
| FULL BACKEND | Non relancé (aucune modification) — dernière certification connue : 145 suites, 1592/1592 |
| FULL MONGO | Non relancé (aucune modification) — dernière certification connue : 136 suites, 1330/1330 |
| WEB | Non modifié |
| MOBILE | Non modifié |
| ARCHITECTURE | Non modifié |
| LINT | Non modifié |
| DIFF CHECK | **PASS** (vide) |
| COMMIT | NO |
| PUSH | NO |
| DEPLOY | NO |

Ce sprint a suivi strictement la règle absolue du mandat : **caractériser avant de coder**. La caractérisation démontre, par lecture directe du code (jamais par supposition), que le domaine locatif ne contient **aucune représentation de commission, de net propriétaire ou de reversement** — ni ambiguë, ni partielle : **absente**. Le seul champ qui aurait pu jouer ce rôle (`RentalManagement.managementFee`) est un frais d'agence fixe, ponctuel, Admin-only, jamais appliqué à un encaissement. Le seul autre champ candidat (`Contrat.commissionAgence`) appartient explicitement au domaine de la **vente**, jamais lu par aucun code, et ne doit pas être confondu avec la location.

Plusieurs questions bloquantes du mandat (§38) restent **NON CONFIRMÉ** de façon qui empêcherait tout calcul sûr : taux de commission applicable, base commissionnable, répartition des pénalités, définition de l'éligibilité au reversement. Conformément à la règle absolue (« NE PAS INVENTER »), **aucune ligne de code n'a été ajoutée**. Ce rapport documente précisément les décisions métier requises avant qu'un futur sprint d'implémentation puisse démarrer.

## 2. Git Baseline

- Branche : `main`.
- HEAD : `49f12d787b1011d16f9682cedefb81b377823e4d` — inchangé du début à la fin de ce sprint.
- Worktree initial : identique à l'état laissé par `HOTFIX-RENTAL-TENANT-OWNER-FINANCIAL-PORTALS-1` (6 fichiers suivis modifiés, 8 fichiers nouveaux, 2 rapports non suivis) — **intégralement préservé**, aucun `git reset/clean/restore/stash` exécuté.
- `git diff --check` : vert, inchangé.
- **Aucune modification de code effectuée dans ce sprint** — seul ce rapport a été créé.

## 3. Previous Certified State

Repris intégralement des deux rapports obligatoires, sans les rouvrir :

- Portail locataire Web/Mobile fonctionnel, agrégats globaux corrigés (indépendants de la pagination).
- Portail propriétaire `/mes-biens/paiements` fonctionnel : attendu/payé/restant/historique, multi-biens, historique des baux résiliés préservé, biens non gérés exclus, ventes exclues.
- Autorité propriétaire dérivée exclusivement de `req.user.id`. Cross-owner et cross-tenant bloqués, testés.
- Aucun nouveau modèle financier créé par ce hotfix.
- Gap explicitement laissé ouvert : commission ambiguë (`managementFee` vs `commissionAgence`), net propriétaire absent, reversement absent — exactement l'objet de ce sprint.

## 4. Financial Domain Inventory

Recherche exhaustive (`commission`, `commissionRate`, `agencyCommission`, `agencyFee`, `managementFee`, `managementFeeRate`, `fees`, `honoraires`, `ownerShare`, `ownerAmount`, `ownerNet`, `netAmount`, `payout`, `reversement`, `settlement`, `paidToOwner`, `ownerPaid`, `payoutStatus`, `payoutDate`, `balance`, `ledger`, `allocation`, `receipt`, `reconciliation`) sur tout `server/`, `client/`, `altimmo-app/` :

| Domain | Model | Field | Semantics | Source of truth | Reusable for rental settlement? |
|---|---|---|---|---|---|
| Location (gestion locative) | `RentalManagement` | `managementFee` | Frais d'agence **fixe, ponctuel**, Admin-only, jamais appliqué à un encaissement (confirmé par commentaire de code explicite : « même nature que `agencyCommission` côté Vente ») | Champ persisté, non calculé | **NO** — pas une commission de gestion locative, pas de rattachement à `Paiement` |
| Vente (transaction immobilière) | `Contrat` (bloc vente) | `commissionAgence` | Champ regroupé avec `prixVente`/`notaire`/`dateSignatureActe` — domaine vente. **Jamais lu par aucun code** (recherche exhaustive : zéro consommateur) | Champ persisté, write-only | **NO** — hors domaine location, dead field |
| Vente (transaction immobilière) | `Transaction` | `commission: {taux, total, ownerPayout, agencyNet}` | Commission de VENTE réelle, avec taux, total calculé, `ownerPayout`/`agencyNet` — un vrai modèle de répartition existe, mais exclusivement pour les transactions de vente (`transactionController.js`) | Calculé (`ownerPayout = hasSpecial ? total*0.30 : 0`) | **NO** — domaine vente, structure intéressante comme *précédent architectural*, jamais comme source de données |
| Location (encaissement) | `Paiement` | `montantTotal`, `montantRecu`, `penaliteMontant` | Échéance agrégée : dû, reçu, pénalité — canonique pour le loyer | Persisté, mis à jour atomiquement (`runFinancialOperation` + CAS Mongo) | **YES** — déjà la source canonique du brut encaissé |
| Location (encaissement granulaire) | `RentalPaymentReceipt` | `montant`, `idempotencyKey`, `statut` (`confirmed`/`cancelled`), `encaissementId` | Preuve d'encaissement **locataire**, jamais un reversement — explicitement documenté comme tel dans le code (« N'est PAS un domaine du Financial Core ») | Persisté, idempotence réelle testée | **PARTIEL** — precedent d'idempotence/traçabilité réutilisable en pattern, mais ne peut pas représenter un payout (direction de flux d'argent opposée) |
| Financial Core (hôtel/hébergement) | `FinancialPayment`, `PaymentAllocation` | Paiement/allocation multi-domaines | Domaine hôtelier/hébergement, explicitement séparé par les auteurs du code | Persisté, ledger append-only | **NO** — collision de domaine explicitement évitée par le code lui-même |
| Financial Core (infra transversale) | `services/finance/financialTransactionService.js` | `runFinancialOperation` | **Utilitaire** de transaction Mongo avec repli non-transactionnel — pas un modèle de données, déjà réutilisé par `paiementController.js` pour l'encaissement locataire | Infrastructure, pas un domaine métier | **YES, comme infrastructure uniquement** — jamais comme source de données financières |
| Reversement/payout/solde/relevé propriétaire (tout domaine confondu) | — | — | **Zéro occurrence** trouvée nulle part dans le code, hors du domaine vente (`Transaction.ownerPayout`) | — | **N/A — n'existe pas** |

## 5. RentalManagement Analysis

`managementFee: { type: Number, min: 0 }` (`models/RentalManagement.js`). Aucun taux (pas de `Rate`/`Percent` dans le nom, pas de `max: 100`). Commentaire explicite dans `controllers/rentalPropertyController.js:44` : *« `managementFee` est le frais de GESTION interne qu'Altitude Vision facture au propriétaire (terme commercial agence↔propriétaire), jamais une caractéristique de l'offre locative elle-même — même nature que `agencyCommission` côté Vente, seul champ RentalManagement classé Admin-only »*. Aucune date d'application, aucun versioning, aucun snapshot. Aucun code ne multiplie ce champ par quoi que ce soit. Modifiable via `PUT /rental-management/:id` (`controllers/rentalManagementController.js:289,317`), sans effet rétroactif ni prospectif sur aucun `Paiement`.

**Conclusion : `managementFee` n'est pas un mécanisme de commission de gestion locative récurrente — c'est un frais administratif ponctuel, découplé de tout encaissement.**

## 6. Contrat Analysis

`Contrat` porte `montantLoyer` (loyer contractuel de référence), `cautionMultiplicateur` (au niveau `RentalManagement` pour les fiches Sprint A, historiquement aussi sur `Property`), et `commissionAgence` — mais ce dernier champ est physiquement regroupé dans le bloc **vente** du schéma (`prixVente`, `dateSignatureCompromis`, `dateSignatureActe`, `notaire`), jamais dans une section location. Confirmé dead-field : aucun contrôleur ni service ne le lit. `Contrat` ne porte aucun champ de commission de gestion locative.

Le loyer contractuel (`montantLoyer`) reste distinct de l'argent effectivement encaissé (`Paiement.montantRecu`) — cette distinction est déjà respectée par le code existant (jamais confondue).

## 7. Paiement Analysis

Modèle central de l'échéance locative. Champs pertinents : `montant`, `montantTotal` (dû, pénalité incluse), `montantRecu` (reçu cumulé), `penaliteMontant`, `statut` (`payé`/`en_retard`/`impayé`/`partiel` — **aucun statut d'annulation/remboursement**), `jourEcheance`, `retardJours`.

**Encaissement = quand ?** `statut ∈ {'payé', 'partiel'}` avec `montantRecu > 0` signifie un encaissement réel. `'impayé'`/`'en_retard'` signifient zéro argent reçu.

**Paiements partiels** : supportés, réels, avec invariant déjà appliqué en code (`controllers/paiementController.js::marquerPaye`) : `montantRecu` ne peut jamais diminuer (`if (montantAvant > 0 && recu < montantAvant) return 422`).

**Surpaiement** : **explicitement rejeté**, pas masqué. `if (recu > totalDu) return 422 'Le montant reçu dépasse le montant dû.'` — le contrat actuel est **UNSUPPORTED**, une tentative de surpaiement échoue avec une erreur claire, jamais une anomalie silencieuse.

**Écriture atomique** : `marquerPaye` utilise `runFinancialOperation({operationName:'rental.payment.record', transactionMode:'auto'})` — une vraie transaction Mongo (avec repli documenté si les transactions ne sont pas supportées), combinée à un `findOneAndUpdate` en compare-and-set sur `{statut, montantRecu}` précédents. C'est un pattern solide et déjà prouvé — directement réutilisable comme **précédent d'infrastructure** pour un futur payout, jamais comme source de données.

**Annulation d'un paiement** : `Paiement` lui-même ne porte aucun statut d'annulation. Un `Paiement` non encore réglé peut être supprimé (`controllers/paiementController.js:189`, uniquement si `statut ∈ {'impayé','en_retard'}` et `montantRecu` nul/absent — jamais un paiement déjà encaissé). Un paiement déjà encaissé n'est donc **jamais supprimable**, seul son `RentalPaymentReceipt` associé peut être annulé (voir §8).

## 8. RentalPaymentReceipt Analysis

Rôle exact, confirmé par le commentaire d'en-tête du modèle lui-même : « historique granulaire des encaissements locatifs, additif à `Paiement` ». Un `RentalPaymentReceipt` représente **un encaissement réel contre une échéance** — plusieurs reçus peuvent viser la même échéance (versements partiels), et un même encaissement peut être réparti sur plusieurs échéances via `encaissementId` (regroupement).

**Idempotence réelle et déjà testée** : `idempotencyKey` + index unique partiel `{paiement:1, idempotencyKey:1}` — un rejeu réseau avec la même clé ne produit jamais un second reçu.

**Annulation contrôlée, jamais une suppression** : `statut ∈ {'confirmed','cancelled'}`, avec `cancelledAt/cancelledBy/cancelledReason` — mais annulation à la granularité de l'échéance uniquement (annuler un reçu n'annule pas les autres reçus du même `encaissementId`).

**Rôle exclu explicitement par le code lui-même** : *« N'est PAS un domaine du Financial Core (FinancialPayment/PaymentAllocation). Mélanger la facturation hôtelière/immobilière-transactionnelle avec l'encaissement de loyer créerait la confusion que la mission demande explicitement d'éviter. »* — **Réponse à la question §48 du mandat : NON, `RentalPaymentReceipt` ne peut pas et ne doit pas représenter un payout propriétaire** — c'est une preuve d'argent **entrant** (locataire → agence), jamais d'argent **sortant** (agence → propriétaire). La direction du flux est structurellement opposée.

## 9. Other Financial Models

- `Transaction`/`PaiementTransaction` : domaine transactionnel immobilier (vente/location d'un dossier de réservation), avec son propre `commission.ownerPayout`/`agencyNet` — **structure de référence intéressante, jamais une source de données réutilisable pour le loyer**.
- `FinancialPayment`/`PaymentAllocation`/`FinancialDocument*` : domaine hôtelier/hébergement — séparation de domaine déjà actée et documentée par les auteurs eux-mêmes.
- Aucune double comptabilisation démontrée entre ces domaines et le loyer — ils ne se recoupent jamais dans le code actuel.

## 10. Commission Contract

Réponses directes aux 9 questions du mandat (§14) :

1. Existe-t-elle ? **Un champ persisté existe (`managementFee`), mais aucun mécanisme de commission appliqué à un encaissement n'existe.**
2. Où ? `RentalManagement.managementFee`.
3. Taux ou montant ? **Montant fixe** (jamais un taux — confirmé par l'absence de sémantique de pourcentage dans le schéma et le code).
4. Configurable à quel niveau ? `RentalManagement` (par dossier de gestion), Admin-only.
5. Versionnée ? **NON.**
6. Peut-elle changer pendant un mandat ? Techniquement oui (`PUT`), mais sans aucune conséquence de calcul puisqu'aucun calcul ne l'utilise.
7. Si elle change, quel taux s'applique aux anciens paiements ? **Sans objet** — aucun paiement n'a jamais été rattaché à une valeur de ce champ.
8. Snapshot existe ? **NON.**
9. Calculée sur quelle base ? **Sans objet — jamais calculée.**

**`Contrat.commissionAgence` est hors sujet** : champ du domaine vente, jamais lu.

## 11. Commission Base

**NON CONFIRMÉ, et sans objet tant qu'aucune commission n'est calculée.** Aucune préférence ne doit être supposée entre « loyer attendu » et « montant réellement encaissé » — le mandat interdit explicitement d'inventer cette réponse (§15), et aucun indice de code ne permet de la déduire.

## 12. Penalties and Fees

`penaliteMontant` est calculé par `alerteService`/`rentalFinancialAutomationService` (taux fixe appliqué au loyer en retard) et **absorbé dans `montantTotal`** — un encaissement qui couvre le `montantTotal` couvre indissociablement loyer + pénalité, sans traçage séparé de la part « pénalité » dans `montantRecu`. **Aucune règle de répartition agence/propriétaire de la pénalité n'existe nulle part dans le code.** Réponse à la question §18 du mandat : **NON CONFIRMÉ** — ni AGENCE, ni PROPRIÉTAIRE, ni PARTAGÉ ne sont établis. Aucune autre catégorie de frais (dossier, retard distinct, charges) n'a été trouvée comme candidate à un partage agence/propriétaire.

## 13. Owner Net Contract

**ABSENT.** Aucun champ, aucun calcul, aucune fonction ne produit `brut - commission ± ajustements`. Ne peut pas être dérivé de manière fiable des données actuelles, puisque le terme « commission » lui-même n'a pas de valeur calculable (§10).

## 14. Settlement Eligibility

**AMBIGUOUS, non défini.** Aucune règle métier n'indique si un encaissement devient éligible au reversement immédiatement, après un délai, après validation staff, ou à la clôture d'une période. Aucun champ `eligibleAt`/`settlementEligible` n'existe.

## 15. Payout Representation

**ABSENT.** Recherche exhaustive confirmée (§4) : zéro occurrence de `payout`/`reversement`/`ownerNet`/`ownerPaid`/`settlement` dans tout le domaine locatif. Le seul `ownerPayout` du codebase appartient au domaine `Transaction` (vente), qui ne doit pas être réutilisé (le mandat l'interdit explicitement, §33 du hotfix précédent déjà confirmé, reconfirmé ici §15).

## 16. Partial Payments

Déjà couvert en détail en §7-8 : **réellement supporté**, avec `RentalPaymentReceipt` (versements successifs, `encaissementId` pour le regroupement multi-échéances), invariant anti-régression du cumul déjà en place. C'est un socle solide et réutilisable si un futur sprint construit le settlement dessus.

## 17. Partial Payouts

**NON CONFIRMÉ** — sans objet, aucun payout n'existe encore pour évaluer un comportement partiel.

## 18. Cancellation / Corrections

- `Paiement` : pas de statut d'annulation propre ; suppression possible uniquement si jamais encaissé.
- `RentalPaymentReceipt` : annulation contrôlée et auditée (`cancelledAt/cancelledBy/cancelledReason`), jamais une suppression physique, à la granularité de l'échéance.
- **Question critique du mandat (§20)** : que devient un settlement si le paiement source est annulé ensuite ? **NON CONFIRMÉ et actuellement sans objet** — puisqu'aucun settlement n'existe, cette question ne peut pas encore se poser en pratique, mais elle **devra être résolue explicitement avant toute implémentation future** (voir §23, invariant de correction).
- Aucun `refund` locatif trouvé (le refund existant, `accommodationRefundService.js`, appartient au domaine hébergement/hôtel, hors périmètre).

## 19. Historical Reconstruction

**Sans objet aujourd'hui** — puisqu'aucune commission n'est jamais appliquée, il n'existe littéralement rien à reconstruire historiquement. C'est un point de vigilance pour la conception future (Invariant 6/26 du mandat) : tout futur champ de taux devra prévoir un mécanisme de snapshot par transaction, jamais une simple relecture du taux courant.

## 20. Idempotence

**Existe déjà, réelle et testée, côté encaissement locataire** (`RentalPaymentReceipt.idempotencyKey` + index unique partiel). **N'existe pas côté payout**, puisque le payout n'existe pas. Le pattern existant est directement transposable.

## 21. Concurrency

**Existe déjà, réelle et testée, côté encaissement locataire** (`runFinancialOperation` + CAS Mongo `findOneAndUpdate` sur l'état précédent). Le même pattern serait le point de départ naturel d'un futur payout, mais rien n'a été implémenté ici.

## 22. Atomicity

`runFinancialOperation` (`services/finance/financialTransactionService.js`) offre déjà une transaction Mongo réelle avec repli documenté — infrastructure générique, réutilisable sans collision de domaine (c'est un utilitaire, pas un modèle financier). Aucune atomicité de payout n'a été implémentée dans ce sprint puisqu'aucun payout n'existe.

## 23. Authorization

Non modifié. Rôles existants (`Proprietaire` en lecture self-service, `Admin`/`Collaborateur` en mutation staff) restent inchangés. **Aucune mutation de payout n'a été créée**, donc aucune nouvelle question d'autorisation ne se pose concrètement — mais le mandat (§56-57) est explicite : si un payout était implémenté, le propriétaire ne devrait jamais pouvoir s'auto-déclarer payé ; cette contrainte est **documentée pour le futur sprint**, non codée ici.

## 24. Tenant Isolation

Non modifié, non retouché. L'isolation cross-owner/cross-tenant déjà certifiée par le hotfix précédent reste intacte (aucun fichier de ce domaine n'a été touché — voir §Diff Check).

## 25. Architecture Decision

**OPTION D retenue explicitement : le contrat métier reste ambigu sur des points bloquants (commission, base, pénalités, éligibilité) → STOP IMPLEMENTATION**, conformément à la règle absolue du mandat.

Précision utile pour le futur choix entre A/B/C une fois les décisions métier prises : les données existantes (`Paiement`, `RentalPaymentReceipt`) et les patterns d'infrastructure existants (`runFinancialOperation`, idempotency key) rendent l'**Option A (extension minimale)** plausible pour le calcul du brut/commission/net **si** ceux-ci peuvent être dérivés sans état persistant supplémentaire. En revanche, dès qu'un **reversement réel et traçable** doit être enregistré (montant, date, statut, référence, acteur — Invariant 7 du mandat), les critères de justification d'un nouveau modèle (§34 du mandat) seront probablement remplis : plusieurs paiements source, événement répétable, besoin d'idempotence et d'audit propres, impossibilité de porter cela proprement dans `Paiement` (qui est une échéance, pas un événement de reversement). **Cette conclusion reste conditionnelle aux décisions métier ci-dessous — elle n'autorise aucune implémentation immédiate.**

## 26. Data Model Decision

**Aucun nouveau modèle créé.** Réponse à la question §32 du mandat (« Peut-on représenter correctement le settlement avec les modèles existants + extensions additives raisonnables ? ») : **PARTIAL** — probablement oui pour le calcul en lecture (brut/commission/net, une fois les règles connues), probablement non pour l'événement de reversement lui-même (voir §25) — mais cette réponse ne peut être définitive qu'après les décisions métier.

## 27. RED Evidence

**Aucun RED créé.** Conformément au mandat (§39, §61) : les RED ne sont créés que si le contrat est suffisamment prouvé pour coder. Ce n'est pas le cas ici — créer des RED sur une formule non décidée reviendrait à inventer silencieusement cette formule pour la faire passer au vert, exactement ce que le mandat interdit (§97 : « NE CODER QUE SI LE CONTRAT EST PROUVÉ »).

## 28. Implementation

**Aucune.** Zéro ligne de code de production ajoutée ou modifiée.

## 29. Mongo Evidence

Sans objet — aucune persistance modifiée. La dernière certification Mongo complète connue (136 suites, 1330/1330, exit 0) reste valide et n'a pas besoin d'être rejouée puisque rien n'a changé depuis (vérifié : `git status --short` identique à la fin de ce sprint).

## 30. Web Owner Self-Service

**Non modifié.** La page `/mes-biens/paiements` reste exactement dans l'état certifié par le hotfix précédent (attendu/payé/restant/historique, jamais de commission/net/reversement affiché) — conforme à l'interdiction absolue du mandat (§61) de calculer une fausse donnée côté React.

## 31. Mobile Impact

**Aucun** — `git diff -- altimmo-app` vide, confirmé.

## 32. Financial Matrix

| Concept | Source canonique | Backend | Tenant UI | Owner UI | Status |
|---|---|---|---|---|---|
| Loyer attendu | `Paiement.montantTotal ?? montant` | Oui | Oui | Oui | **SUPPORTED** |
| Paiement encaissé | `Paiement.montantRecu` | Oui | Oui | Oui | **SUPPORTED** |
| Paiement partiel | `RentalPaymentReceipt` (multiples par échéance) | Oui | Indirect | Indirect | **SUPPORTED** |
| Pénalité | `Paiement.penaliteMontant` | Oui | Oui | Non en KPI dédié | **PARTIAL** |
| Commission agence | Aucune source calculée | Non | N/A | Non | **ABSENT** |
| Base commissionnable | Aucune | Non | N/A | Non | **ABSENT** |
| Net propriétaire | Aucune source | Non | N/A | Non | **ABSENT** |
| Éligibilité reversement | Aucune règle | Non | N/A | Non | **ABSENT** |
| Reversement | Aucun événement | Non | N/A | Non | **ABSENT** |
| Reversement partiel | Aucun événement | Non | N/A | Non | **ABSENT** |
| Solde propriétaire | Aucune source | Non | N/A | Non | **ABSENT** |
| Référence reversement | Aucun champ | Non | N/A | Non | **ABSENT** |
| Date reversement | Aucun champ | Non | N/A | Non | **ABSENT** |
| Relevé propriétaire | Aucune projection | Non | N/A | Non | **ABSENT** |
| Rapprochement | Aucun mécanisme | Non | N/A | Non | **ABSENT** |

## 33. Security Matrix

| Scenario | Expected | Result |
|---|---|---|
| Owner A reads own settlement | ALLOW | **N/A — aucun settlement n'existe encore à lire** |
| Owner A reads Owner B settlement | BLOCK | **N/A** (mais le pattern d'autorité `req.user.id` déjà certifié pour les paiements bruts s'appliquerait identiquement) |
| Tenant A accesses Tenant B settlement | BLOCK | **N/A** |
| Unmanaged property settlement | BLOCK | **N/A** (déjà PASS pour les paiements bruts, hérité et non régressé) |
| Sale enters rental settlement | BLOCK | **N/A** (déjà PASS pour les paiements bruts — `type:'location'` exclusif, hérité et non régressé) |
| Client marks owner payout paid | BLOCK | **N/A — aucune mutation de payout n'existe pour être testée** |
| Unauthorized staff settles | BLOCK | **N/A** |
| Authorized staff same tenant | CONTRACT | **NON CONFIRMÉ — le workflow staff de reversement reste à définir** |
| Admin legitimate tenant authority | PRESERVED | **PASS** (non touché) |

## 34. Invariant Matrix

| Invariant | Test/Proof | Result |
|---|---|---|
| Pending payment not eligible | Sans objet (pas d'éligibilité définie) | **N/A** |
| Failed payment not eligible | Aucun statut "failed" n'existe sur `Paiement` (seulement `impayé`/`en_retard`/`partiel`/`payé`) | **N/A — statut inexistant** |
| Cancelled payment not eligible | `Paiement` n'a pas de statut d'annulation ; `RentalPaymentReceipt.cancelled` existe mais son effet sur un futur settlement est NON CONFIRMÉ | **NON CONFIRMÉ** |
| Collected payment eligible | Sans objet (pas d'éligibilité définie) | **N/A** |
| Commission deterministic | Aucune commission calculée | **N/A** |
| Owner net deterministic | Aucun net calculé | **N/A** |
| No double settlement | Aucun settlement n'existe | **N/A — rien à dupliquer** |
| No over-settlement | Aucun settlement n'existe | **N/A** |
| Cross-owner blocked | Hérité du hotfix précédent, non régressé (paiements bruts) | **PASS (hérité)** |
| Cross-tenant blocked | Hérité, non régressé | **PASS (hérité)** |
| Historical rate reconstructible | Aucun taux n'existe à reconstruire | **N/A** |
| Sale excluded | Hérité, non régressé (`type:'location'`) | **PASS (hérité)** |
| Unmanaged property excluded | Hérité, non régressé (`managementActivated`) | **PASS (hérité)** |

## 35. Numerical Examples

Conformément au mandat (§83) : seules les valeurs réellement définies par le code sont chiffrées ; tout le reste est **NON CONFIRMÉ**, jamais inventé.

**Exemple 1 — Loyer complet.** Loyer 100 000 XAF, encaissé intégralement (100 000). Gross = **100 000**. Commission base = NON CONFIRMÉ. Commission = NON CONFIRMÉ. Owner net = NON CONFIRMÉ. Éligible = NON CONFIRMÉ. Reversé = NON CONFIRMÉ. Restant = NON CONFIRMÉ.

**Exemple 2 — Paiement partiel.** Loyer 100 000, encaissé 40 000 (`statut:'partiel'`). Gross = **40 000** (seul l'encaissé réel est un fait établi). Reste attendu = **60 000**. Commission/net/éligible/reversé = NON CONFIRMÉ.

**Exemple 3 — Plusieurs paiements pour une période.** Deux `RentalPaymentReceipt` de 40 000 puis 60 000 sur la même échéance de 100 000 → `Paiement.montantRecu` final = **100 000**, `statut` = **'payé'** (mécanique réellement vérifiée en code, §7-8). Commission/net/éligible/reversé = NON CONFIRMÉ.

**Exemple 4 — Pénalité.** Loyer 100 000, retard, pénalité calculée par `rentalFinancialAutomationService` (taux existant ailleurs dans le code, non recalculé ici pour ne pas rouvrir ce sujet) portée dans `montantTotal`. Si le locataire règle l'intégralité de `montantTotal` : Gross encaissé = **montantTotal réel** (loyer + pénalité confondus, non séparés dans `montantRecu`). Part de la pénalité effectivement reversable au propriétaire vs conservée par l'agence = **NON CONFIRMÉ** (§12).

**Exemple 5 — Plusieurs biens d'un propriétaire.** Déjà prouvé fonctionnel par le hotfix précédent : agrégation multi-biens correcte au niveau du brut (`rentalOwnerFinancialService.js`, testé avec 2 biens gérés simultanément). Commission/net/éligible/reversé par bien = NON CONFIRMÉ pour chacun.

## 36. Targeted Tests

**Sans objet — aucun code ajouté, aucun test créé.**

## 37. Full Gates

**Non relancés** — le worktree est identique à l'état déjà certifié par le hotfix précédent (`git status --short` inchangé pendant tout ce sprint). Relancer les suites complètes n'aurait aucune valeur probante supplémentaire pour un sprint qui n'a modifié aucun fichier de code. Dernières valeurs certifiées et toujours valides : Backend 145/1592, Web 107/766, Mongo 136/1330, Architecture 0 nouvelle violation, Lint 0 erreur.

## 38. Residual Debt

1. **Décisions métier bloquantes** (voir §Next Minimal Sprint) — taux/montant de commission, base commissionnable, répartition des pénalités, définition de l'éligibilité au reversement, workflow staff d'exécution.
2. Effet d'une annulation de `RentalPaymentReceipt` sur un futur calcul de settlement — non caractérisé, à traiter au moment de la conception du contrat.
3. Toute la dette déjà documentée par le hotfix précédent (parité Mobile propriétaire, reçus locataire par encaissement non exposés, pas de relevé, pas de filtre UI owner) reste inchangée et non retouchée par ce sprint.

## 39. Owner Settlement Readiness Score

| Sous-score | Note | Justification |
|---|---:|---|
| Business contract clarity | 2/15 | Contrat non défini sur les points structurants (commission, base, pénalités, éligibilité) |
| Canonical source of truth | 8/15 | Le brut (loyer/encaissement) a une source canonique solide et déjà certifiée ; net/commission/payout n'en ont aucune |
| Commission correctness | 0/10 | Aucune commission calculée nulle part |
| Owner net correctness | 0/10 | Absent |
| Payout persistence | 0/10 | Absent |
| Idempotence/concurrency | 5/10 | Aucune pour le payout (absent), mais un pattern solide et déjà prouvé existe côté encaissement (`RentalPaymentReceipt`/`runFinancialOperation`), directement réutilisable |
| Authorization/tenant safety | 5/10 | Le pattern d'autorité (`req.user.id`, cross-owner/cross-tenant bloqués) est déjà solide pour le brut ; rien n'existe encore à sécuriser côté payout |
| Audit/reconciliation | 0/10 | Absent |
| Owner self-service UX | 2/5 | Le brut est bien présenté et honnête (jamais de fausse commission affichée) ; aucune vue de net/reversement n'existe, logiquement |
| Test coverage | 0/5 | Aucun test de settlement, puisqu'aucun settlement n'existe |
| **Total** | **22/100** | |

## 40. Mandatory Answers (118)

1. `main`. 2. `49f12d787b1011d16f9682cedefb81b377823e4d`. 3. Identique à l'état laissé par le hotfix précédent — 14 fichiers déjà présents, rien d'autre. 4. **Oui**, intégralement préservé, aucune commande destructive exécutée. 5. **Oui**, les deux rapports lus intégralement avant toute analyse.

6. Modèles financiers locatifs existants : `RentalManagement` (mandat/frais fixe), `Contrat` (terme du bail), `Paiement` (échéance agrégée), `RentalPaymentReceipt` (encaissement granulaire). 7. Source canonique du loyer attendu : `Paiement.montantTotal ?? montant`. 8. Source canonique du paiement encaissé : `Paiement.montantRecu`, alimenté atomiquement par `RentalPaymentReceipt`. 9. Statuts signifiant encaissé : `'payé'` et `'partiel'` (avec `montantRecu > 0`). 10. Paiements partiels supportés ? **Oui.** 11. Plusieurs paiements par période supportés ? **Oui** (`RentalPaymentReceipt` multiples). 12. Surpaiement supporté ? **NON — explicitement rejeté** par une validation 422.

13. Commission locative existe ? **Un champ existe, aucun mécanisme de calcul n'existe.** 14. Où ? `RentalManagement.managementFee`. 15. Taux ou montant ? **Montant fixe.** 16. Configurable à quel niveau ? `RentalManagement`, Admin-only. 17. Base commissionnable ? **NON CONFIRMÉ.** 18. Commission sur attendu ou encaissé ? **NON CONFIRMÉ, sans objet.** 19. Pénalité commissionnable ? **NON CONFIRMÉ.** 20. Qui reçoit les pénalités ? **NON CONFIRMÉ.**

21. Frais existants (hors pénalité) ? Aucun candidat trouvé au partage agence/propriétaire. 22. Qui reçoit les frais ? Sans objet. 23. Owner net existe déjà ? **NON.** 24. Persisté ou dérivé ? Sans objet. 25. Owner net peut-il être calculé sans ambiguïté ? **NON**, tant que la commission n'est pas définie.

26. Reversement existe déjà ? **NON.** 27. Où ? Nulle part. 28-32. Montant/date/référence/statut/actor propres au reversement ? Sans objet, rien n'existe.

33. Reversement partiel supporté ? **NON CONFIRMÉ, sans objet.** 34. Plusieurs reversements par propriétaire ? Sans objet. 35. Plusieurs reversements par paiement ? Sans objet. 36. Un reversement couvre plusieurs paiements ? Sans objet côté payout — mais le pattern équivalent côté encaissement (`encaissementId` couvrant plusieurs échéances) existe déjà et est un précédent réutilisable. 37. Paiement locataire distinct du payout ? **OUI**, confirmé — ce sont deux directions de flux financier opposées, jamais confondues dans le code actuel.

38. Idempotence existante ? **Oui, côté encaissement** (`RentalPaymentReceipt.idempotencyKey`) ; **non côté payout** (absent). 39. Concurrence protégée ? **Oui, côté encaissement** (`runFinancialOperation` + CAS) ; **non côté payout**. 40. Over-settlement possible actuellement ? Sans objet, aucun settlement n'existe pour qu'il soit possible ou non.

41. Annulation paiement existe ? Partiellement — `RentalPaymentReceipt` peut être annulé, `Paiement` lui-même non. 42. Effet sur settlement ? **NON CONFIRMÉ.** 43. Refund existe ? Non côté location (existe côté hébergement, hors périmètre). 44. Effet sur settlement ? Sans objet. 45. Taux historique reconstructible ? Sans objet, aucun taux n'existe. 46. Un changement de commission réécrit-il l'historique ? Sans objet.

47. `RentalPaymentReceipt` rôle exact ? Preuve d'encaissement locataire granulaire, jamais un reversement — confirmé par le commentaire du modèle lui-même. 48. Peut-il représenter payout ? **NON, confirmé** — direction de flux opposée.

49. Existing models sufficient ? **PARTIAL.** 50. YES/NO/PARTIAL : **PARTIAL**, conditionnel aux décisions métier (§25).

51. Nouveau modèle nécessaire ? **NON CONFIRMÉ à ce stade** — probablement pas pour le calcul en lecture, probablement oui pour l'événement de reversement lui-même une fois le contrat défini, mais ni l'un ni l'autre ne peut être tranché avant les décisions métier. 52. Si oui, pourquoi ? Sans objet tant que non tranché. 53. Pourquoi un champ dans `Paiement` serait insuffisant ? Parce que `Paiement` est une échéance (un document par période), tandis qu'un reversement est un événement transversal pouvant couvrir plusieurs échéances/biens — même logique que celle qui a justifié `RentalPaymentReceipt` plutôt qu'un simple champ sur `Paiement` côté encaissement. 54. Pourquoi un modèle générique `Transaction` serait bon/mauvais ? Mauvais — domaine vente, mélangerait deux flux économiques différents (le mandat l'interdit explicitement).

55. Existing Financial Core réutilisable ? **Comme infrastructure (`runFinancialOperation`), oui. Comme modèle de données (`FinancialPayment`/`PaymentAllocation`), non** — collision de domaine déjà évitée intentionnellement par les auteurs du code. 56. Sans collision de domaine ? Oui, si seule l'infrastructure transactionnelle est réutilisée, jamais les modèles de données hôteliers.

57. Architecture retenue ? **Aucune implémentation** — caractérisation uniquement. 58. OPTION A/B/C/D ? **OPTION D — le contrat métier reste ambigu → STOP IMPLEMENTATION.**

59. Le contrat métier est-il suffisamment défini pour coder ? **NON.** 60. Si NON, quelles décisions utilisateur sont nécessaires ? Voir §Next Minimal Sprint — liste exhaustive.

61-71. RED créés ? **Aucun**, pour toutes les catégories listées (commission, pending/failed, double settlement, over-settlement, partial payout, concurrency, cross-owner, cross-tenant, sale exclusion, unmanaged property) — conformément à la règle « ne pas fabriquer de RED sur un contrat non prouvé ».

72. Atomicité utilisée ? Non implémentée dans ce sprint ; le pattern existant (`runFinancialOperation`) est identifié comme réutilisable pour un futur sprint. 73. Mongo transaction nécessaire ? Oui, si un payout devient un événement persistant multi-documents (probable mais non tranché). 74. Idempotency key nécessaire ? Oui, par analogie directe avec le pattern déjà prouvé de `RentalPaymentReceipt`. 75. Unique constraint nécessaire ? Probablement, par le même raisonnement — non implémenté.

76. Settlement finalisé immutable ? **Position recommandée pour le futur contrat** (append-only/transition de statut plutôt que PATCH libre), non implémentée ici — décision produit à confirmer. 77. Delete autorisé ? **Position recommandée : non**, par analogie avec `RentalPaymentReceipt` (annulation contrôlée, jamais suppression) — non implémentée ici.

78. Qui peut créer payout ? **NON CONFIRMÉ — décision métier requise.** 79. Qui peut confirmer payout ? **NON CONFIRMÉ.** 80. Propriétaire peut-il modifier payout ? 81. **Attendu NON**, cohérent avec le principe déjà appliqué à tout le reste du domaine locatif (le propriétaire est toujours lecteur, jamais acteur des mutations financières) — mais aucune mutation n'existe encore pour l'appliquer concrètement.

82. Admin authority préservée ? **Oui**, non touchée. 83. Gestionnaire authority préservée ? **Oui**, non touchée. 84. PlatformOperator préservé ? **Oui**, non touché.

85. Owner self-service enrichi ? **NON**, volontairement — aucune fausse donnée n'a été ajoutée. 86. Quelles colonnes ? Aucune nouvelle. 87. Solde propriétaire supporté ? **NON.** 88. Relevé supporté ? **NON.** 89. Gross→commission→net traçable maintenant ? **NON**, seul le gross (brut) l'est. 90. Net→payout traçable maintenant ? **NON**, sans objet. 91. Rapprochement supporté ? **NON.** 92. Multi-property supporté ? **Oui**, pour le brut, déjà certifié par le hotfix précédent. 93. Historical lease supporté ? **Oui**, pour le brut, déjà certifié.

94-103. Tests ciblés/Mongo réel/full Mongo/full backend/Web/Mobile modifié/Architecture/Lint/diff-check/secret scan : **sans objet pour la plupart (aucun code ajouté)** ; `diff-check` = **PASS** (vide, confirmé) ; Mobile modifié = **NON**, confirmé (`git diff -- altimmo-app` vide).

104. Nouveau package ? **NON.** 105. Nouveau modèle ? **NON.** 106. Migration ? **NON.** 107. P0 trouvé ? **0.** 108. P1 trouvé ? **0** au sens bug — le gap restant est un gap métier/produit, pas un défaut de code. 109. Dette résiduelle ? Voir §38.

110. Readiness settlement /100 ? **22/100.** 111. Owner Web score après ? **72/100, inchangé** — ce sprint n'a rien ajouté à l'UI, donc aucune raison de faire varier ce score déjà certifié par le hotfix précédent. 112. Owner Mobile score après ? **31/100, inchangé**, aucune modification mobile.

113. Prochain sprint minimal ? Voir §Next Minimal Sprint — un sprint de **décisions produit**, pas de code.

114. Commit ? **NON.** 115. Push ? **NON.** 116. Deploy ? **NON.**

117. Rapport créé ? **Oui**, le présent fichier, seul fichier créé par ce sprint. 118. Verdict final ? **E — BUSINESS DECISION REQUIRED, NO SETTLEMENT CODE IMPLEMENTED.**

## 41. Next Minimal Sprint

**Aucun sprint de code n'est recommandé avant que les décisions produit suivantes soient prises** (conformément à la règle du mandat : ne pas proposer un sprint de code tant que le contrat reste ambigu). Décisions requises, dans l'ordre :

1. **Commission de gestion locative** : existe-t-elle réellement comme prélèvement récurrent sur chaque encaissement ? Si oui : taux ou montant fixe ? Configurable par mandat (`RentalManagement`) ou globalement ? `managementFee` doit-il être réinterprété comme tel, ou un nouveau champ dédié est-il nécessaire ?
2. **Base commissionnable** : loyer attendu, montant réellement encaissé, ou autre ?
3. **Traitement des pénalités de retard** : reversées au propriétaire, conservées par l'agence, ou partagées ? Selon quelle règle ?
4. **Éligibilité au reversement** : immédiate à l'encaissement, différée, soumise à validation staff, ou périodique (mensuelle/autre) ?
5. **Workflow de reversement** : qui initie, qui confirme, quel moyen de paiement, quelle référence, reversements partiels autorisés ou non ?
6. **Effet d'une annulation d'encaissement** sur un reversement déjà émis ou en attente.
7. **Politique de versioning du taux** : un changement de taux doit-il s'appliquer rétroactivement, ou seulement aux encaissements futurs (snapshot par transaction) ?

Une fois ces décisions prises et documentées par le propriétaire produit, le sprint technique suivant (nom suggéré à définir alors, par exemple `RENTAL-OWNER-SETTLEMENT-IMPLEMENTATION-1`) pourra suivre la méthode déjà éprouvée dans ce projet : caractérisation confirmée → RED → implémentation minimale → Mongo réel → concurrence → sécurité → gates complets.

## 42. Final Verdict

**E — BUSINESS DECISION REQUIRED, NO SETTLEMENT CODE IMPLEMENTED.**

La caractérisation démontre, par lecture directe et exhaustive du code (jamais par supposition), que le domaine de gestion locative d'Altitude Vision ne contient aujourd'hui aucun mécanisme de commission, de net propriétaire ou de reversement — le seul champ candidat (`managementFee`) étant un frais d'agence fixe et ponctuel, jamais appliqué à un encaissement, et le seul autre candidat (`commissionAgence`) appartenant explicitement au domaine de la vente. Le brut locatif (loyer attendu, encaissement, paiements partiels) dispose en revanche d'une source de vérité canonique, solide et déjà certifiée, avec des patterns d'idempotence et de concurrence réels et éprouvés (`RentalPaymentReceipt`, `runFinancialOperation`) qui constitueront une base technique précieuse une fois le contrat métier du reversement défini.

Conformément à la règle absolue de ce sprint — ne jamais inventer une règle financière touchant à de l'argent réel — **aucune ligne de code n'a été écrite**. Ce rapport documente précisément les sept décisions produit nécessaires avant qu'un futur sprint d'implémentation puisse démarrer en toute sécurité.

**OWNER SETTLEMENT READINESS : 22/100.**

Aucun commit, push ou déploiement n'a été effectué. Le hotfix précédent (14 fichiers, Verdict B certifié) reste intégralement préservé et non modifié.
