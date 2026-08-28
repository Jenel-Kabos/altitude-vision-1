# SECURITY-FINAL-CLOSURE-AUDIT-1 — Matrice des findings de la recherche adversariale

| ID | Severity | Domain | Route | Boundary manquante | Runtime | Blocking | Status |
|---|---|---|---|---|---|---|---|
| FCA1-01 | P0 | Contrat | `POST /api/contrats` | Tenant sur `Property` (`req.body.bien`) avant création | Confirmé (201 + persisté cross-tenant) | OUI | CONFIRMÉ — non corrigé |
| FCA1-02 | P0 | RealEstateReservation | `GET/POST /api/real-estate-applications/reservations/:id[/cancel]` | Tenant sur `reservation.application` | Confirmé (200 lecture + 200 annulation effective) | OUI | CONFIRMÉ — non corrigé |

Aucun P2/P3 nouveau jugé nécessaire de documenter séparément (le seul point relevé, le domaine Estimation, est une architecture intentionnellement sans tenant, pas une dette).

Voir `_BLOCKERS.md` pour le détail complet (root cause, reproduction, blast radius, hotfix recommandé) de chaque ligne.
