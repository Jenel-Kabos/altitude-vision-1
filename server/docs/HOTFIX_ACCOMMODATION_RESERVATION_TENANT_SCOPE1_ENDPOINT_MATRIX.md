# Matrice endpoints

| Mutation | Endpoint | Handler | État source |
|---|---|---|---|
| Confirm | `POST /api/accommodation-reservations/:id/confirm` | `transition('confirmed')` | pending |
| Cancel | `POST /api/accommodation-reservations/:id/cancel` | `transition('cancelled')` | pending/confirmed |
| Check-in | `POST /api/accommodation-reservations/:id/check-in` | `transition('checked_in')` | confirmed |
| Check-out | `POST /api/accommodation-reservations/:id/check-out` | `transition('checked_out')` | checked_in |
| No-show | `POST /api/accommodation-reservations/:id/no-show` | `transition('no_show')` | confirmed |

