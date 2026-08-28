# HOTFIX-MONGO-ARCH2L-INDEX-ORDER-FLAKE-1 — Matrice des échecs

| Suite | Test | Error | Model | Index involved | Isolated rerun |
|---|---|---|---|---|---|
| `rentalReportQueryBoundary.mongo.integration.test.js` | Owner A reçoit ses KPI complets sans contamination Owner B | `MongoBulkWriteError`, code 11000, duplicate `propertyA2` | RentalManagement / `rentalmanagements` | `property_1`, `{property:1}`, unique | PASS 6/6 sans index matérialisé |
| même suite | plusieurs owners sont agrégés ensemble quand le scope les contient | même `E11000` | RentalManagement / `rentalmanagements` | même index | PASS 6/6 |
| même suite | mode global sans scope — contrat utilisé par le PlatformOperator non scopé — agrège tous les owners | même `E11000` | RentalManagement / `rentalmanagements` | même index | PASS 6/6 |

Message exact reproduit : `E11000 duplicate key error collection: arch2l_order_<pid>.rentalmanagements index: property_1 dup key: { property: ObjectId(...) }`. Les trois autres tests de la suite passent dans le scénario rouge : 3/6.
