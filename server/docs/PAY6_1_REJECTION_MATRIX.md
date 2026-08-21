# PAY-6.1 — Matrice rejet

| État / action | Résultat |
|---|---|
| pending manuel → reject avec motif valide | `failed` + `manualValidation.rejected` |
| pending → double reject | Une transition et un ledger ; second appel idempotent |
| pending → approve contre reject concurrent | Un seul état terminal gagne atomiquement |
| succeeded → reject | Refus 409 |
| failed/rejected → confirm | Refus 409 |
| provider automatique → reject manuel | Refus 409 |
| motif absent, < 3 ou > 500 caractères | Refus |

Le ledger `payment.rejected` conserve acteur, date ledger, montant, ancien/nouvel état et motif normalisé. Le rejet ne crée ni allocation ni reçu.
