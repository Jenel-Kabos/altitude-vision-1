# Matrice finale des effets de bord

| Action | Reservation | Availability | Invoice | Finance | Notification | Other |
|---|---|---|---|---|---|---|
| confirm autorisé | confirmed + historique | locks créés | créée | comportement historique | historique | aucun changement de règle |
| confirm cross-tenant | intacte | aucun lock | aucune | 0 document/payment/allocation/ledger | aucune | accommodation intact |
| cancel autorisé | cancelled + historique | locks libérés | n/a | historique | historique | timestamps historiques |
| cancel cross-tenant | intacte | locks intacts | aucune nouvelle | 0 document/payment/allocation/ledger | aucune | accommodation intact |
| check-in autorisé | checked_in + historique | inchangée | n/a | historique | historique | timestamp historique |
| check-in cross-tenant | intacte | inchangée | aucune nouvelle | 0 document/payment/allocation/ledger | aucune | accommodation intact |
| check-out autorisé | checked_out + historique | inchangée | n/a | historique | historique | aucun flux housekeeping Accommodation déclenché par ce handler |
| check-out cross-tenant | intacte | inchangée | aucune nouvelle | 0 document/payment/allocation/ledger | aucune | accommodation intact |
| no-show autorisé | no_show + historique | locks libérés | n/a | historique | historique | règle historique |
| no-show cross-tenant | intacte | locks intacts | aucune nouvelle | 0 document/payment/allocation/ledger | aucune | accommodation intact |

Email/webhook/Cloudinary ne sont pas appelés par ce handler. Le refus se produit avant `service.transition()`, donc avant facture, notification et journal d'action de transition.

