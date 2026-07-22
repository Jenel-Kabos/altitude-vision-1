# Financial Core — Implémentation Sprint F1

## Durcissement F1.1 — MongoDB réel, concurrence et réconciliation

La fermeture F1.1B et ses matrices détaillées sont documentées dans `FINANCIAL_CORE_MONGODB_INTEGRATION.md` et `FINANCIAL_CORE_RECONCILIATION.md`.

F1.1 valide le noyau sur un véritable MongoDB Replica Set. Les suites `*.mongo.integration.test.js` et `*.replica.integration.test.js` utilisent l’URI isolée `MONGODB_FINANCIAL_INTEGRATION_URI` lorsqu’elle est fournie ; sinon `MongoMemoryReplSet` démarre une base temporaire unique, synchronise les index financiers, vide les collections entre scénarios puis ferme connexion et processus MongoDB. Une URI partagée ou de production ne doit jamais être fournie à ces suites destructrices.

```bash
npm run test:finance:unit
npm run test:finance:mongo
npm run test:finance:replica
npm run finance:reconcile -- --dry-run --domain=hotel --establishmentId=<id>
```

Les index sont contrôlés depuis `collection.indexes()` et non depuis le seul schéma Mongoose. Les campagnes couvrent les vraies erreurs `E11000`, l’incrément atomique concurrent, les réservations conditionnelles, l’append-only réel et les transactions commit/rollback. Les collisions interceptées par les services deviennent des codes stables (`FINANCIAL_IDEMPOTENCY_CONFLICT`, `FINANCIAL_DUPLICATE_DOCUMENT`, `FINANCIAL_DUPLICATE_ALLOCATION`, `FINANCIAL_SEQUENCE_CONFLICT`) ; le détail MongoDB brut n’est pas destiné aux clients.

### Stratégies multi-documents

```mermaid
flowchart LR
  C[Appel financier] --> M{transactionMode}
  M -->|transactional| T[session.withTransaction]
  T -->|succès| K[commit]
  T -->|erreur| R[rollback intégral]
  M -->|fallback, défaut compatible F1| F[mises à jour conditionnelles]
  F --> X[compensation explicite si écriture suivante échoue]
  X --> A[audit/réconciliation]
```

`transactional` exige un Replica Set et ne masque jamais son indisponibilité. `fallback` préserve le déploiement F1 existant sans prétendre fournir une atomicité multi-collections. `auto` tente une transaction et ne bascule que pour une erreur MongoDB identifiée comme absence de support transactionnel. Les logs structurés exposent le nom d’opération, la stratégie, le commit ou rollback et un code d’erreur, sans payload ni donnée client.

L’unicité des numéros est garantie dans le scope domaine + établissement + numéro. La continuité absolue ne l’est pas : une séquence consommée avant un échec peut laisser un trou, ce qui est volontairement distinct d’un doublon.

### Réconciliation contrôlée

`financialReconciliationService` suit le cycle `scan → plan → apply → verify`. Les allocations actives sont la source de vérité des agrégats de paiement et d’allocation d’une facture. Le scan ne contient aucune donnée personnelle. Le plan ne répare que `amountAllocatedMinor`, `balanceMinor`, `paymentStatus`, `allocatedAmountMinor` et `availableAmountMinor`; il ne crée ni paiement ni allocation, ne supprime rien et ne réécrit aucune ligne comptable émise. Chaque correction ajoute une entrée `financial.reconciliation_applied` au journal.

La CLI est en dry-run par défaut et n’est exposée par aucune route HTTP. `--apply` est explicite. En production, il est refusé sauf avec `FINANCIAL_RECONCILIATION_ALLOW_PRODUCTION=true`; cette garde ne remplace pas une sauvegarde et une validation opérateur. Filtres disponibles : `--domain=<domaine>` et `--establishmentId=<id>`. Ajouter `--transactional` à un apply pour imposer le chemin Replica Set.

Le journal est protégé contre les mutations Mongoose par requêtes et par `document.save()`. Un administrateur MongoDB utilisant directement `Model.collection` conserve techniquement la capacité de contourner les hooks : les droits de base et la convention « seul `financialLedgerService` écrit le journal » restent donc nécessaires.

Statut : implémenté, en attente de validation fonctionnelle. Les décisions ADR FIN-001 à FIN-007 sont `Accepted`. La fiscalité, les mentions légales et la règle locale de numérotation restent ouvertes.

## Périmètre

F1 livre les fondations serveur sans fournisseur réel, PDF, email de facture, remboursement, crédit, accès public invité ni interface de caisse. Les modèles legacy et le moteur hôtelier sont inchangés.

```mermaid
flowchart LR
  Routes[/api/financial] --> Auth[FinancialAuthorizationService]
  Auth --> Hotel[HotelBillingAdapter]
  Auth --> Docs[FinancialDocumentService]
  Auth --> Pay[FinancialPaymentService]
  Auth --> Alloc[PaymentAllocationService]
  Hotel & Docs & Pay & Alloc --> Money[MoneyService]
  Hotel & Docs & Pay & Alloc --> Ledger[FinancialLedgerService]
  Docs --> Seq[FinancialSequenceService]
```

