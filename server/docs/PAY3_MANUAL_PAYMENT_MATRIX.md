# PAY-3 — Matrice des paiements manuels (first-class, Financial Core)

Périmètre : uniquement le domaine Hôtel, seul domaine où le Financial Core est aujourd'hui canonique (voir `PAY1_DOMAIN_MATRIX.md`). Les paiements manuels loyer (`Paiement`/`RentalPaymentReceipt`) et vente (`PaiementTransaction`) suivent un schéma manuel équivalent en substance mais dans leurs systèmes historiques respectifs — non migrés dans ce sprint (§25-26 du rapport).

| Étape | Cash | Bank Transfer | Cheque |
|---|---|---|---|
| Création | `POST /api/financial/hotel/payments` (staff, `financial.payment.create`) | idem | idem |
| Référence obligatoire | Non (méthode `cash`/`other` dispensées, voir F2.2) | **Oui** (`reference`) | **Oui** (`reference`) |
| Statut initial | `pending` (ou `succeeded` immédiat si `confirmed:true` à la création, même acteur) | `pending` | `pending` |
| Validation séparée | `POST /api/financial/payments/:id/confirm` (`financial.payment.confirm`) | idem | idem |
| Preuve jointe | Non requise (montant en main, reçu physique hors système) | Recommandée mais non bloquante dans F2.2 actuel (pas de champ `proof` dédié sur `FinancialPayment` — voir dette §16 du rapport) | idem virement |
| Qui peut créer | Admin, Collaborateur, Secretaire, manager d'hôtel rattaché | idem | idem |
| Qui peut confirmer | Admin, Collaborateur, Secretaire, manager d'hôtel rattaché — capacité `financial.payment.confirm` **distincte** de `financial.payment.create`, mais accordée aux mêmes rôles aujourd'hui (pas de séparation des pouvoirs stricte créateur/confirmateur dans le rôle par défaut, contrairement à la dérogation de check-out qui est Admin-only) | idem | idem |
| Qui peut consulter seulement | Proprietaire (rattaché à son hôtel) | idem | idem |
| Qui ne peut ni créer ni confirmer | Client, GestionnaireImmobilier, tout staff non rattaché à l'hôtel | idem | idem |
| Allocation à une facture | `POST /api/financial/payments/:id/allocations` (paiement `succeeded` requis) | idem | idem |
| Reversal | `POST /api/financial/hotel/allocations/:id/reverse` (motivé, idempotent) | idem | idem |
| Audit | `payment.created`/`payment.confirmed`/`payment.allocated`/`payment.allocation_reversed` dans `FinancialLedgerEntry`, append-only | idem | idem |

## Workflow confirmé (identique aux trois méthodes manuelles)

```
Staff autorisé
  → POST /payments (method=cash|bank_transfer|cheque, référence obligatoire hors cash)
  → FinancialPayment.status = pending (manualValidation.status = pending)
  → POST /payments/:id/confirm (capacité distincte, staff autorisé)
  → FinancialPayment.status = succeeded (manualValidation.status = approved)
  → POST /payments/:id/allocations (facture émise, même hôtel/réservation/devise)
  → PaymentAllocation créée, FinancialDocument.balanceMinor recalculé
```

Ce n'est **pas** un flux bricolé à côté du Financial Core — c'est exactement le même modèle (`FinancialPayment`), les mêmes capacités (`financialAuthorizationService`), le même ledger (`FinancialLedgerEntry`) que n'importe quel futur paiement automatique. Le mandat §5 (« manual payments ne doivent pas être des exceptions bricolées ») est déjà respecté par le code existant — confirmé par audit, pas construit par ce sprint.

## Écart avec le mandat §22 (preuve de paiement)

`FinancialPayment` n'a pas de champ dédié pour une preuve (image/PDF) de virement/chèque au niveau du Financial Core — contrairement à `PaiementTransaction.preuvePaiement` (vente/location) ou `Paiement.preuvePaiement` (loyer), qui utilisent déjà le pipeline d'actif privé existant (`privateAssetSchema`, Cloudinary non public). C'est un manque réel côté hôtel, documenté comme dette (§16 du rapport), non comblé dans ce sprint (le mandat interdit de créer une exposition publique Cloudinary sans réutiliser le pipeline existant, et l'ajouter correctement nécessite un sprint dédié au modèle `FinancialPayment` et à ses routes).
