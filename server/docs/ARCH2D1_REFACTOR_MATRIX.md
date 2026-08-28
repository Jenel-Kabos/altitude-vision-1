# ARCH-2D1 — Matrice de refactor

| Service source | Controller target | Symbol | New owner | Callers migrated | Edge removed |
|---|---|---|---|---:|---|
| `rentalLeaseRenewalService.js` | `contratController.js` | `generatePaiements` | `rentalPaymentScheduleService.js` | 2 (`contratController`, `rentalLeaseRenewalService`) | Oui |

Le corps a été déplacé une seule fois. Le controller a cessé d'exporter le helper et consomme le même propriétaire canonique que le service. Aucun bridge, import dynamique, duplication ou allowlist n'a été ajouté.