## Modèles et relations

| Modèle | Rôle | Index structurants |
|---|---|---|
| `FinancialDocument` | facture/proforma/avoir/reçu séparé de `Document` | établissement+statut, numéro par établissement, sujet, clé métier unique |
| `FinancialDocumentLine` | lignes séparées, quantités entières F1 | document+numéro de ligne unique, source métier |
| `FinancialSequence` | compteur atomique à l'émission | domaine+type établissement+établissement+type document+année unique |
| `FinancialPayment` | registre commun, manuel dans F1 | référence par établissement, ID fournisseur, sujet |
| `PaymentAllocation` | relation paiement-facture | paiement, facture, clé métier par établissement unique |
| `FinancialLedgerEntry` | audit append-only | chronologie établissement, chronologie entité, opération+événement unique |
| `FinancialProviderEvent` | réservation idempotente d'un événement | fournisseur+ID événement unique |

```mermaid
erDiagram
  FINANCIAL_DOCUMENT ||--|{ FINANCIAL_DOCUMENT_LINE : contains
  FINANCIAL_DOCUMENT ||--o{ PAYMENT_ALLOCATION : receives
  FINANCIAL_PAYMENT ||--o{ PAYMENT_ALLOCATION : funds
  FINANCIAL_DOCUMENT ||--o{ FINANCIAL_LEDGER_ENTRY : audited
  FINANCIAL_PAYMENT ||--o{ FINANCIAL_LEDGER_ENTRY : audited
```

Les relations métier utilisent des enums fermés. F1 active `domain=hotel`, `establishmentType=Hotel`, `subjectType=HotelReservation`. Aucun type libre du frontend n'est utilisé pour établir une relation.

## Monnaie

Tous les nouveaux montants sont des unités mineures `Number.isSafeInteger`. XAF a zéro décimale ; EUR/USD en ont deux. Les chaînes, décimaux, NaN, infinis, valeurs hors plage et négatifs non autorisés sont rejetés.

`moneyService` centralise validation, addition, soustraction, multiplication entière, pourcentage en points de base, allocation proportionnelle et formatage. La règle de pourcentage F1 est l'arrondi à l'entier le plus proche, moitié vers le haut pour les montants positifs. La distribution proportionnelle attribue les restes selon les plus grands restes puis l'ordre d'entrée ; la somme est strictement conservée.

## Calcul des lignes et factures

```text
lineSubtotalMinor = unitAmountMinor × quantity
lineTotalMinor = lineSubtotalMinor - discountAmountMinor
                 + taxAmountMinor + feesAmountMinor
documentTotalMinor = somme(lineTotalMinor)
balanceMinor = totalMinor - allocations actives nettes
```

Les totaux envoyés par le client sont ignorés. Les lignes sont recalculées côté serveur. La remise ne peut dépasser le sous-total. Les quantités F1 sont entières : nuitées, chambres et extras unitaires. Les quantités fractionnaires sont reportées.

## Cycle documentaire

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> issued
  draft --> cancelled
  draft --> void
  issued --> cancelled
  issued --> credited
  issued --> void
```

`unpaid`, `partially_paid`, `paid`, `overpaid` sont dérivés des allocations et ne sont pas des transitions documentaires. Les lignes et champs comptables ne sont modifiables que via les services de brouillon. Après émission, `replaceDraftLines` et le recalcul de brouillon refusent la mutation.

L'émission recharge les lignes, recalcule les totaux, incrémente atomiquement la séquence et applique une mise à jour conditionnelle `status=draft`. Un double appel retourne la facture déjà émise. Sans Replica Set garanti, une course peut consommer un numéro non utilisé ; elle ne peut pas attribuer deux numéros à la même facture. L'absence de trous reste une question légale ouverte.

## Numérotation

Format technique F1 : `<préfixe>-<code établissement>-<année>-<6 chiffres>`. Préfixes techniques par défaut : `FAC`, `AVO`, `PRO`, `REC`. Ils restent configurables. Aucun numéro n'est attribué au brouillon.

## Paiements et allocations

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> processing
  pending --> cancelled
  processing --> succeeded
  processing --> failed
  processing --> cancelled
  succeeded --> partially_refunded
  succeeded --> refunded
  partially_refunded --> refunded
```

F1 crée uniquement des paiements manuels. Une allocation exige paiement `succeeded`, facture `issued`, même domaine, établissement et devise. Elle ne dépasse ni le disponible du paiement ni le solde de facture.

Le service réserve d'abord le disponible du paiement par `$inc` conditionnel, puis le solde de facture. Si la seconde réservation échoue, la première est compensée. Une clé métier unique empêche la double allocation logique. Cette stratégie fonctionne sans transaction Mongo, mais une interruption entre une écriture et sa compensation requiert une future tâche de réconciliation. Avec Replica Set confirmé, F2 pourra envelopper ces écritures dans une transaction.

Le renversement marque l'allocation `reversed`, restitue les agrégats et écrit une contre-écriture. Aucune allocation n'est supprimée.

