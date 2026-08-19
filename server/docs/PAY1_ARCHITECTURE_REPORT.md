# PAY-1 — Audit complet & architecture unifiée des paiements

Date : 2026-08-19. Branche `main`, `HEAD 29044699d25df30d1fffbbadf11fefc9cd6f9cac` (inchangé pendant tout le sprint).

## 1. Résumé exécutif

Le projet possède déjà **cinq systèmes de paiement parallèles** (`Paiement`, `PaiementTransaction`/`Transaction`, `AccommodationReservation` embarqué, et le Financial Core `FinancialPayment`/`PaymentAllocation`/`FinancialDocument`/`FinancialLedgerEntry`), avec deux intégrations providers réelles (**CinetPay** et **YabetooPay**), toutes deux fonctionnant déjà comme agrégateurs Mobile Money couvrant de facto MTN et Airtel. Le Financial Core, conçu en F0-F2.6 précisément pour unifier ces flux, n'est aujourd'hui **canonique que pour le domaine Hôtel**, et volontairement pas ailleurs (décision documentée, pas un oubli).

**Découverte critique (P0) de ce sprint** : le webhook CinetPay réellement actif (`POST /api/paiements/webhook-cinetpay`, utilisé comme `notify_url` par `cinetpayController.initierPaiement`) n'a **aucune vérification de signature, aucune authentification, aucune protection anti-rejeu**, et écrit `Paiement.statut = 'payé'` sur simple réception d'un `transaction_id` deviné par un tiers. Un second flux CinetPay (`paiementTransactionController.webhookCinetpay`), lui correctement sécurisé (HMAC + idempotence), existe mais est explicitement commenté dans le code comme non utilisé par les paiements actuels. Cette découverte a été vérifiée par lecture directe du code et prouvée par un test de caractérisation exécutable (`server/__tests__/cinetpayWebhookCharacterization.test.js`, 3/3 verts), sans aucune correction appliquée — conformément au mandat.

**MTN et Airtel Money ne sont pas absents** : ce sont déjà des valeurs d'opérateur fonctionnelles à l'intérieur de l'intégration Yabetoo, actives pour la vente/location immobilière et les visites. Ils sont en revanche **absents du domaine Hôtel**, qui ne connaît que la saisie manuelle. Visa, Mastercard, Stripe et PayPal sont, eux, réellement absents — aucun code, seulement des mentions documentaires génériques.

Ce sprint est un audit et une proposition d'architecture. Aucun provider n'a été branché, aucune migration effectuée, aucun modèle créé.

## 2. Git baseline

Voir `PAY1_ETAT_INITIAL.md` §1. `HEAD` inchangé pendant tout le sprint (§50 de ce rapport). Aucun `git add`/`commit`/`push`/déploiement.

## 3. Modèles

Inventaire exhaustif (18 modèles avec dimension paiement) dans `PAY1_ETAT_INITIAL.md`-adjacent — synthèse ici, détail complet obtenu par lecture directe de chaque fichier :

| Modèle | Rôle | Devise stockée | Montants | Idempotence |
|---|---|---|---|---|
| `Paiement` | Échéance/règlement loyer mensuel | **Aucune** | `Number` brut | Aucune |
| `PaiementTransaction` | Paiement individuel sur une transaction immobilière | Implicite (aucun champ) | `Number` | Index unique partiel `{transaction, methode}` sur statuts "ouverts" |
| `Transaction` | Deal vente/location + commission | Implicite | `Number` | `finalization.operationKey` unique |
| `RentalPaymentReceipt` | Encaissement granulaire loyer (multi-échéance) | Hérite de `Paiement` (aucune) | `Number` | `idempotencyKey` unique partiel |
| `FinancialPayment` | Paiement Financial Core | `currency` enum `XAF/EUR/USD` | `amountMinor` entier sûr | `{provider,providerPaymentId}` unique + `businessOperationKey` unique |
| `PaymentAllocation` | Lien paiement↔facture | idem | `amountMinor` entier sûr | `businessOperationKey` unique |
| `FinancialDocument` | Facture/avoir/proforma/reçu | idem | 8 champs `...Minor` entiers sûrs, non négatifs | `documentNumber` unique, `businessOperationKey` unique |
| `FinancialLedgerEntry` | Journal append-only | idem | `amountMinor` optionnel | `{businessOperationKey, eventType}` unique ; hooks bloquant update/delete |
| `FinancialProviderEvent` | Registre webhook idempotent | — | — | `{provider, providerEventId}` unique — **c'est le mécanisme qui protège Yabetoo mais que le webhook CinetPay actif n'utilise pas** |
| `FinancialRefund` | Remboursement | enum | `amountMinor` | `businessOperationKey` unique |
| `AccommodationReservation` | Réservation hébergement + cycle paiement embarqué | `XAF` (snapshot) | `Number` | **Aucun index unique idempotence propre** — écart notable face à `HotelReservation` |
| `Document` | Facture/devis historique (legacy, distinct de `FinancialDocument`) | Aucune | `Number` | `businessOperationKey` unique |

