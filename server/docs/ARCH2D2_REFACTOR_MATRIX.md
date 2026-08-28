# ARCH-2D2 — Matrice de refactor

| Service source | Controller target | Symbol | New owner | Consumers | Edge removed |
|---|---|---|---|---|---|
| `mobileAccommodationPublicationService.js` | `propertyMobileController.js` | `buildMobilePropertyData` | `propertyPublicationInputService.js` | Controller + service de publication | Oui |

Tous les consumers utilisent désormais l'unique owner existant. L'export du controller a été supprimé. Aucun bridge, copie résiduelle, import dynamique ou allowlist n'a été créé.
