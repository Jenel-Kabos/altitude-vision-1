# Matrice de reproduction

| Action | A→A après | A→B après | B→B après | B→A après |
|---|---:|---:|---:|---:|
| Confirm | 200 | 404 | 200 | 404 |
| Cancel | 200 | 404 | 200 | 404 |
| Check-in | 200 | 404 | 200 | 404 |
| Check-out | 200 | 404 | 200 | 404 |
| No-show | 200 | 404 | 200 | 404 |

Preuve : suite Mongo réelle `accommodationReservationTenantScope.mongo.integration.test.js`, 21/21. La colonne « avant » runtime n'a pas été enregistrée avant modification et reste non confirmée ; le chemin vulnérable avant est prouvé statiquement.

