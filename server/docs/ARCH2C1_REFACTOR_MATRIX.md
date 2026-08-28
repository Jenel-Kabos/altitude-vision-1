# ARCH-2C1 — Matrice de refactor

| Ancien source | Ancien target | Symbole | Nouvelle abstraction | Baseline supprimée |
|---|---|---|---|---|
| `internalMailController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `litigeController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `locataireController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `messageController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `paiementController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `proprietaireController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `rentalMaintenanceController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `signalementController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |
| `tenantPortalController` | `rentalDocumentController` | `streamRemoteDocument` | `storage/documentStreamingService` | Oui |

`rentalDocumentController` consomme lui aussi le service canonique. Le helper n'est ni dupliqué ni réexporté par un contrôleur.
