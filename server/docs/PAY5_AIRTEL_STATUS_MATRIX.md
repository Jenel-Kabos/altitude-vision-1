# PAY-5 — Airtel Money — Matrice de statuts

| Airtel status réel | Statut Financial canonique | Action |
|---|---|---|
| **NON CONFIRMÉ** | aucun mapping | Échec fermé `FINANCIAL_PROVIDER_STATUS_UNKNOWN` |

Aucun statut Airtel réel n'a pu être extrait d'une documentation officielle accessible. Les anciennes valeurs `pending`, `success`, `failed` et `cancelled` du registre PAY-3 n'étaient associées à aucune source et ont été retirées.

Invariant futur : un statut inconnu ne devient jamais `succeeded`. Une acceptation HTTP ou un callback non corroboré ne devra jamais confirmer un `FinancialPayment`.
