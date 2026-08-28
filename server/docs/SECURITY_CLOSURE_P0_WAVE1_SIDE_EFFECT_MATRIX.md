# SECURITY-CLOSURE-P0-WAVE-1 — Matrice des effets de bord (refus cross-tenant)

| Lot | Effet de bord vérifié | Résultat sur refus | Preuve |
|---|---|---|---|
| P0-A | `Message` créé | Aucun | test 1, 11 |
| P0-A | `Conversation.lastMessage`/`unreadCount` | Inchangé | test « effet de bord » |
| P0-A | Notification / Socket emit | Jamais atteint (le throw précède ces appels) | Analyse de code (l'appel intervient après `assertConversationAccess`) |
| P0-B | Données exposées | Filtrées côté requête (jamais transmises) | tests 1-4 |
| P0-C | `Paiement.statut`/`montantRecu` | Inchangé | test 6, 8 |
| P0-C | `RentalPaymentReceipt` créé | Aucun | test 9 |
| P0-C | Mutation partielle sur lot mixte A+B | Aucune (ni A ni B) | test 8 |
| P0-D | `Contrat.cycleVie`/`statut` | Inchangé | test 2 |
| P0-D | `Contrat.cautionVersee`/`caution.statut` | Inchangé | test 3 |
| P0-D | Notification staff (`notifyStaff`) | Jamais atteint (le throw précède la mutation) | Analyse de code |
| P0-E | `Property.statusAdmin`/existence | Property B préservée (non supprimée) | test 5 |
| P0-E | Hard-delete | Bloqué avant `findByIdAndDelete` | test 5 |

## Effets de bord sur accès AUTORISÉ (comportement historique préservé)

| Lot | Effet de bord | Résultat | Preuve |
|---|---|---|---|
| P0-A | `Message` créé, `Conversation` mise à jour, notification/Socket émis | Comportement historique inchangé | test 4, 12 |
| P0-C | `Paiement.statut → 'payé'`, `RentalPaymentReceipt` créé | Comportement historique inchangé | test 7 |
| P0-D | `Contrat.cycleVie` transition, `cautionVersee → true` | Comportement historique inchangé | test 1, 4 |
| P0-E | `Property` supprimée (son propre tenant) | Comportement historique inchangé | test 6 |
