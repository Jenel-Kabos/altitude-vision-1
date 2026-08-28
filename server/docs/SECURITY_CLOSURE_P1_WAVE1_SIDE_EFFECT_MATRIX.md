# SECURITY-CLOSURE-P1-WAVE-1 — Matrice des effets de bord (refus cross-tenant/cross-ressource)

| Lot | Effet de bord vérifié | Résultat sur refus | Preuve |
|---|---|---|---|
| P1-A | Données Contrat exposées | Filtrées côté requête (liste) | test 1 |
| P1-J | Locataire/Proprietaire exposés | Filtrés côté requête | tests 1, 5 |
| P1-B | `Visite.notes`/`paiementStatus` | Inchangés sur refus | tests 5, 6 |
| P1-C | `Litige.statut`/`Signalement.statut` | Inchangés sur refus | tests 3, 7 |
| P1-D | `Application.status` | Inchangé (`submitted`) sur refus | test 3 |
| P1-E | `Property.title` (via `updateFull`) | Inchangé sur refus | test 1 |
| P1-F | `Property.title` (vente/location) | Inchangé sur refus | tests 1, 3 |
| P1-G | `Property.assetCycle` | Inchangé sur refus | test 1 |
| P1-H | `HotelStaffAssignment.status` | Reste `active` sur tentative de suspension/révocation cross-hôtel | tests 2, 3 |
| P1-I | `Transaction.status`, `PaiementTransaction` créé | Inchangé / aucun document créé sur refus | tests 5, 6 |

## Effets de bord sur accès AUTORISÉ (comportement historique préservé)

| Lot | Effet de bord | Résultat | Preuve |
|---|---|---|---|
| P1-C | `Litige.staffViewedAt`/`statut` mis à jour | Comportement historique inchangé | test 4 |
| P1-D | `Application.status → under_review` | Comportement historique inchangé | test 4 |
| P1-E | `Property.title` mis à jour | Comportement historique inchangé | test 2 |
| P1-F | `Property.title` mis à jour (vente/location) | Comportement historique inchangé | tests 2, 4 |
| P1-G | `Property.assetCycle` transitionné | Comportement historique inchangé | test 2 |
| P1-H | `HotelStaffAssignment` consulté/suspendu | Comportement historique inchangé | test 4 |
| P1-I | `Transaction.status → Annulée`, réservation libérée | Comportement historique inchangé | test 7, `transactionCancellationReleasesReservation` |

## Note sur les mutations financières (P1-C, P1-I)

Pour les deux lots impliquant des mutations financières/sensibles (encaissement de virement/espèces via P1-I, preuves de litige via P1-C), la vérification d'autorité intervient systématiquement AVANT toute écriture — confirmé par les tests dédiés (`PaiementTransaction.countDocuments` = 0 sur refus, `Litige.statut` inchangé sur refus), jamais après.
