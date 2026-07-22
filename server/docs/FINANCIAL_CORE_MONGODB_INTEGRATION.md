# Noyau financier — intégration MongoDB F1.1/F1.1B

## Environnement

Les suites réelles utilisent `MONGODB_FINANCIAL_INTEGRATION_URI` ou démarrent automatiquement `MongoMemoryReplSet` 10.2 avec `wiredTiger`. La base porte un nom temporaire unique, les index sont synchronisés, les collections sont vidées entre scénarios, puis Mongoose et le Replica Set sont fermés. Aucun test n’est sauté si MongoDB est indisponible : la suite échoue explicitement.

Commandes :

```bash
npm run test:finance:mongo
npm run test:finance:replica
npm run test:finance:resilience
```

## Matrice de concurrence

| Opération | Charge couverte | Invariant |
|---|---:|---|
| Séquence | 100 incréments | unicité par scope, continuité non garantie |
| Émission | 20 appels avec clés identiques/différentes, plus 50 appels sur 10 brouillons | une transition par brouillon, numéros uniques, un journal |
| Brouillon hôtelier | 30 appels | un document, une ligne snapshot, un journal |
| Allocation | 10 factures distinctes et campagne de 100 allocations sur 10 couples | aucun solde négatif, somme conservée |
| Renversement | 20 appels avec clés identiques puis différentes | une restitution et une contre-écriture |
| Événement fournisseur | 100 appels dupliqués | un événement persisté, 99 résultats idempotents |

Les chemins `transactional`, `fallback` et `auto` sont explicites. Les checkpoints de panne ne s’exécutent que si `NODE_ENV=test` et qu’un injecteur interne est transmis directement au service. Les contrôleurs ne recopient aucun champ d’injection depuis le body.

## Matrice de pannes

| Opération | Checkpoints | Transaction | Fallback |
|---|---|---|---|
| Brouillon | après document, avant/après lignes, avant journal | rollback | suppression document/lignes |
| Émission | avant/après séquence, avant/après document, avant/après journal | rollback | trou de séquence possible, scan requis |
| Allocation | avant/après réservation paiement/document, avant/après allocation, avant/après journal | rollback | mises à jour conditionnelles et compensation |
| Renversement | après verrou, avant paiement/document/journal, après journal | rollback | état intermédiaire détectable |

Une compensation qui échoue retourne `FINANCIAL_COMPENSATION_FAILED`, conserve `businessOperationKey`, produit un log `financial.compensation.failed` et impose une réconciliation.

Chaque checkpoint transactionnel de cette matrice est exécuté par la suite de résilience et vérifie l'absence de document, allocation, agrégat ou journal partiellement persisté. Le scan final de charge accepte uniquement les journaux et séquences volontairement absents des fixtures créées directement ; aucune anomalie d'agrégat ou d'allocation inattendue n'est tolérée.

L'index distant des paiements est unique uniquement lorsque `providerPaymentId` est une chaîne. Les paiements manuels sans identifiant fournisseur peuvent ainsi coexister, tandis que les identifiants effectivement fournis restent uniques par fournisseur.

F1.1C vérifie dix paiements manuels sans identifiant, les valeurs absente/null, le refus des chaînes vides, espaces seuls et nombres, le conflit d'un même identifiant pour un même fournisseur et son autorisation pour deux fournisseurs distincts. La réservation est revérifiée après lecture et avant toute écriture financière; une panne fallback après création du document supprime document et lignes.

Les checkpoints fallback d'émission, brouillon, allocation et renversement sont exercés avec état persistant, relance, scan, plan et correction limitée aux agrégats. Un journal historique absent n'est jamais inventé : l'anomalie reste non réparable.

## Append-only

Les hooks bloquent `save`, `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `findOneAndReplace`, les suppressions par query et `bulkWrite`. Ils ne peuvent pas empêcher un administrateur MongoDB ou un appel direct à `Model.collection`; les droits MongoDB restent la frontière ultime. Seul `financialLedgerService` doit créer des entrées applicatives.
