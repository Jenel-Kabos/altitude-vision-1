# HZ-04 — Matrice des endpoints

Le routeur est monté par `server.js` sous `/api/accommodations`. Six routes collectionnelles ou assimilées du domaine ont été examinées ; trois retournent une collection d'`Accommodation`, et deux seulement appartiennent à HZ-04.

| Method | Endpoint | Mounted | Purpose | Auth | RBAC | Tenant middleware après fix | Handler | Query | Class |
|---|---|---:|---|---|---|---|---|---|---|
| GET | `/admin/list` | oui | liste admin filtrée/paginée | protect | Admin, GestionnaireImmobilier, Collaborateur | canonical allow-platform-wide | `listAdmin` | `listAccommodationsForAdmin` → `Accommodation.find` | LIVE/HZ-04 |
| GET | `/status/pending` | oui | modération `soumis` | protect | mêmes rôles | canonical allow-platform-wide | `pending` | `Accommodation.find(accommodationModerationFilter(...))` | LIVE/HZ-04 |
| GET | `/mine` | oui | portefeuille acteur | protect | tout authentifié | aucun | `mine` | `createdBy=req.user.id` | LIVE/hors HZ-04 |
| GET | `/:id/rate-plans` | oui | tarifs d'un hébergement | protect | tout authentifié | aucun | `listRates` | `RatePlan`, pas collection Accommodation | LIVE/hors HZ-04 |
| GET | `/:id/availability-blocks` | oui | blocs calendrier | protect | tout authentifié | canonical | reservation controller | `AvailabilityBlock` | LIVE/HZ-02 |
| GET | `/:id/reservation-calendar` | oui | calendrier | protect | tout authentifié | canonical | reservation controller | réservations/blocs | LIVE/HZ-02 |

Routes candidates trouvées : 6 ; LIVE : 6 ; DEAD_ROUTE : 0 ; LEGACY : 0. Aucun alias `approved`, `unpublished`, `all` ou recherche admin distincte n'existe pour `Accommodation`.
