# ARCH-2C4 — Matrice de refactor

| Old source | Old target | Symboles | Nouvelle abstraction | Callers migrés | Edge removed |
|---|---|---|---|---:|---|
| accommodationController | propertyController | helpers publication | propertyPublicationInputService | 1 | oui |
| hotelController | propertyController | helpers publication | propertyPublicationInputService | 1 | oui |
| rentalPropertyController | propertyController | helpers publication | propertyPublicationInputService | 1 | oui |
| salePropertyController | propertyController | helpers publication | propertyPublicationInputService | 1 | oui |

`altimmoSearchController → propertyController.runPropertySearch` reste intact.
