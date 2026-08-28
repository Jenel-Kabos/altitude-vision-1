# ARCH-2K — Matrice des effets

| Edge | DB write | Notification | Email | Socket.IO | Cloudinary | Webhook | Finance |
|---|---|---|---|---|---|---|---|
| Accommodation → `accommodations` | NON | NON | NON | NON | NON | NON | Lectures documents/allocations/refunds et montants réservation |
| Hotel → `hotels` | NON | NON | NON | NON | NON | NON | Lectures allocations/refunds/soldes ; DomainReport ajoute le dashboard financier |
| Location → `rentals` | NON | NON | NON | NON | NON | NON | Lectures Paiement, loyers encaissés/impayés/pénalités |

Les trois fonctions sont read-only. Aucun provider, job, événement ou mutation indirecte n'a été identifié dans leur call graph. Les appels d'autorisation/scoping hôtel sont eux aussi read-only.
