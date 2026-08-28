# Inventaire canonique revalidé

Source : les neuf findings de `HOTFIX_TENANT_SCOPE_HORIZONTAL_AUDIT1_FINDING_MATRIX.md`, revalidés contre les routes montées et le code courant.

| ID | Domain | Endpoint/Surface | Initial Severity | Initial Finding | Current Status |
|---|---|---|---|---|---|
| HZ-01 | AccommodationReservation | lifecycle confirm/cancel/check-in/check-out/no-show | P0 | ObjectId + rôle staff permettaient mutation, facture et locks cross-tenant | CLOSED_CERTIFIED |
| HZ-02 | Accommodation Calendar | blocks et reservation-calendar | P0 | parent Accommodation non scopé avant lectures/mutations | CLOSED_CERTIFIED |
| HZ-03 | AccommodationReservation | `GET /api/accommodation-reservations` | P0 | staff sans tenant tombait sur `query={}` global | CLOSED_CERTIFIED |
| HZ-04 | Accommodation | admin/list et status/pending | P0 | queries et total globaux | CLOSED_CERTIFIED |
| HZ-05 | HotelReservation | admin/list et status/pending | P0 | contexte attaché mais ignoré ; query globale avec PII/séjour/montants | STILL_OPEN |
| HZ-06 | Hotel | admin/list, portfolio, status/pending | P0 | branche Admin omet les IDs hôtels du tenant | STILL_OPEN |
| HZ-07 | Property | pending, pending-count et listing staff sur `/` | P0 | guards tenant absents ; pending/count globaux ; staff désactive filtres publics | STILL_OPEN |
| HZ-08 | Legacy attribution | ressources utilisant `assertResourceTenantOrUnattributed` | P2 | ressources historiques inattribuables volontairement tolérées | STILL_OPEN |
| HZ-09 | Cross-domain drift | résolution inline `resolveTenantForUser` | P2 | dispersion créant un risque futur d'omission | STILL_OPEN |

## Comptage

- Findings AUDIT1 : 9, IDs exacts HZ-01 à HZ-09.
- Fermés et certifiés : 4.
- Restants examinés : 5.
- Findings runtime LIVE : HZ-05, HZ-06, HZ-07 ; HZ-08/HZ-09 sont des patterns vivants transversaux, pas des routes uniques.
- DEAD_ROUTE : 0.
- LEGACY : HZ-08 est une dette legacy vivante ; aucune route HZ-05/06/07 n'est morte ou démontée.
- Fermeture indirecte par HZ-01→HZ-04 : 0 parmi HZ-05→HZ-09.
- NEEDS_RUNTIME_CONFIRMATION : HZ-05, HZ-06 et HZ-07 pour une reproduction adversariale rouge persistée ; leur exploitabilité statique reste prouvée.