Écart structurel confirmé : **`Paiement`, `PaiementTransaction`, `Transaction`, `Contrat` et `Document` n'ont aucun champ devise** — tous supposent XAF implicitement. Le Financial Core est le seul système à stocker `currency` explicitement et à valider les montants comme entiers sûrs (`Number.isSafeInteger`), conformément à la décision F0 §7.

## 4. Routes

Inventaire complet dans l'agent de recherche dédié (routes + contrôleurs + middleware d'auth pour `/api/paiements`, `/api/transactions`, `/api/visites`, `/api/financial`). Points structurants :

- `/api/paiements` : `POST /initier` (CinetPay) et `POST /webhook-cinetpay` sont montés **avant** `router.use(auth.protect)` — volontaire pour le webhook (doit rester public), mais `/initier` porte sa propre garde explicite.
- `/api/transactions` : deux webhooks (`webhook/cinetpay` legacy sécurisé, `paiements/webhook` Yabetoo sécurisé), aucun des deux protégé par middleware de route (sécurité entièrement dans la vérification de signature en corps de contrôleur — normal pour un webhook, la signature EST l'authentification).
- `/api/visites` : `router.use(protect)` global — cohérent, aucun webhook public nécessaire puisqu'il n'y a pas de webhook du tout ici (polling seulement).
- `/api/financial` : `router.use(auth.protect, requireTenantScope)` global, autorisation fine ensuite dans chaque contrôleur via `financialAuthorizationService` — **aucune route webhook n'existe sous `/api/financial`**, tous les paiements y sont créés manuellement par du personnel autorisé.

## 5. Frontend Web

Formulaires/paiement identifiés (détail complet dans l'agent de recherche) : `HotelPaymentPanel.jsx` (saisie manuelle hôtel, toutes méthodes), `AccommodationRefundPanel.jsx` (remboursement hébergement), `TransactionsPage.jsx` (historique + affichage méthodes CinetPay/Yabetoo/virement), `PaiementsPage.jsx`/`MesPaiementsPage.jsx` (visites, staff et client), `GestionLocativePage.jsx` (encaissement loyer). Aucun "checkout" web pour le client hôtel — la saisie est strictement staff-only aujourd'hui (conforme F2.2).

## 6. Mobile

`PaiementScreen.jsx` (Yabetoo MTN/Airtel, vente/location), `VirementScreen.jsx` (virement bancaire avec preuve, coordonnées statiques), `TransactionsScreen.jsx` (historique, header uniformisé en UI-MOB-7 de cette même session), `AccommodationReservationDetailScreen.jsx` (résumé financier + remboursement hébergement). **Aucun écran mobile de paiement de loyer ni de paiement hôtel** — ces deux domaines sont web/staff-only côté paiement. Aucun écran créé pendant ce sprint (conforme mandat §8).

## 7. Financial Core

Architecture confirmée par lecture directe des modèles/services, cohérente avec `FINANCIAL_CORE_ARCHITECTURE.md`/`FINANCIAL_CORE_IMPLEMENTATION.md` : `FinancialDocument` (facture immuable après émission) → `FinancialPayment` (manuel dans le périmètre actuel) → `PaymentAllocation` (append-only, reversal jamais une suppression) → `FinancialLedgerEntry` (audit, hooks bloquant toute mutation post-écriture). Machine d'état stricte, séquence de numérotation atomique par établissement, idempotence par `businessOperationKey`/`Idempotency-Key` header sur toutes les routes de mutation. C'est le système le plus robuste du dépôt — mais son périmètre reste **hôtel uniquement**.

## 8. Paiement legacy

`Paiement` (loyer) et `PaiementTransaction`/`Transaction` (immobilier) restent, par décision explicite (ADR-FIN-007), les sources de vérité de leurs domaines respectifs — pas remplacés, pas mis en double-écriture. Le mot "legacy" au sens du mandat s'applique précisément à **un seul flux identifié dans le code lui-même** : `paiementTransactionController.webhookCinetpay`, commenté `// legacy — conservé, non utilisé par les nouveaux paiements`.

## 9. CinetPay

**Deux implémentations indépendantes et divergentes confirmées par lecture directe du code** :

**Flux A (actif)** — `cinetpayController.js:webhookCinetpay`, route `POST /api/paiements/webhook-cinetpay`, référencé comme `notify_url` par `cinetpayController.js:initierPaiement` :
```js
exports.webhookCinetpay = async (req, res) => {
  const { transaction_id, status, amount, metadata } = req.body;
  if (status === 'ACCEPTED') {
    await Paiement.findOneAndUpdate(
      { reference: transaction_id },
      { statut: 'payé', datePaiement: new Date(), montantRecu: amount },
    ).catch(() => {});
    // notify(...) avec userId extrait du metadata fourni par le client
  }
  res.status(200).json({ received: true });
};
```
Aucune vérification de `x-token`/HMAC, aucun `req.rawBody`, aucune consultation de `FinancialProviderEvent`. **Prouvé par test de caractérisation** (§37) : une requête sans aucun en-tête, avec un `transaction_id` arbitraire, marque le paiement payé et déclenche une notification vers un `userId` fourni par le client dans le corps de la requête.

**Flux B (legacy, sécurisé)** — `paiementTransactionController.js:webhookCinetpay`, route `POST /api/transactions/webhook/cinetpay`, commentaire de route explicite `// legacy — conservé, non utilisé par les nouveaux paiements` :
```js
function verifyCinetPayWebhook(req) {
  const secret = process.env.CINETPAY_SECRET;
  if (!secret) return { ok: false, statusCode: 503, ... };            // fail-closed si secret absent
  if (!/^[a-f0-9]{64}$/i.test(received)) return { ok: false, statusCode: 401, ... };
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(...) ? { ok: true } : { ok: false, statusCode: 401, ... };
}
```
HMAC-SHA256 sur 15 champs IPN concaténés, comparaison `timingSafeEqual`, idempotence via `FinancialProviderEvent` (index unique `{provider, providerEventId}`), transition d'état conditionnelle (`allowedCurrentStatuses`). **C'est le flux correctement conçu, mais il n'est pas celui qui reçoit le trafic réel.**

**Réponse à la question du mandat §26 (HMAC conditionnel)** : le rapport F0 évoquait un "HMAC conditionnel" — la réalité du code est plus précise et plus grave : ce n'est pas que la vérification est conditionnelle selon la présence du secret sur *un* flux, c'est que **deux flux distincts existent, un avec vérification fail-closed correcte (Flux B, inutilisé), un sans aucune vérification (Flux A, actif)**. Non corrigé dans ce sprint conformément au mandat.

CinetPay est-il encore actif ? **Oui**, via Flux A, pour les paiements de loyer (`Paiement`). Peut-il servir de provider carte/Mobile Money selon les contrats présents ? **NON CONFIRMÉ** — le code n'expose aucun contrat CinetPay documentant la couverture réseau de carte (Visa/Mastercard) ni la liste exacte des opérateurs Mobile Money couverts ; `channels: 'ALL'` est envoyé à l'API CinetPay sans que le code ne documente ce que "ALL" couvre réellement.

## 10. YabetooPay

Intégration la plus robuste du dépôt côté sécurité webhook (voir §9 pour le contraste). Couvre vente/location (`PaiementTransaction`) et visites (`Visite`, initiation seulement, **pas de webhook** — voir §39). Opérateurs supportés : `AIRTEL`, `MTN` (enum fermé, validé côté serveur). Credentials : `YABETOO_API_URL`, `YABETOO_SECRET_KEY`, `YABETOO_WEBHOOK_SECRET` (noms seulement, jamais de valeur consultée). Actif : **oui**, pour les deux domaines où il est câblé. Absent pour l'hôtel et le loyer.

## 11. MTN MoMo

**Existe déjà** — pas une intégration séparée à construire, mais une valeur d'énumération `operateur: 'MTN'` fonctionnelle à l'intérieur de Yabetoo (`PaiementTransaction.js`, `paiementTransactionController.js`, `visiteController.js`, `PaiementScreen.jsx` mobile). Réponse à la question du mandat §16 : rien à créer pour vente/location/visites, MTN y fonctionne déjà via l'agrégateur. Pour l'hôtel, absent (saisie manuelle `mobile_money` seulement) — l'extension nécessiterait de brancher Yabetoo (ou un provider équivalent) sur le Financial Core, pas de créer un nouvel endpoint MTN.

## 12. Airtel Money

Identique à MTN (§11), valeur `operateur: 'AIRTEL'`. Aucune intégration officielle Congo directe et séparée trouvée — uniquement via Yabetoo. Même conclusion : actif immobilier/visites, absent hôtel.

## 13. Visa

**ABSENT** confirmé — recherche exhaustive, aucun résultat autre que des faux positifs de sous-chaîne (`preavisActif`, etc.) et des mentions documentaires génériques de "paiement par carte" sans lien avec le réseau Visa spécifiquement. `PaiementTransaction.methode` contient `cinetpay_carte` — un type de méthode générique "carte via CinetPay", sans preuve que Visa spécifiquement soit couvert (NON CONFIRMÉ, dépend d'un contrat CinetPay non documenté dans le code).

## 14. Mastercard

**ABSENT** — zéro occurrence dans tout le dépôt, code ou documentation.

## 15. Virement bancaire

Workflow confirmé, conforme exactement au schéma attendu par le mandat §12 : `Utilisateur → soumet virement (VirementScreen.jsx, coordonnées bancaires statiques affichées, référence + preuve upload) → POST /api/transactions/:id/paiements/virement → statut en_attente → staff valide via PATCH .../valider (Admin uniquement) → confirmé`. Existe pour vente/location (`PaiementTransaction`), loyer (`Paiement`/`RentalPaymentReceipt`, saisie directe staff sans étape d'upload client dédiée identifiée), et hôtel (`FinancialPayment`, méthode `bank_transfer`, référence obligatoire côté serveur). Pas de rapprochement bancaire automatisé nulle part (confirmé absent — niveau A du mandat §29 uniquement, jamais niveau B).

## 16. Espèces

Existe dans les trois domaines majeurs (immobilier, loyer, hôtel), toujours saisie staff, jamais initiée client (cohérent avec la nature du moyen). Rôle autorisé : `payments.manage` (loyer, `Secretaire`+`Admin`+`Collaborateur`), capacités financières hôtel (`Admin`, `Collaborateur`, `Secretaire`). Entrent-ils dans `FinancialPayment` ? **Oui pour l'hôtel** (méthode `cash` du Financial Core) ; **non pour l'immobilier/loyer** — restent sur `PaiementTransaction`/`Paiement`, hors noyau commun (cohérent avec §8/§20 de ce rapport).

## 17. Chèque

Modélisé de façon cohérente dans tous les systèmes (`Paiement`, `PaiementTransaction`, `RentalPaymentReceipt`, `FinancialPayment`, `FinancialRefund`) mais **usage réel en volume NON CONFIRMÉ** (aucune preuve dans le code de fréquence d'utilisation — c'est une option de formulaire, pas une donnée de production consultable dans ce sprint). Conformément au mandat §14, non retiré, conservé tel quel.

## 18. Hôtel

Seul domaine où le Financial Core est canonique de bout en bout : `HotelReservation` → `FinancialDocument` (F2.1) → `FinancialPayment`/`PaymentAllocation` (F2.2, manuel) → blocage de check-out si solde positif (F2.3) → PDF/email (F2.4) → dashboard lecture seule (F2.5) → RBAC Staff→Hôtel (F2.6). Aucun provider ne bypasse ce noyau — il n'y a d'ailleurs aucun provider du tout, seulement de la saisie manuelle confirmée par du personnel autorisé.

## 19. Location (gestion locative / loyer)

`Contrat` → `Paiement` (échéance mensuelle) → `RentalPaymentReceipt` (encaissements, y compris multi-échéance en un seul geste, F2.1 GL-DEBT) → quittances PDF (`Contrat.documents`, hors `FinancialDocument`). Pénalités calculées par `rentalFinancialAutomationService` directement sur `Paiement`, sans passer par une allocation formelle. CinetPay (Flux A, non sécurisé) est le seul provider branché sur ce domaine. Convergence vers le Financial Core : **non entamée**, décision ADR-FIN-007 de ne pas migrer sans sprint dédié.

## 20. Vente

`Transaction` (deal) → `PaiementTransaction` (paiements multiples, un par méthode maximum grâce à l'index unique partiel `{transaction, methode}`) → `finalizeTransaction` (crée un `Document` de commission historique, pas un `FinancialDocument`). CinetPay/Yabetoo s'y branchent via `PaiementTransaction.methode`/`operateur`. Commission calculée (`Transaction.commission.{total,ownerPayout,agencyNet}`) mais **jamais reversée par un flux de paiement réel** — voir §22.

## 21. Visites

`Visite` porte les frais et le statut de paiement directement (pas de modèle dédié). Yabetoo réellement utilisé pour l'initiation (`initierPaiementVisite`), confirmé. **Aucun webhook** — uniquement `verifierPaiementVisite` (polling GET vers Yabetoo, authentifié côté serveur par `YABETOO_SECRET_KEY`, jamais par une preuve poussée par Yabetoo). Dépendance critique non documentée ailleurs : si le client ne revient jamais consulter son statut de paiement, celui-ci reste indéfiniment `en_attente`, sans reconciliation automatique ni cron. Deux champs de statut parallèles (`visitFeeStatus` et `paiementStatus`) coexistent sans synchronisation formelle prouvée — risque de divergence silencieuse.

## 22. Payout owner

**Aucun flux de payout réel n'existe.** `Transaction.commission.ownerPayout` est un **nombre calculé** (`Math.round(total * 0.30)` si "spécial", sinon 0) stocké sur la transaction — il n'y a ni statut de payout, ni date de versement, ni preuve, ni modèle `Payout`/`Settlement` dédié, ni route pour l'exécuter. Le mandat §40 demande explicitement de ne pas confondre paiement client et payout propriétaire : dans ce code, cette confusion est structurellement impossible aujourd'hui car **le payout propriétaire n'est tout simplement pas implémenté au-delà du calcul** — c'est un flux entièrement absent, pas un flux mal séparé.

## 23. Allocations

`PaymentAllocation` (Financial Core, hôtel uniquement) est le seul mécanisme d'allocation formel du dépôt : append-only, `reversed` jamais supprimé, clé métier unique empêchant la double allocation logique, réservation atomique du disponible paiement puis du solde facture avec compensation en cas d'échec partiel (§ FINANCIAL_CORE_IMPLEMENTATION.md). Aucun autre domaine (immobilier, loyer, visites) n'a de notion d'allocation formelle — un paiement `PaiementTransaction`/`Paiement` est simplement lié 1:1 (ou N:1 via l'array `Transaction.paiements`) sans solde/allocation partielle tracés séparément.

## 24. Ledger

`FinancialLedgerEntry` (append-only, hooks Mongoose bloquant explicitement update/delete/bulkWrite, y compris via `save()` sur document existant) est le seul vrai journal financier append-only du dépôt. `ActionLog` (générique, hors finance) existe pour d'autres domaines mais n'est **pas** utilisé comme journal financier — conforme au mandat §42 ("ne crée pas un nouveau système si ActionLog existe") : ici c'est l'inverse qui est vrai, un système dédié (`FinancialLedgerEntry`) existe déjà et ne doit pas être dupliqué par un usage détourné d'`ActionLog` pour la finance.

## 25. Idempotence

Robuste et cohérente uniquement au sein du Financial Core (`businessOperationKey`, `Idempotency-Key` header obligatoire sur les routes de mutation, `FinancialProviderEvent` pour les webhooks). Yabetoo hérite de cette robustesse pour ses deux webhooks. **Absente ou partielle ailleurs** : `Paiement` n'a aucune idempotence propre (mitigé par `RentalPaymentReceipt.idempotencyKey` pour les encaissements granulaires) ; `PaiementTransaction` a un index unique partiel `{transaction, methode}` qui protège contre les doublons de méthode ouverte mais pas contre un rejeu de webhook individuel côté CinetPay (Flux A) — **c'est précisément le trou exploité par la vulnérabilité §9**.

## 26. Webhooks

Trois webhooks de paiement identifiés, un seul correctement sécurisé (Yabetoo). Voir tableau complet `PAY1_PAYMENT_METHOD_MATRIX.md` et détail §9. Classement des risques :

| Webhook | Risque |
|---|---|
| CinetPay Flux A (`/api/paiements/webhook-cinetpay`) | **P0** — aucune authentification, écriture directe de statut payé, rejouable, notification déclenchable par un tiers |
| CinetPay Flux B (`/api/transactions/webhook/cinetpay`) | P3 — correctement sécurisé mais code mort documenté, risque de confusion/maintenance uniquement |
| Yabetoo (`/api/transactions/paiements/webhook`) | P3 — correctement sécurisé ; dépendance non vérifiée dans ce sprint : que `req.rawBody` soit bien peuplé avant parsing JSON (signalé, non confirmé ni infirmé) |
| Visites (absence de webhook) | P2 — pas un risque de sécurité, mais un risque opérationnel de statut bloqué sans réconciliation |

## 27. Security

Voir §9, §26. Point positif à noter : le Financial Core, quand il est utilisé (hôtel), ne permet à aucun `202`/`accepted` de devenir `succeeded` sans action serveur explicite (`confirmPayment`, capacité dédiée) — conforme au mandat §27. Ce n'est **pas** le cas du Flux A CinetPay, qui transforme un simple POST non authentifié directement en `payé`.

## 28. Tenant

`Paiement` est tenant-scopé via `assertResourceTenantOrUnattributed` (middleware `router.param('id', ...)` sur `/api/paiements/:id`). `FinancialPayment`/`FinancialDocument`/`PaymentAllocation`/`FinancialLedgerEntry` portent tous un champ `tenant` (optionnel, `default: null`). `/api/financial` applique `requireTenantScope` globalement. `PaiementTransaction`/`Transaction` : tenant scoping non identifié explicitement dans ce sprint (NON CONFIRMÉ — nécessiterait une vérification dédiée, hors profondeur atteinte ici).

## 29. IAM

Deux espaces de capacités distincts et non unifiés : `payments.read`/`payments.manage`/`payments.reverse` (loyer, `server/utils/iamArchitecture.js`, capacités par défaut `Secretaire`: read+manage, pas reverse ; `Admin`/`Collaborateur`: tout via wildcard/`legacy.full`) et `financial.*` (`financialAuthorizationService.js`, hôtel, capacités F2.6 par rattachement `HotelStaffAssignment`). **Pas de capacité unique "payments.reverse" équivalente côté transactions immobilières** — la validation de virement y est un `auth.restrictTo('Admin')` en dur, pas une capacité nommée. Aucun changement IAM effectué (conforme mandat §43).

## 30. Secrets

Noms de variables confirmés (jamais de valeur consultée) : `CINETPAY_API_KEY`, `CINETPAY_SECRET`, `CINETPAY_SITE_ID`, `YABETOO_API_URL`, `YABETOO_SECRET_KEY`, `YABETOO_WEBHOOK_SECRET`. Aucune variable `MTN_*`, `AIRTEL_*`, `PAYMENT_*`, `BANK_*`, `CARD_*`, `STRIPE_*`, `PAYPAL_*` n'existe nulle part dans le dépôt — confirme l'absence totale d'intégration pour ces providers.

## 31. Logging

`cinetpayController.js` logue `transaction_id`, `status`, `amount` et `userId` en clair via `console.log` — pas de secret/token/PAN, mais expose des identifiants de transaction en logs applicatifs standard (niveau de risque faible, cohérent avec le reste du dépôt). Aucun `console.log` de secret/signature/token trouvé dans les contrôleurs de paiement audités.

## 32. Reconciliation

**Existe uniquement pour le Financial Core** (`financialReconciliationService`, cycle `scan → plan → apply → verify`, CLI dry-run par défaut, `--apply` interdit en production sauf variable d'environnement explicite). **Absente pour tous les autres domaines** : pas de polling/cron pour CinetPay/Yabetoo côté loyer/vente, pas de tâche de rattrapage si un webhook est perdu (immobilier) ou si un client ne revient jamais vérifier (visites). C'est la cible future explicitement recommandée par le mandat §28 pour tout futur provider Mobile Money.

## 33. Refund/Reversal

`FinancialRefund` (Financial Core) et `accommodationRefundService` (hébergement) existent avec workflow `requested→approved→processing→succeeded/failed`. Immobilier : `Transaction.paymentStatus` a un statut `remboursé` mais **sans objet Refund associé** (statut seul, confirmé par F0 et revérifié). Loyer : aucun remboursement identifié. Reversal d'allocation : uniquement Financial Core (`PaymentAllocation.status: reversed`, append-only). `cancelReceipt` (loyer, `payments.reverse`) annule un reçu mais ce n'est pas un remboursement fournisseur, une annulation d'écriture interne.

## 34. Overpayment

Financial Core : `FINANCIAL_DOCUMENT_OVERPAYMENT` (erreur explicite), surplus confirmé non alloué reste visible (`UNALLOCATED_CONFIRMED_PAYMENT`), jamais absorbé silencieusement. Hébergement : `AccommodationReservation` a des champs `amountPaid`/`grossAmountPaid`/`remainingAmount` distincts suggérant une gestion de trop-perçu, non auditée en profondeur ce sprint. Loyer/vente : aucune notion de surpaiement formalisée trouvée.

## 35. Partial payment

Supporté explicitement par le Financial Core (`partially_paid`, plusieurs paiements peuvent solder une même facture). `RentalPaymentReceipt` supporte aussi le paiement partiel et le multi-échéance en un seul encaissement (F2.1 GL-DEBT-1.1). `PaiementTransaction` : un seul paiement "ouvert" par méthode à la fois (index unique partiel) — le partiel au sens strict n'est pas structurellement empêché mais n'est pas non plus un concept explicite dans ce modèle.

## 36. Currency

**XAF est la seule devise réellement utilisée en pratique** (défaut partout). Le Financial Core supporte formellement `XAF`/`EUR`/`USD` dans son enum mais F2.2 impose XAF obligatoire pour l'hôtel ; aucune conversion de devise n'existe nulle part. Cinq modèles (`Paiement`, `PaiementTransaction`, `Transaction`, `Contrat`, `Document`) n'ont **aucun champ devise du tout** — toute somme y est un `Number` nu supposé XAF par convention non vérifiée par le schéma.

## 37. Tests

Suite `server/__tests__` : 43 fichiers de test contiennent "financial"/"payment"/"paiement"/"transaction"/"webhook"/"hotel finance"/"rental payment" dans leur nom — couverture substantielle du Financial Core (unitaire + MongoDB réel + Replica Set) et de l'autorisation IDOR sur `PaiementTransaction`. **Trou de couverture confirmé et comblé partiellement ce sprint** : aucun test n'existait pour `cinetpayController.js:webhookCinetpay` (le flux vulnérable) avant ce sprint. Ajout : `server/__tests__/cinetpayWebhookCharacterization.test.js` (3 tests, caractérisation pure, aucune correction) prouvant par l'exécution le comportement actuel non sécurisé. Suite complète (`npm run test:unit`) : **118 suites, 1352 tests, tous verts** (117/1349 avant l'ajout).

## 38. Gaps

1. Webhook CinetPay actif non sécurisé (P0, §9/§26).
2. Aucune réconciliation hors Financial Core (P1, §32).
3. Devise absente sur 5 modèles historiques (P2, §36).
4. Payout propriétaire jamais exécuté, seulement calculé (P1 produit, §22).
5. Visites : deux statuts de paiement parallèles non synchronisés (P2, §21).
6. `AccommodationReservation` sans index unique d'idempotence propre (P2, §3).
7. Terminologie "location" ambiguë entre mise en location (Transaction) et loyer récurrent (Paiement) (P3, §19).

## 39. Bugs trouvés

Le webhook CinetPay Flux A (§9) est le seul bug de sécurité activement exploitable trouvé ce sprint. Aucun autre défaut fonctionnel critique découvert dans le périmètre audité (l'audit était en lecture, pas en test end-to-end complet de chaque flux).

## 40. Bugs corrigés (characterization-only)

Aucun — conformément au mandat §26, aucune correction automatique n'a été appliquée à la vulnérabilité CinetPay. Un test de caractérisation en preuve son comportement actuel a été ajouté (§37), pas un correctif.

## 41. Architecture cible

```
MOYEN DE PAIEMENT (MTN, Airtel, Visa/Mastercard, Virement, Espèces, Chèque, CinetPay, Yabetoo)
        ↓
PROVIDER / CHANNEL  (adaptateur par provider, contrat commun)
        ↓
FinancialPayment  (déjà existant — étendre son périmètre, pas le remplacer)
        ↓
PaymentAllocation  (déjà existant)
        ↓
FinancialDocument  (déjà existant)
        ↓
FinancialLedgerEntry  (déjà existant)
```

**Aucun nouveau moteur d'allocation, ledger ou modèle Payment n'est nécessaire.** Le Financial Core existant absorbe déjà tous les moyens de paiement listés dans le mandat, à condition d'étendre son périmètre (`domain` enum, adaptateurs) aux domaines immobilier/loyer/visites — travail déjà anticipé par ADR-FIN-007 mais non commencé.

## 42. Provider adapters

Proposition conceptuelle (non codée) :

```
PaymentProviderRegistry
        |
        +-- YabetooProvider        (existe déjà, à généraliser hors immobilier/visites)
        +-- CinetPayProvider       (existe déjà — Flux B à adopter comme unique flux, Flux A à retirer après sécurisation)
        +-- MTNDirectProvider      (hypothétique — seulement si Yabetoo s'avère insuffisant, décision produit §55)
        +-- AirtelDirectProvider   (idem)
        +-- CardGatewayProvider    (hypothétique — CinetPay carte NON CONFIRMÉ comme suffisant, à valider par contrat)
        +-- ManualBankTransferProvider  (existe déjà en substance, à formaliser comme adaptateur)
        +-- CashProvider           (existe déjà en substance)
```

Contrat conceptuel adapté aux capacités réelles observées (mandat §22) : `initiatePayment()` (CinetPay/Yabetoo seulement — les moyens manuels n'en ont pas besoin), `getPaymentStatus()` (Yabetoo seulement — CinetPay n'a pas de polling identifié dans le code), `verifyCallback()` (Yabetoo + CinetPay Flux B — pas Flux A, c'est justement le problème), `normalizeStatus()` (tous), `cancelPayment()` (NON CONFIRMÉ pour aucun provider externe actuel), `refundPayment()` (Financial Core/`FinancialRefund` seulement — ni CinetPay ni Yabetoo n'ont de remboursement provider observé dans le code).

## 43. Mobile Money roadmap

MTN/Airtel sont déjà actifs (§11-12). La roadmap n'est donc pas "intégrer MTN/Airtel" mais "étendre leur portée au domaine Hôtel via le Financial Core" — voir PAY-3/PAY-4 §49.

## 44. Card roadmap

Visa/Mastercard : absence totale de code. Cible recommandée : `Carte → PSP/Gateway → FinancialPayment`, jamais d'intégration directe au réseau de carte, jamais de stockage de PAN/CVV. CinetPay pourrait potentiellement couvrir ce besoin (`cinetpay_carte` existe déjà comme valeur), mais son périmètre exact (réseaux couverts, 3DS) est NON CONFIRMÉ par le code — nécessite un contrat CinetPay à obtenir avant tout sprint carte.

## 45. Bank transfer roadmap

Niveau A (manuel) déjà pleinement implémenté et fonctionnel dans 3 domaines sur 4 (§15). Niveau B (rapprochement bancaire automatisé) totalement absent — hors périmètre sauf demande produit future explicite (mandat §29).

## 46. Legacy migration strategy

Stratégie déjà actée par ADR-FIN-007 (Option 3) : nouveau domaine d'abord (fait, hôtel), observation, adaptateurs lecture, backfill optionnel en sprint séparé, dépréciation annoncée, retrait séparé. PAY-1 ne change rien à cette stratégie, la confirme simplement toujours valide au vu du code actuel.

## 47. Risks

| Risque | Sévérité |
|---|---|
| Webhook CinetPay actif falsifiable (paiement de loyer marqué payé sans preuve) | **P0** |
| Absence de réconciliation hors Financial Core (paiement Yabetoo/CinetPay perdu jamais rattrapé automatiquement) | P1 |
| Payout propriétaire jamais réellement exécuté malgré un calcul stocké (confusion possible côté produit/support) | P1 |
| Devise implicite non vérifiée sur 5 modèles historiques (risque latent si multi-devise introduite un jour) | P2 |
| Statuts de paiement de visite dupliqués et non synchronisés | P2 |
| `AccommodationReservation` sans idempotence propre | P2 |

## 48. Priorités P0/P1/P2/P3

- **P0** : sécuriser le webhook CinetPay actif (signature + idempotence), sans changer son URL/contrat côté CinetPay sans coordination — sprint dédié, hors PAY-1.
- **P1** : brancher une réconciliation minimale (polling/cron) pour Yabetoo visites et CinetPay loyer ; clarifier le produit du payout propriétaire (calculer n'est pas payer).
- **P2** : ajouter `currency` explicite aux modèles historiques lors de leur prochaine évolution ; unifier `visitFeeStatus`/`paiementStatus`.
- **P3** : retirer ou documenter formellement le Flux B CinetPay mort ; clarifier la terminologie "location".

## 49. Next sprint

- **PAY-2** — Hardening : sécuriser le webhook CinetPay actif en réutilisant exactement le mécanisme déjà prouvé du Flux B (HMAC + `FinancialProviderEvent`), migrer `/api/paiements/webhook-cinetpay` vers ce mécanisme sans changer son URL publique (déjà enregistrée chez CinetPay).
- **PAY-3** — Extension Yabetoo (MTN/Airtel) au domaine Hôtel via un adaptateur provider branché sur `FinancialPayment` (le provider existe déjà, seul le branchement hôtel manque).
- **PAY-4** — Réconciliation minimale visites/loyer (polling différé ou cron), sur le modèle `financialReconciliationService` déjà existant.
- **PAY-5** — Évaluation contractuelle carte (Visa/Mastercard) : obtenir la documentation officielle CinetPay avant tout code, confirmer ou infirmer sa couverture carte réelle.
- **PAY-6** — Formalisation de l'adaptateur virement bancaire (déjà fonctionnel en substance) comme `ManualBankTransferProvider` explicite dans le registre proposé §42.
- **PAY-7** — Décision produit sur MTN/Airtel direct vs agrégateur (mandat §55) — nécessite input commercial, pas seulement technique.
- **PAY-8** — Payout propriétaire : conception d'un flux réel (statut, preuve, audit), actuellement inexistant au-delà du calcul.
- **PAY-E2E** — Certification complète une fois PAY-2 à PAY-8 réalisés.

## 50. Git final

```
git status --short → inchangé côté server hors 1 nouveau fichier de test + 4 nouveaux rapports PAY-1
git diff --check → exit 0
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac (inchangé pendant tout le sprint)
```
Aucun `git add`/`commit`/`push`/déploiement/reset. Aucun appel externe réel effectué (MTN, Airtel, CinetPay production, carte, virement, email, SMS).

## 51. Verdict

**PAY-1 : AUDIT CERTIFIÉ.**

- Inventaire complet des modèles, routes, providers : ✅ (18 modèles, 4 routeurs, 2 providers réels + 2 absents confirmés + 2 "déjà présents via agrégateur" clarifiés).
- Matrices complètes : ✅ (`PAY1_PAYMENT_METHOD_MATRIX.md`, `PAY1_DOMAIN_MATRIX.md`).
- Architecture cible claire, sans nouveau système parallèle : ✅ (§41-42, Financial Core existant confirmé suffisant).
- Providers classifiés (ACTIVE/LEGACY/PARTIAL/ABSENT/NON CONFIRMÉ) : ✅.
- Gaps de sécurité classifiés par sévérité : ✅ (§47-48, P0 identifié et prouvé sans être corrigé).
- Aucune supposition non prouvée : chaque affirmation de ce rapport cite un fichier ou un test exécuté ; les points non vérifiables sont explicitement marqués NON CONFIRMÉ (tenant scoping `PaiementTransaction`, couverture carte CinetPay, rawBody Yabetoo).
- Test de caractérisation vert, aucun appel externe réel, aucun changement métier risqué, aucun commit/push/deploy : ✅.

Ce sprint ne certifie **pas** les paiements comme sûrs ou complets — il documente précisément où ils en sont et ce qu'il reste à faire, dans l'ordre de priorité proposé §48-49.
