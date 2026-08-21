# PAY-6.1 — Matrice reçu de paiement

| Cas | Résultat |
|---|---|
| Paiement pending/failed | Refus 409 |
| Paiement succeeded sans allocation active | Refus 409 |
| Paiement succeeded et alloué | PDF privé créé |
| Paiement partiellement affecté | Montant payé exact + ventilation exacte des allocations actives |
| Deux générations concurrentes | Index unique paiement ; un seul reçu stable |
| Nouvelle demande | Retour du même numéro/artefact |
| Renversement d'allocation ultérieur | Reçu historique conservé et inchangé |
| Tentative update/delete | Bloquée par le modèle append-only |

Le numéro utilise `FinancialSequence`, type `receipt`, préfixe `REC`. Le reçu est un `FinancialPaymentReceipt`, pas une facture et pas un second paiement. Il contient la référence, méthode, devise, montant du paiement et snapshot des affectations.
