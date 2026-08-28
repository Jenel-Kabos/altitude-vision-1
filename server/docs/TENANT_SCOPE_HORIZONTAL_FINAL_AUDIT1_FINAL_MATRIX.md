# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Matrice finale

| ID | Surface | Severity | Status | Action |
|---|---|---|---|---|
| HZ-01 | AccommodationReservation mutations | P0 (historique) | CLOSED | Aucune — revérifié vert (137/137 cluster) |
| HZ-02 | Accommodation Calendar/Blocks | P0 (historique) | CLOSED | Aucune — revérifié vert |
| HZ-03 | AccommodationReservation list | P0 (historique) | CLOSED | Aucune — revérifié vert |
| HZ-04 | Accommodation admin/pending lists | P0 (historique) | CLOSED | Aucune — revérifié vert |
| HZ-05 | HotelReservation admin/pending lists | P0 (historique) | CLOSED | Aucune — revérifié vert |
| HZ-06 | Hotel admin lists | P0 (historique) | CLOSED | Aucune — revérifié vert |
| HZ-07 | Property moderation | P0 (historique) | CLOSED | Aucune — revérifié vert |
| HZ-08 | `assertResourceTenantOrUnattributed`, 376 ressources historiques | P2 | DEFERRED | HZ08-LEGACY-DATA-AUTHORITY-REGULARIZATION-1 (futur, non autorisé ici) |
| HZ-09 | 15 appels directs à `resolveTenantForUser` | P3 | RECLASSIFIED | ARCH-HZ09-CANONICAL-TENANT-BOUNDARY-1 (facultatif, non autorisé ici) |
| **HF-FINAL-01** | **Messaging — staff-inbox/detail/delete/send, contexte tenant ambigu** | **P0** | **CONFIRMED_RUNTIME — OPEN** | **HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 (recommandé, non exécuté)** |
| RBAC-FINAL-01 | `GET/POST/DELETE .../availability-blocks` sans ownership | P1/P2 | STATICALLY_EXPLOITABLE — OPEN (RBAC, hors tenant) | Sprint RBAC dédié (recommandé, non exécuté) |
| NEW-DEAD-ROUTES | 5 fichiers routeur jamais montés | INFO | DEAD | Nettoyage de dette éventuel, non exploitable en runtime |
| NEW-DEV-PORTAL | API keys (Dev Portal) | — | NOT_EXPLOITABLE (CLEAN) | Aucune |
| NEW-DASHBOARD-ANALYTICS | Agrégats accommodations/hotels | — | NOT_EXPLOITABLE (CLEAN, garde fail-closed confirmée) | Aucune |
| UNKNOWN-DOMAINS | transactions, sync, estimation, devis, litiges, signalements, facebook-posts, rental-documents, dossiers, rental-lease-lifecycle, rental-contract-regularization, Finance (agrégats détaillés) | UNKNOWN | NON CONFIRMÉ | Ré-audit recommandé si un chantier de suite est lancé |

## Verdict

**B. AUDIT FINAL — NEW P0/P1 IDENTIFIED — CAMPAIGN REMAINS OPEN.**
