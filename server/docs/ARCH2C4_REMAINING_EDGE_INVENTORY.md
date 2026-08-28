# ARCH-2C4 — Inventaire des cinq arêtes

| # | Source | Target | Symboles | Calls | Domaine | Risque |
|---|---|---|---|---|---|---|
| 1 | accommodationController | propertyController | parsers, upload, buildBasePropertyData | création/mise à jour | PROPERTY/SHARED | moyen |
| 2 | hotelController | propertyController | mêmes helpers sauf parseNumericField | création/mise à jour | PROPERTY/SHARED | moyen |
| 3 | rentalPropertyController | propertyController | mêmes helpers | création/mise à jour | PROPERTY | moyen |
| 4 | salePropertyController | propertyController | mêmes helpers | création/mise à jour | PROPERTY | moyen |
| 5 | altimmoSearchController | propertyController | runPropertySearch | recherche publique | PROPERTY | élevé |

Les quatre premières sont un cluster d'entrée/publication. La cinquième est une query publique complexe et reste volontairement distincte.