## Journal et idempotence

Le seul point d'écriture du journal est `appendFinancialLedgerEntry`. Le schéma bloque les opérations update/delete Mongoose. Les corrections utilisent de nouvelles entrées. Les métadonnées retirent récursivement clés, jetons, signatures, secrets, payloads et métadonnées fournisseur.

`FinancialProviderEvent` conserve un hash SHA-256 du payload, jamais le payload brut. L'index `provider+providerEventId` retourne l'événement existant en doublon. Aucun webhook réel n'est exposé en F1.

## Autorisations

- manager/propriétaire : accès uniquement à ses hôtels ; création/édition/lecture de brouillon ;
- `Admin` : portée globale ; les autres rôles doivent être manager explicite tant qu'aucune affectation Staff→Hotel n'existe ;
- capacité comptable F1 : `Admin`, `Collaborateur`, `Secretaire` ; émission, paiement manuel, allocation, reversal, journal ;
- admin ne contourne ni états ni immutabilité ;
- les rôles dédiés réceptionniste/comptable n'existent pas encore dans `User` et devront faire l'objet d'une évolution séparée.

Chaque endpoint recharge la ressource puis l'hôtel correspondant. Les `domain`, `establishmentId`, totaux, `issuedBy` et champs sensibles envoyés arbitrairement sont ignorés ou remplacés par les valeurs serveur.

## API staff

| Méthode | Route | Usage |
|---|---|---|
| POST | `/api/financial/hotel/reservations/:reservationId/invoice-draft` | brouillon principal idempotent |
| GET | `/api/financial/documents/:documentId` | projection facture et lignes |
| PATCH | `/api/financial/documents/:documentId/draft` | remplacement/recalcul des lignes |
| POST | `/api/financial/documents/:documentId/issue` | émission idempotente |
| POST | `/api/financial/payments/manual` | paiement manuel F1 |
| POST | `/api/financial/allocations` | allocation |
| POST | `/api/financial/allocations/:allocationId/reverse` | reversal motivé |
| GET | `/api/financial/documents/:documentId/ledger` | audit filtré |

Toutes les routes utilisent JWT. Les projections excluent `guestAccess.tokenHash`, `providerMetadata`, détails de validation manuelle et métadonnées du journal.

## Adaptateur hôtel

Une seule facture principale est permise par réservation via `hotel-reservation-primary-invoice:<id>`. Le brouillon copie le client, le vendeur, les dates, la devise, le tarif unitaire, les nuits, chambres, remise, taxes et frais du snapshot `HotelReservation`. Il ne consulte pas le `RatePlan` courant et n'est pas créé automatiquement.

## Erreurs métier

Les erreurs exposent un code stable et un message filtré : `FINANCIAL_INVALID_AMOUNT`, `FINANCIAL_CURRENCY_MISMATCH`, `FINANCIAL_DOCUMENT_IMMUTABLE`, `FINANCIAL_DOCUMENT_NOT_ISSUED`, `FINANCIAL_PAYMENT_NOT_AVAILABLE`, `FINANCIAL_OVERALLOCATION`, `FINANCIAL_INVALID_TRANSITION`, `FINANCIAL_ESTABLISHMENT_MISMATCH`, `FINANCIAL_UNAUTHORIZED`, `FINANCIAL_SEQUENCE_ERROR`. Les conflits d'index sont traités comme idempotence lorsqu'ils correspondent à une clé métier connue.

## Limites reportées

- aucune fiscalité ou mention légale configurée ;
- aucun fournisseur réel, webhook, remboursement ou crédit ;
- accès invité seulement préparé dans le schéma ;
- aucun PDF, email, notification ou frontend ;
- pas de folios multiples ni quantités fractionnaires ;
- pas de transaction Mongo obligatoire tant que le Replica Set n'est pas garanti ;
- pas de migration ou double écriture legacy ;
- pas de blocage financier du check-out.

## F1.1 Final Validation Matrix

| Domaine | Transaction | Fallback | Relance | Réconciliation | Statut |
|---|---|---|---|---|---|
| Brouillon hôtelier | rollback complet | suppression document/lignes | recréation sans doublon | orphelins détectés | validé |
| Émission | rollback complet | trou de séquence admis, état partiel signalé | aucun second numéro | journal absent critique | validé |
| Allocation | rollback complet | mutations conditionnelles/compensation | agrégats réparés avant relance | agrégats seuls réparables | validé |
| Renversement | rollback complet | état renversé sans double restitution | même clé sans double effet | agrégats dérivés réparables | validé |
| Événement fournisseur | index unique | résultat duplicate stable | même événement retourné | aucun effet implicite | validé |

La campagne métier crée directement uniquement utilisateurs, hôtels et réservations. Documents, lignes, séquences, paiements, allocations et journaux passent par les services publics internes; son scan final est vide.

Le dépôt ne possède aucune relation Staff→Hotel. L'isolation Owner A/Owner B est validée. L'affectation fine Staff A/Staff B est formellement reportée à un sprint RBAC séparé; elle n'est ni simulée ni annoncée comme implémentée.
