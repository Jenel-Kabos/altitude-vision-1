# HZ-06 — Matrice de tests

| Contrat | Preuve |
|---|---|
| Admin A/B isolés sur 3 GET | suite Mongo HZ-06 |
| Staff A/B manager préservé | suite Mongo HZ-06 |
| Staff no-tenant 403 | suite Mongo HZ-06 |
| PO global/scoped | suite Mongo HZ-06 |
| filtres/recherche/tri/pagination/total | suite Mongo HZ-06 |
| payload | assertions HTTP ciblées |
| PII/tarifs B absents pour A | sérialisation adversariale |
| GET read-only | Hotel et Property avant/après identiques |
| HZ-06 final | 16/16 |
| cluster HZ-01→HZ-07 | 7 suites, 123/123 |
| Hotel/HotelReservation | 34 suites, 429/429 |
| backend unitaire | 141 suites, 1 579/1 579 avec heap 8 Go |

La première tentative backend complète a été interrompue par OOM Node, sans échec fonctionnel ; la relance identique avec heap 8 Go est verte.
