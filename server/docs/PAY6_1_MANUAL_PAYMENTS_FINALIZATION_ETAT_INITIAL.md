# PAY-6.1 — État initial

## Périmètre audité

Audit du 2026-08-21 sur `FinancialPayment`, `PaymentAllocation`, `FinancialLedgerEntry`, les routes et contrôleurs financiers, la séquence financière, le stockage privé et le rendu PDF hôtelier.

## Constat avant correction

- PAY-6 créait et confirmait correctement les paiements manuels, puis PAY-3/F2.2 les allouait à une facture.
- `FinancialPayment.manualValidation` prévoyait déjà les champs de rejet, mais aucune transition métier ni route de rejet ne les alimentait.
- Aucun justificatif n'était rattaché au paiement Financial Core.
- Le stockage privé Cloudinary authentifié existait déjà et pouvait être réutilisé.
- `receipt` existait déjà dans les types et séquences financières (`REC`), mais aucun vrai reçu de paiement n'était produit.
- L'artefact PDF existant était exclusivement une facture officielle ; le réutiliser comme reçu aurait confondu deux documents comptables distincts.

## Décision

Conserver `FinancialPayment` comme unique paiement, ajouter un justificatif privé embarqué et un artefact `FinancialPaymentReceipt` un-à-un, immuable. Réutiliser la séquence Financial Core, PDFKit et le stockage privé existants. Aucun nouveau provider ni moteur de paiement.
