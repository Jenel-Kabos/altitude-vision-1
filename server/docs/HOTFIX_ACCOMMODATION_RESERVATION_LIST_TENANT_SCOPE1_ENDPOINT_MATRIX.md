# Matrice des endpoints de liste

| Method | Endpoint | Mounted | Auth | RBAC | Tenant resolution | Handler | Query |
|---|---|---|---|---|---|---|---|
| GET | `/api/accommodation-reservations` | LIVE via `server.js` → router | `auth.protect` | tout utilisateur authentifié ; branche staff/owner/guest | après fix, middleware canonique obligatoire pour staff/PO, optionnel pour self-service | `accommodationReservationController.list` | staff scoped `{tenant}` ; PO global `{}` ; Proprietaire `{owner}` ; autres `{guest}` + filtres |

Un seul endpoint LIVE liste directement `AccommodationReservation`. Le GET `/:id` est un détail, le calendrier est un agrégat distinct déjà couvert par HZ-02. Aucun admin alias, history/search/dashboard list, DEAD_ROUTE, LEGACY ou UNKNOWN n'a été trouvé.
