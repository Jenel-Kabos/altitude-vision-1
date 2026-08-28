# Matrice des effets de bord

| Operation | Block | Availability | Reservation | Finance | Notification | Other |
|---|---|---|---|---|---|---|
| Authorized same-tenant read | aucun changement | lecture | lecture calendrier | 0 | 0 | 0 |
| Authorized same-tenant create | créé | période bloquée/night lock selon contrat | 0 | 0 | comportement existant | audit existant |
| Authorized same-tenant delete | supprimé | night lock libéré selon contrat | 0 | 0 | comportement existant | audit existant |
| Denied cross-tenant read | 0 | 0 | 0 | 0 | 0 | 0 |
| Denied cross-tenant create | 0 | 0 | 0 | 0 | 0 | 0 email/webhook/audit mutation |
| Denied cross-tenant delete | 0 | 0 | 0 | 0 | 0 | 0 email/webhook/audit mutation |

Les tests prennent des snapshots/compteurs sur block cible, collection blocks, night locks, réservations, Accommodation, notifications, documents financiers et paiements. Le refus intervient avant mutation et avant `logAction`. Aucun fournisseur réel n'est invoqué.
