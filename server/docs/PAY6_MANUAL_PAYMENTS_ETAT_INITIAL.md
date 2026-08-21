# PAY-6 — Paiements manuels — État initial

Baseline : `main`, HEAD `15506a7b113742ad266cc5977ff06164b6c04994`. Le worktree contient PAY-5 non commité, préservé. `git diff --check` vert.

## Inventaire

| Fonction | État initial | Preuve |
|---|---|---|
| Cash | ACTIVE | `method=cash`, `provider=manual`, F2.2 |
| Virement | PARTIAL | `bank_transfer`, référence obligatoire, pending/confirm/allocation ; aucune preuve privée |
| Chèque | PARTIAL | `cheque`, référence obligatoire, même workflow ; aucune preuve/rejet |
| Validation | ACTIVE | capability `financial.payment.confirm`, transition atomique pending→succeeded |
| Rejet | ABSENT pour manuel | modèle prêt (`manualValidation.rejected*`), aucun service/endpoint |
| Reversal | PARTIAL | reversal append-only des allocations, pas annulation physique du paiement |
| Reçu paiement | ABSENT | séquence `receipt` existe, mais moteur actif = facture PDF officielle |
| Preuve | ABSENT | aucun private asset relié à `FinancialPayment` |

Le modèle canonique est réutilisable ; aucun nouveau modèle n'est nécessaire. Les rôles finance prouvés sont Admin, Collaborateur et Secretaire pour création/confirmation ; Proprietaire est lecture seule.
