# PAY-4 — Matrice des statuts MTN MoMo

Basée exclusivement sur les statuts documentés/corroborés (`PENDING`, `SUCCESSFUL`, `FAILED` — voir `PAY4_MTN_MOMO_REPORT.md` §3-7). Aucun statut inventé.

| MTN status/response | Internal status (FinancialPayment) | Final ? | Allocation possible ? | Retry (RequestToPay) ? | Reconcile ? |
|---|---|---:|---:|---:|---:|
| HTTP 202 (RequestToPay acceptée) | `pending` | Non | Non | N/A — pas un statut, une réponse HTTP | N/A |
| HTTP ≠ 202 (RequestToPay) | (aucun `FinancialPayment` créé si l'appel échoue avant persistance ; sinon reste `pending`) | Non | Non | **Non** — jamais automatique (mandat §28), correction manuelle/réconciliation | Oui, via status inquiry sur la référence déjà réservée |
| `PENDING` (GetTransactionStatus) | `pending` | Non | Non | Non | Oui — nouvelle interrogation ultérieure |
| `SUCCESSFUL` | `succeeded` (via `confirmHotelPayment`, fonction canonique) | **Oui** | **Oui** | N/A | N/A (déjà résolu) |
| `FAILED` (+ `reason`, ex. `NOT_ENOUGH_FUNDS`) | `failed` (via `failHotelPayment`, nouvelle fonction PAY-4) | **Oui** | Non | Non — aucun nouveau paiement recréé automatiquement ; l'utilisateur doit relancer une **nouvelle** intention explicite (nouveau `businessOperationKey`) | N/A (déjà résolu) |
| Timeout réseau (RequestToPay) | `pending` (référence déjà réservée avant l'appel réseau) | Non | Non | **Interdit** (mandat §28) | **Oui — obligatoire**, seule voie de résolution |
| Erreur transport (`MTN_MOMO_PROVIDER_ERROR`, `MTN_MOMO_AUTH_FAILED`, etc.) | Selon le point d'échec : si avant la création du `FinancialPayment`, aucun effet ; si après, `pending` | Non | Non | Non | Oui si un paiement `pending` existe déjà |

## Règles absolues (verrouillées par test, pas seulement documentées)

- **202 ≠ confirmé** : `mtnMoMoClient.requestToPay` ne retourne jamais autre chose que `{ providerStatus: 'PENDING' }` sur un 202 — vérifié (`mtnMoMoClient.test.js`).
- **Aucune régression depuis un état terminal** : `reconcileMtnHotelPayment` sur un paiement déjà `succeeded` ne rappelle même pas MTN — vérifié (`mtnHotelPaymentBridge.test.js`).
- **`FAILED` après `SUCCESSFUL` déjà traité** : structurellement impossible à appliquer — `failHotelPaymentCore` refuse toute transition si le paiement n'est plus `pending` (retourne `{failed: false}` sans mutation si déjà `succeeded`, ne l'écrase jamais).
