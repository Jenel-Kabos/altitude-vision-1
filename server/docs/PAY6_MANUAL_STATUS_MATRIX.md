# PAY-6 — Matrice statuts manuels

| État métier | FinancialPayment | manualValidation | Allocation |
|---|---|---|---|
| Déclaré | `pending` | `pending` | interdite |
| Validé | `succeeded` | `approved` | autorisée |
| Rejeté | cible `failed` | `rejected` | aucune — NON IMPLÉMENTÉ |
| Allocation renversée | paiement inchangé | inchangé | `reversed`, ledger compensateur |

Aucun nouvel enum n'est requis. Une preuve éventuelle ne doit jamais modifier ces statuts.
