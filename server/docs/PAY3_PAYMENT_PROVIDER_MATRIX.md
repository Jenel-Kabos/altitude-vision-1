# PAY-3 — Matrice des providers de paiement

| Method | Provider | Automatic | Manual Validation | Webhook | Reconcile | Target | Intégré au Financial Core |
|---|---|---:|---:|---:|---:|---|---:|
| Cash / Bank Transfer / Cheque / Other | `manual` | non | oui (`manualValidation.status`) | non | manuel (revue staff) | National | **Oui** — déjà en production (F2.2) |
| Mobile Money | `mtn_direct` | oui (cible) | non | à construire | à construire | National | Non — scaffolding registre uniquement, `FINANCIAL_PROVIDER_NOT_IMPLEMENTED` |
| Mobile Money | `airtel_direct` | oui (cible) | non | à construire | à construire | National | Non — idem `mtn_direct` |
| Mobile Money | `yabetoo` | oui (déjà réel, hors Financial Core) | non | existant (`PaiementTransaction`/`Visite`) | non existant | International | Non — actif ailleurs (voir §11), pas branché sur `FinancialPayment` |
| Carte (Visa/Mastercard) | `card_psp` | oui (cible) | non | à construire | à construire | National/International | Non — aucun PSP choisi, scaffolding registre uniquement |

## Colonnes

- **Automatic** : le paiement peut-il être confirmé par un événement fournisseur sans intervention humaine ? (`manual` = non, par construction — c'est tout l'intérêt du provider manuel)
- **Manual Validation** : une confirmation humaine explicite est-elle requise avant que `FinancialPayment.status` passe à `succeeded` ?
- **Webhook** : un mécanisme de réception d'événement fournisseur existe-t-il, et est-il sécurisé (signature vérifiée) ?
- **Reconcile** : un mécanisme de rattrapage (polling/cron) existe-t-il si l'événement fournisseur est perdu ?
- **Target** : national (opérateur direct Congo-Brazzaville) vs international (agrégateur, corridors).
- **Intégré au Financial Core** : le provider écrit-il réellement dans `FinancialPayment`/`PaymentAllocation` aujourd'hui ? (Distinct de « le provider fonctionne quelque part dans le dépôt » — Yabetoo fonctionne réellement, mais pas ici.)

## Constat central

**Aucun provider automatique n'écrit aujourd'hui dans le Financial Core.** Le seul provider réellement branché sur `FinancialPayment` est `manual`. `mtn_direct`/`airtel_direct`/`card_psp` sont des entrées du registre (`paymentProviderRegistry.js`) déclarant leurs capacités futures et levant systématiquement `FINANCIAL_PROVIDER_NOT_IMPLEMENTED` — aucun risque, aucun secret, aucun appel réseau. `yabetoo` fonctionne réellement mais dans un système parallèle (`PaiementTransaction`/`Visite`), pas dans le Financial Core — sa convergence éventuelle est documentée (§11 du rapport) mais non codée dans ce sprint.
