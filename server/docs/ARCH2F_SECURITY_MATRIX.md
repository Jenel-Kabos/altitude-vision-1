# ARCH-2F — Matrice sécurité et invariants

| Invariant | Preuve | Résultat |
|---|---|---|
| Authentication unchanged | `router.use(authController.protect)` inchangé | Oui |
| Authorization unchanged | `restrictTo(...STAFF_ALL)` inchangé et caractérisé | Oui |
| Tenant unchanged | Aucun filtre/middleware tenant avant ou après | Oui |
| Ownership unchanged | Aucun scope owner avant ou après | Oui |
| PlatformOperator unchanged | Aucun symbole ou garde impliqué | Oui |
| IAM unchanged | Aucun rôle/capability modifié | Oui |
| No mutation introduced | Seulement quatre `countDocuments` et un KPI read-only | Oui |
| No publication change | Seul filtre existant `{ isPublished: true }` conservé | Oui |
| No finance rule change | Aucun modèle financier impliqué | Oui |
| API contract unchanged | Tests avant/après sur shape, ordre et erreur | Oui |
| Frontend unchanged | Aucun fichier `client/` touché par ARCH-2F | Oui |
| Mobile unchanged | Aucun fichier `altimmo-app/` touché par ARCH-2F | Oui |
| No production mutation | MongoMemory uniquement ; aucun Atlas, migration ou deploy | Oui |

